/*
  # One-click signals about a listing, with no account and no form

  The review form asks for a star rating, whether the person went to see the
  car, a written comment and optionally photos - and it only appears to someone
  logged in. Across five months it produced 25 reviews, almost all of them from
  the site owner or one partner. That is not a moderation problem, it is a price
  problem: nobody who arrived from Google ten seconds ago is going to fill in
  that form.

  The things a visitor actually knows, and that genuinely help the next buyer,
  fit into one tap: the listing is gone, the price differs from the advert, the
  seller does not answer, the car looks different in person. This table records
  those, from anyone, without an account.

  1. New table `listing_signals`
    - `kind` — a closed set. New kinds need a migration on purpose: an open text
      column would fill up with variants of the same thing and the counts under
      a listing would stop meaning anything.
    - No `user_id`, no IP, no user agent. A count is the whole payload, and
      storing less keeps this out of scope for the questions the privacy policy
      answers - same reasoning as `partner_referrals`.

  2. Security
    - Anyone may INSERT and anyone may SELECT. There is nothing private here.
    - `listing_signal_flood_guard` refuses a kind that already has 20 rows for
      the same listing within the last hour. Without an account there is nothing
      better to key a rate limit on, and a per-listing ceiling is what actually
      protects the number people read: one person with a script can still add
      twenty, which changes "3 osoby" into "20 osób" and no more. The browser
      keeps its own record of what it has already sent, so honest double-taps
      never reach here.
*/

CREATE TABLE IF NOT EXISTS listing_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'sold',           -- ogłoszenie nieaktualne / auto sprzedane
    'price_differs',  -- cena inna niż w ogłoszeniu
    'no_answer',      -- sprzedawca nie odbiera
    'differs',        -- auto wygląda inaczej niż na zdjęciach
    'visited'         -- byłem/byłam oglądać
  )),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_signals_listing
  ON listing_signals (listing_id, kind);

ALTER TABLE listing_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read signals" ON listing_signals;
CREATE POLICY "Anyone can read signals"
  ON listing_signals FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can add a signal" ON listing_signals;
CREATE POLICY "Anyone can add a signal"
  ON listing_signals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can remove signals" ON listing_signals;
CREATE POLICY "Admins can remove signals"
  ON listing_signals FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE OR REPLACE FUNCTION public.listing_signal_flood_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM public.listing_signals
  WHERE listing_id = NEW.listing_id
    AND kind = NEW.kind
    AND created_at > now() - interval '1 hour';

  IF recent >= 20 THEN
    RAISE EXCEPTION 'listing_signal_flood'
      USING HINT = 'Za dużo zgłoszeń tego typu przy tym ogłoszeniu w ostatniej godzinie.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_signal_flood_guard ON listing_signals;
CREATE TRIGGER trg_listing_signal_flood_guard
  BEFORE INSERT ON listing_signals
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_signal_flood_guard();
