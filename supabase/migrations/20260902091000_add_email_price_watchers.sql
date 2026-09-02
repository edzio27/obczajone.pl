/*
  # Watch a price with an e-mail address instead of an account

  Everything needed to tell someone their car got cheaper already exists: the
  daily scraper, the cron, the Edge Function, the Resend integration. It has
  been running for nobody. `favorites` has zero rows, because switching an alert
  on costs five steps - register, confirm, log in, favourite the listing, tick
  the box - and there are ten accounts on the whole site.

  This table removes all five. Paste an e-mail, done. It is the only mechanism
  here that turns a visitor who arrived from a search into someone we can reach
  again, which is worth more at this stage than a registered user.

  1. New table `listing_price_watchers`
    - `email` — the only personal datum the site stores about a visitor with no
      account, so the privacy policy says what it is for and how to get rid of
      it.
    - `unsubscribe_token` — the whole authorisation model here. Whoever has the
      link may unsubscribe; nothing else about the row is reachable.
    - `last_notified_price` — same reference-price logic as `favorites`, moved
      forward only after the mail actually goes out.
    - One row per (listing, e-mail): a second submission refreshes the row
      rather than doubling the mail.

  2. Security
    - INSERT is open to anon: signing up for your own alert is the point.
    - There is no SELECT policy at all, for anyone. These are e-mail addresses
      of people with no account; the alert job reads them with the service key,
      and nothing in the browser ever needs to.
    - Unsubscribing goes through `unsubscribe_price_watch(token)`, SECURITY
      DEFINER, so a token deletes exactly its own row and cannot be used to
      enumerate anything.
    - `price_watcher_flood_guard` caps one listing at 50 watchers an hour.
      A form with no account is a spam target, and the cost of abuse here is
      mail sent to strangers from our domain.
*/

CREATE TABLE IF NOT EXISTS listing_price_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  email text NOT NULL,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  last_notified_price numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT listing_price_watchers_email_shape
    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  CONSTRAINT listing_price_watchers_one_per_listing UNIQUE (listing_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_watchers_token
  ON listing_price_watchers (unsubscribe_token);

CREATE INDEX IF NOT EXISTS idx_price_watchers_listing
  ON listing_price_watchers (listing_id);

ALTER TABLE listing_price_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe to price drops" ON listing_price_watchers;
CREATE POLICY "Anyone can subscribe to price drops"
  ON listing_price_watchers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

/* Świadomie bez polityki SELECT: adresy czyta wyłącznie zadanie wysyłkowe,
   kluczem serwisowym, który polityki omija. */

DROP POLICY IF EXISTS "Admins can remove watchers" ON listing_price_watchers;
CREATE POLICY "Admins can remove watchers"
  ON listing_price_watchers FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE OR REPLACE FUNCTION public.price_watcher_flood_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM public.listing_price_watchers
  WHERE listing_id = NEW.listing_id
    AND created_at > now() - interval '1 hour';

  IF recent >= 50 THEN
    RAISE EXCEPTION 'price_watcher_flood'
      USING HINT = 'Za dużo zapisów przy tym ogłoszeniu w ostatniej godzinie.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_price_watcher_flood_guard ON listing_price_watchers;
CREATE TRIGGER trg_price_watcher_flood_guard
  BEFORE INSERT ON listing_price_watchers
  FOR EACH ROW
  EXECUTE FUNCTION public.price_watcher_flood_guard();

/*
  Wypisanie się z linku w mailu. SECURITY DEFINER, bo tabela nie ma polityki
  SELECT ani DELETE dla anonima - i nie powinna mieć. Zwraca true, gdy coś
  faktycznie usunięto, żeby strona mogła odróżnić "wypisano" od "ten link już
  nie działa".
*/
CREATE OR REPLACE FUNCTION public.unsubscribe_price_watch(token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.listing_price_watchers
  WHERE unsubscribe_token = token;

  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_price_watch(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unsubscribe_price_watch(uuid) TO anon, authenticated;
