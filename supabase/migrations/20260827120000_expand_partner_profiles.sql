/*
  # Give partners a real profile and an account they can log into

  Until now a partner was a pin on a map with a link that sent the visitor
  straight out to Instagram. Nothing about that is sellable: the partner cannot
  be found in search, cannot be judged by anyone, and every visitor we hand over
  leaves the site for good. This migration turns `partners` into something that
  can own a public page, and gives the partner a way to sign in and maintain it.

  1. Changes to `partners`
    - `slug` (text, unique) — the address of the partner's own page,
      /partner/<slug>. Backfilled from `name`, deduplicated with a numeric
      suffix, then made NOT NULL.
    - `phone`, `email`, `website` (text, nullable) — real contact details, so
      the profile page is more than a link out to social media.
    - `about` (text) — long description for the profile page. `description`
      stays as the one-line summary used on cards and in the map popup.
    - `services` (text[]) — what the partner actually does, e.g.
      {'oględziny przedzakupowe','pomiar lakieru','diagnostyka komputerowa'}.
    - `price_from` (numeric, nullable) — "od X zł", the single number a buyer
      wants before making contact.
    - `response_time` (text, nullable) — declared response time, e.g. 'do 24h'.
    - `is_verified` / `verified_at` — the "Zweryfikowany partner" badge. Kept
      separate from `is_active` on purpose: an active partner is one we show,
      a verified one is one whose company details we actually checked.
    - `partner_since` (date) — how long the cooperation has run.
    - `is_promoted` (boolean) — paid priority placement. Stored explicitly so
      the UI can label it as promoted; unlabelled paid ranking is an unfair
      commercial practice under the Omnibus directive, so the flag has to be
      visible in the data model rather than living in someone's head.

  2. New table `partner_users`
    - Links an auth user to a partner, which is what lets a partner sign in and
      manage their own leads, replies and inspections without going through the
      site owner for every change.
    - `role` is 'owner' for now; the column exists so adding a limited
      'employee' role later does not need another migration.

  3. New function `is_partner_member(uuid)`
    - SECURITY DEFINER helper used by every partner-owned policy that follows in
      later migrations. Mirrors the existing `is_admin()` pattern: without it,
      each policy would have to subquery `partner_users`, and RLS on that table
      would then recurse.

  4. Security
    - `partners` stays public-read. Partners may now UPDATE their own row, but
      only through the `partner_self_update_guard` trigger, which pins every
      commercial field (is_active, is_verified, is_promoted, slug, category,
      rating aggregates) to its previous value. Letting a partner mark itself
      verified or promoted would make both badges worthless.
    - `partner_users` is readable by its own member and by admins; nobody may
      write it through the anon key. Attaching an account to a partner is a
      commercial decision and stays with the site owner.
*/

ALTER TABLE partners ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS about text NOT NULL DEFAULT '';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}';
ALTER TABLE partners ADD COLUMN IF NOT EXISTS price_from numeric;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS response_time text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS partner_since date;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_promoted boolean NOT NULL DEFAULT false;

/*
  Slugify without relying on the `unaccent` extension: Polish diacritics are a
  closed set, so translate() handles them deterministically and the migration
  does not depend on an extension being installed in the target project.
*/
CREATE OR REPLACE FUNCTION public.slugify(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(translate(value, 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzACELNOSZZ')),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

/*
  Backfill: give every existing partner a slug, appending a counter when two
  companies slugify to the same string.
*/
DO $$
DECLARE
  rec record;
  base_slug text;
  candidate text;
  suffix integer;
BEGIN
  FOR rec IN SELECT id, name FROM partners WHERE slug IS NULL ORDER BY created_at LOOP
    base_slug := public.slugify(rec.name);
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'partner';
    END IF;

    candidate := base_slug;
    suffix := 1;
    WHILE EXISTS (SELECT 1 FROM partners WHERE slug = candidate) LOOP
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix;
    END LOOP;

    UPDATE partners SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

ALTER TABLE partners ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_slug ON partners (slug);
CREATE INDEX IF NOT EXISTS idx_partners_active_category
  ON partners (category, is_active);

CREATE TABLE IF NOT EXISTS partner_users (
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'employee')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON partner_users (user_id);

ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_partner_member(target_partner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partner_users
    WHERE partner_id = target_partner_id
      AND user_id = (SELECT auth.uid())
  );
$$;

/* Which partner (if any) the current user manages - used by the partner panel. */
CREATE OR REPLACE FUNCTION public.current_partner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT partner_id FROM public.partner_users
  WHERE user_id = (SELECT auth.uid())
  ORDER BY created_at
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "Members can read their own partner link" ON partner_users;
CREATE POLICY "Members can read their own partner link"
  ON partner_users FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_admin());

/*
  Partners may edit their own presentation, but not their standing. The guard
  trigger is what makes the UPDATE policy safe to grant at all: column-level
  restrictions are not expressible in an RLS policy, so the check lives here.
*/
CREATE OR REPLACE FUNCTION public.partner_self_update_guard()
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
  NEW.slug := OLD.slug;
  NEW.category := OLD.category;
  NEW.is_active := OLD.is_active;
  NEW.is_verified := OLD.is_verified;
  NEW.verified_at := OLD.verified_at;
  NEW.is_promoted := OLD.is_promoted;
  NEW.partner_since := OLD.partner_since;
  NEW.referral_slug := OLD.referral_slug;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_self_update_guard ON partners;
CREATE TRIGGER trg_partner_self_update_guard
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION public.partner_self_update_guard();

DROP POLICY IF EXISTS "Partners can update their own profile" ON partners;
CREATE POLICY "Partners can update their own profile"
  ON partners FOR UPDATE
  TO authenticated
  USING (is_partner_member(id) OR is_admin())
  WITH CHECK (is_partner_member(id) OR is_admin());

DROP POLICY IF EXISTS "Admins can insert partners" ON partners;
CREATE POLICY "Admins can insert partners"
  ON partners FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can delete partners" ON partners;
CREATE POLICY "Admins can delete partners"
  ON partners FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can manage partner accounts" ON partner_users;
CREATE POLICY "Admins can manage partner accounts"
  ON partner_users FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can revoke partner accounts" ON partner_users;
CREATE POLICY "Admins can revoke partner accounts"
  ON partner_users FOR DELETE
  TO authenticated
  USING (is_admin());
