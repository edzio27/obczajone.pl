/*
  # Security hardening follow-up (audit findings)

  This migration addresses gaps found during a security review of the RLS
  policy history. It does not change any table schema, only tightens policies.

  1. listing_snapshots
     - Problem: `listing_snapshots_insert_policy` allowed ANY authenticated
       user to insert an arbitrary snapshot (including free-text `description`
       and `metadata`) for ANY existing listing, with no ownership check and
       no content validation. Combined with the frontend previously rendering
       `description` via dangerouslySetInnerHTML, this was a stored XSS vector
       exploitable by any signed-up user against every visitor of a listing
       page. The frontend has been fixed to render as plain text (defense in
       depth), and this migration removes client write access entirely:
       snapshots are only ever written by the scraper edge functions, which
       use the service_role key and therefore bypass RLS. There is no
       legitimate product reason for a regular authenticated user to insert
       snapshot rows directly via the client.

  2. rate_limits
     - Problem: rate limiting was enforced only in client-side JavaScript
       (lib/rate-limit.ts calls checkRateLimit() before an insert, then
       recordAction() after it). Anyone can call the Supabase REST API
       directly, skip the check, AND skip recording the action - trivially
       bypassing the limit entirely (the app's own recordAction() call is not
       a source of truth the trigger can rely on, since a bypassing caller
       simply never calls it either).
     - Fix: add BEFORE INSERT triggers on `listings` and `reviews` that both
       check AND record against `rate_limits` atomically at the database
       level, so the limit holds even if the client-side check/record calls
       are skipped entirely. Anonymous (created_by/user_id IS NULL) inserts
       are capped globally per time window as a coarse abuse brake, since
       there is no per-user identity to key on for anonymous writers.

  3. listings.url
     - Problem: no server-side validation that a listing's `url` actually
       points at the declared `source` (otomoto/otodom) domain. Combined with
       anonymous listing creation, this allowed a listing row to be created
       with `source = 'otomoto'` but `url` pointing at an arbitrary host,
       which the scrape-listing and daily-price-scraper edge functions would
       then fetch server-side (SSRF). The edge functions now validate the
       hostname themselves (defense in depth), and this migration adds a
       CHECK constraint so bad rows cannot even be created.

  4. listings.title / current_price / image_url on client insert
     - Problem: the app never sets these on INSERT (they're meant to be
       populated later by the scraper), but RLS does not restrict which
       columns a client-originated insert may set. Any caller hitting the
       REST API directly could set an arbitrary `title` on creation. This
       value is rendered into a JSON-LD <script type="application/ld+json">
       block via dangerouslySetInnerHTML (app/listing/[id]/page.tsx) - that
       call site has separately been hardened to escape "<", but there is no
       product reason for a client to control these scraper-owned fields at
       all, so this migration forces them back to their defaults on insert
       as belt-and-suspenders.
*/

-- 1. Restrict listing_snapshots INSERT to service_role only (scraper edge
--    functions use the service_role key, which bypasses RLS regardless, so
--    removing the "authenticated" policy does not break scraping).
DROP POLICY IF EXISTS "listing_snapshots_insert_policy" ON listing_snapshots;

-- No policy is created for authenticated/anon INSERT: with RLS enabled and
-- no matching policy, all client-originated inserts are denied by default.
-- service_role bypasses RLS entirely, so the scraper functions are unaffected.

-- 2. Enforce rate limits at the database level (defense in depth against
--    client-side bypass).
CREATE OR REPLACE FUNCTION enforce_listing_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    IF NOT public.check_rate_limit(NEW.created_by, 'add_listing', 5, 60) THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many listings created recently'
        USING ERRCODE = 'P0001';
    END IF;
    -- Record the action ourselves so enforcement does not depend on the
    -- client separately (and honestly) calling recordAction() afterwards.
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (NEW.created_by, 'add_listing');
  ELSE
    -- Anonymous writers have no stable identity to key on; apply a coarse
    -- global cap on anonymous listing creation per time window instead of no
    -- limit at all.
    IF (
      SELECT COUNT(*) FROM public.listings
      WHERE created_by IS NULL
        AND created_at > now() - interval '10 minutes'
    ) >= 30 THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many anonymous listings created recently'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_listing_rate_limit ON listings;
CREATE TRIGGER trg_enforce_listing_rate_limit
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_listing_rate_limit();

CREATE OR REPLACE FUNCTION enforce_review_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    IF NOT public.check_rate_limit(NEW.user_id, 'add_review', 20, 60) THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many reviews created recently'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (NEW.user_id, 'add_review');
  ELSE
    IF (
      SELECT COUNT(*) FROM public.reviews
      WHERE user_id IS NULL
        AND created_at > now() - interval '10 minutes'
    ) >= 30 THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many anonymous reviews created recently'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_review_rate_limit ON reviews;
CREATE TRIGGER trg_enforce_review_rate_limit
  BEFORE INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION enforce_review_rate_limit();

-- 3. Validate that a listing's url matches its declared source domain, to
--    prevent SSRF-by-data (a row that claims source='otomoto' but points
--    url at an arbitrary/internal host).
--
--    Added as NOT VALID so this migration cannot fail/be blocked by any
--    pre-existing rows that don't conform (e.g. legacy data). It still
--    applies to all NEW inserts/updates immediately. Run, in a follow-up
--    once existing data has been audited/cleaned:
--      ALTER TABLE listings VALIDATE CONSTRAINT listings_url_matches_source;
-- to fully close the gap for old rows too.
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_url_matches_source;
ALTER TABLE listings ADD CONSTRAINT listings_url_matches_source CHECK (
  (source = 'otomoto' AND url ~* '^https://(www\.)?otomoto\.pl/')
  OR (source = 'otodom' AND url ~* '^https://(www\.)?otodom\.pl/')
) NOT VALID;

-- 4. Force scraper-owned fields back to their defaults on any client-
--    originated INSERT, regardless of what a direct API call tries to set.
--    (service_role/scraper writes go through UPDATE afterwards, not this
--    trigger's INSERT path, so the scraper's own flow is unaffected.)
CREATE OR REPLACE FUNCTION reset_listing_scraper_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.title := '';
  NEW.current_price := 0;
  NEW.image_url := '';
  NEW.location := '';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_listing_scraper_fields ON listings;
CREATE TRIGGER trg_reset_listing_scraper_fields
  BEFORE INSERT ON listings
  FOR EACH ROW
  EXECUTE FUNCTION reset_listing_scraper_fields();
