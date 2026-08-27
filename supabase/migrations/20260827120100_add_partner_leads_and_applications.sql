/*
  # Turn partner traffic into countable leads, and open a way in for new firms

  `partner_clicks` counts clicks. A click is not something a company will ever
  pay for, and it is not something we can invoice against: "I sent you 200
  clicks" is unverifiable from the partner's side, so it settles no argument.
  A lead - a name and a phone number attached to a specific listing - is a unit
  both sides can count the same way, which is what a pay-per-lead arrangement
  needs to exist at all.

  `partner_applications` is the other half: firms have to be able to apply
  without an e-mail thread, so an outreach message can end with a link.

  1. New table `partner_leads`
    - `partner_id`, `listing_id` (nullable) — which partner, and which listing
      the request came from. The listing is the whole context of the enquiry.
    - `user_id` (nullable) — set when the sender was signed in. Nullable
      because forcing a signup before a phone number is handed over would cost
      more leads than the attribution is worth.
    - `name`, `phone`, `email`, `message` — what the partner needs to call back.
    - `status` — 'new' | 'contacted' | 'done' | 'rejected', maintained by the
      partner in their panel. `done` is the row that gets invoiced.
    - `context` — where the form was submitted from, so we can compare the
      listing CTA against the profile page.

  2. New table `partner_applications`
    - A firm applying to join, from /dla-firm. Status tracked so the inbox in
      /admin is a work queue and not just a log.

  3. Security
    - Both tables accept INSERT from anon and authenticated - the sender is a
      visitor, and in the application case, not a user of the site at all.
    - Neither table is readable through the anon key. `partner_leads` holds
      phone numbers, and `partner_applications` holds company contact details;
      SELECT is restricted to admins and, for leads, the partner the lead was
      addressed to.
    - Both inserts are rate limited by a database trigger, not by client-side
      JavaScript. These are the only unauthenticated write paths in the app
      that carry a free-text body, so they are the ones worth flooding.
    - Partners may move a lead's status but nothing else: `partner_lead_update_guard`
      pins every other column, so a partner cannot rewrite the record of what
      we sent them before it is settled.

  4. Also grants partners read access to their own click and referral counts,
    which had no SELECT policy at all - those numbers exist to be shown to the
    partner, and until now only raw SQL could reach them.
*/

CREATE TABLE IF NOT EXISTS partner_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  context text NOT NULL DEFAULT 'partner_page'
    CHECK (context IN ('partner_page', 'listing_cta', 'partners_page')),
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'done', 'rejected')),
  contacted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT partner_leads_has_contact CHECK (phone <> '' OR email <> ''),
  CONSTRAINT partner_leads_name_length CHECK (char_length(name) BETWEEN 2 AND 100),
  CONSTRAINT partner_leads_message_length CHECK (char_length(message) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_partner_leads_partner
  ON partner_leads (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_leads_user
  ON partner_leads (user_id, partner_id);

ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS partner_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  nip text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  voivodeship text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'car' CHECK (category IN ('car', 'home', 'both')),
  website text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT partner_applications_company_length
    CHECK (char_length(company_name) BETWEEN 2 AND 150),
  CONSTRAINT partner_applications_message_length
    CHECK (char_length(message) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_partner_applications_status
  ON partner_applications (status, created_at DESC);

ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

/*
  Rate limiting lives in the database for the same reason it does for listings
  and reviews: a caller hitting the REST API directly never runs our
  client-side check. Signed-in senders are limited per user; anonymous ones by
  a coarse global cap per window, since there is no identity to key on.
*/
CREATE OR REPLACE FUNCTION public.enforce_partner_lead_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    IF NOT public.check_rate_limit(NEW.user_id, 'partner_lead', 5, 60) THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many enquiries sent recently'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (NEW.user_id, 'partner_lead');
  ELSE
    IF (
      SELECT COUNT(*) FROM public.partner_leads
      WHERE user_id IS NULL
        AND created_at > now() - interval '10 minutes'
    ) >= 20 THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many anonymous enquiries recently'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- A sender does not get to choose the status their lead lands in.
  NEW.status := 'new';
  NEW.contacted_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_partner_lead_rate_limit ON partner_leads;
CREATE TRIGGER trg_enforce_partner_lead_rate_limit
  BEFORE INSERT ON partner_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_partner_lead_rate_limit();

CREATE OR REPLACE FUNCTION public.enforce_partner_application_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.partner_applications
    WHERE created_at > now() - interval '10 minutes'
  ) >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many applications recently'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.status := 'new';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_partner_application_rate_limit ON partner_applications;
CREATE TRIGGER trg_enforce_partner_application_rate_limit
  BEFORE INSERT ON partner_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_partner_application_rate_limit();

/* A partner may advance a lead's status; everything else is the record. */
CREATE OR REPLACE FUNCTION public.partner_lead_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.partner_id := OLD.partner_id;
  NEW.listing_id := OLD.listing_id;
  NEW.user_id := OLD.user_id;
  NEW.name := OLD.name;
  NEW.phone := OLD.phone;
  NEW.email := OLD.email;
  NEW.message := OLD.message;
  NEW.context := OLD.context;
  NEW.created_at := OLD.created_at;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'new' THEN
    NEW.contacted_at := COALESCE(OLD.contacted_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_lead_update_guard ON partner_leads;
CREATE TRIGGER trg_partner_lead_update_guard
  BEFORE UPDATE ON partner_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.partner_lead_update_guard();

DROP POLICY IF EXISTS "Anyone can send a lead" ON partner_leads;
CREATE POLICY "Anyone can send a lead"
  ON partner_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Partner and admins can read leads" ON partner_leads;
CREATE POLICY "Partner and admins can read leads"
  ON partner_leads FOR SELECT
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Partner and admins can update leads" ON partner_leads;
CREATE POLICY "Partner and admins can update leads"
  ON partner_leads FOR UPDATE
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin())
  WITH CHECK (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Admins can delete leads" ON partner_leads;
CREATE POLICY "Admins can delete leads"
  ON partner_leads FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Anyone can apply to become a partner" ON partner_applications;
CREATE POLICY "Anyone can apply to become a partner"
  ON partner_applications FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read applications" ON partner_applications;
CREATE POLICY "Admins can read applications"
  ON partner_applications FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can update applications" ON partner_applications;
CREATE POLICY "Admins can update applications"
  ON partner_applications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete applications" ON partner_applications;
CREATE POLICY "Admins can delete applications"
  ON partner_applications FOR DELETE
  TO authenticated
  USING (is_admin());

/* The numbers we already collect, finally readable by the party they describe. */
DROP POLICY IF EXISTS "Partner and admins can read clicks" ON partner_clicks;
CREATE POLICY "Partner and admins can read clicks"
  ON partner_clicks FOR SELECT
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Admins can read referral visits" ON partner_referrals;
CREATE POLICY "Partner and admins can read referral visits"
  ON partner_referrals FOR SELECT
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());
