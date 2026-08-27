/*
  # Let a partner publish an inspection verdict on the listing itself

  This is the part of the arrangement that neither side can get anywhere else.
  The partner already drives to the car and writes up what they found; today
  that write-up goes to one buyer in a PDF and dies there. Published against the
  listing it describes, the same text becomes the only first-hand account of
  that specific car on the internet - which is content we cannot produce, a
  reason for the next buyer to land here, and a permanent, dated demonstration
  of the partner's competence sitting in front of everyone who reads the page.

  It is also the honest answer to "what do I get for the referral link", and it
  costs the partner nothing they were not already doing.

  1. New table `partner_inspections`
    - One inspection per partner per listing.
    - `verdict` — 'recommended' | 'reservations' | 'not_recommended'. A short
      enum rather than a star rating: this is a professional opinion about one
      object, not a satisfaction score, and blending it into the same scale as
      buyer ratings would misrepresent both.
    - `findings` (text[]) — the individual defects, kept separate from
      `summary` so the listing page can render them as a list without parsing
      prose.
    - `inspected_at` — when the car was actually seen, which will not be the
      day the note was published.
    - `is_approved` defaults to false. Partners write here directly, so the
      same moderation gate that applies to every other public text applies to
      this one; a partner account is a commercial relationship, not a reason to
      skip review.

  2. Aggregate
    - `partners.inspection_count` over approved inspections, maintained by
      trigger. It is the number that makes a profile page look worked-in rather
      than freshly seeded.

  3. Security
    - Public reads see approved inspections only.
    - Only a member of the partner may insert one, only for their own partner,
      and only with themselves as author. Editing sends it back to moderation,
      for the same reason it does on partner reviews.
*/

ALTER TABLE partners ADD COLUMN IF NOT EXISTS inspection_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS partner_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verdict text NOT NULL
    CHECK (verdict IN ('recommended', 'reservations', 'not_recommended')),
  summary text NOT NULL,
  findings text[] NOT NULL DEFAULT '{}',
  price_opinion text NOT NULL DEFAULT '',
  inspected_at date,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT partner_inspections_summary_length
    CHECK (char_length(summary) BETWEEN 20 AND 5000),
  CONSTRAINT partner_inspections_price_opinion_length
    CHECK (char_length(price_opinion) <= 1000),
  CONSTRAINT partner_inspections_one_per_listing UNIQUE (partner_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_inspections_listing
  ON partner_inspections (listing_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_partner_inspections_partner
  ON partner_inspections (partner_id, is_approved, created_at DESC);

ALTER TABLE partner_inspections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.refresh_partner_inspection_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target uuid := COALESCE(NEW.partner_id, OLD.partner_id);
BEGIN
  PERFORM set_config('app.partner_aggregate_refresh', '1', true);

  UPDATE public.partners p
  SET inspection_count = (
    SELECT COUNT(*)::integer FROM public.partner_inspections
    WHERE partner_id = target AND is_approved = true
  )
  WHERE p.id = target;

  PERFORM set_config('app.partner_aggregate_refresh', '', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_partner_inspection_count ON partner_inspections;
CREATE TRIGGER trg_refresh_partner_inspection_count
  AFTER INSERT OR UPDATE OR DELETE ON partner_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_partner_inspection_count();

CREATE OR REPLACE FUNCTION public.partner_inspection_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.author_user_id := (SELECT auth.uid());
    NEW.is_approved := false;
    RETURN NEW;
  END IF;

  NEW.partner_id := OLD.partner_id;
  NEW.listing_id := OLD.listing_id;
  NEW.author_user_id := OLD.author_user_id;
  NEW.created_at := OLD.created_at;

  IF NEW.verdict IS DISTINCT FROM OLD.verdict
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.findings IS DISTINCT FROM OLD.findings
     OR NEW.price_opinion IS DISTINCT FROM OLD.price_opinion THEN
    NEW.is_approved := false;
  ELSE
    NEW.is_approved := OLD.is_approved;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_inspection_write_guard ON partner_inspections;
CREATE TRIGGER trg_partner_inspection_write_guard
  BEFORE INSERT OR UPDATE ON partner_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.partner_inspection_write_guard();

DROP POLICY IF EXISTS "Everyone can read approved inspections" ON partner_inspections;
CREATE POLICY "Everyone can read approved inspections"
  ON partner_inspections FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);

DROP POLICY IF EXISTS "Partners and admins can read own inspections" ON partner_inspections;
CREATE POLICY "Partners and admins can read own inspections"
  ON partner_inspections FOR SELECT
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Partners can publish inspections" ON partner_inspections;
CREATE POLICY "Partners can publish inspections"
  ON partner_inspections FOR INSERT
  TO authenticated
  WITH CHECK (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Partners can edit their inspections" ON partner_inspections;
CREATE POLICY "Partners can edit their inspections"
  ON partner_inspections FOR UPDATE
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin())
  WITH CHECK (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Partners and admins can delete inspections" ON partner_inspections;
CREATE POLICY "Partners and admins can delete inspections"
  ON partner_inspections FOR DELETE
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());


/*
  # Close the gap the aggregate columns opened in the partner self-update guard

  `partner_self_update_guard` was written before `rating_avg`, `rating_count`
  and `inspection_count` existed, so it could not pin them - and partners are
  allowed to UPDATE their own row. Left as it was, any partner could set their
  own rating to 5.00 with one REST call, which would quietly make every rating
  in the directory worthless.

  Redefined here, once every aggregate column exists. The trigger already
  installed on `partners` picks up the new body automatically.

  The transaction-local flag `app.partner_aggregate_refresh` is how the two
  aggregate-refresh triggers identify their own writes: they are the only
  legitimate writer of these columns, and they run under whatever identity
  caused the underlying review or inspection to change - usually not an admin.
*/
CREATE OR REPLACE FUNCTION public.partner_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('app.partner_aggregate_refresh', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.slug := OLD.slug;
  NEW.category := OLD.category;
  NEW.is_active := OLD.is_active;
  NEW.is_verified := OLD.is_verified;
  NEW.verified_at := OLD.verified_at;
  NEW.is_promoted := OLD.is_promoted;
  NEW.partner_since := OLD.partner_since;
  NEW.referral_slug := OLD.referral_slug;
  NEW.created_at := OLD.created_at;
  NEW.rating_avg := OLD.rating_avg;
  NEW.rating_count := OLD.rating_count;
  NEW.inspection_count := OLD.inspection_count;
  RETURN NEW;
END;
$$;
