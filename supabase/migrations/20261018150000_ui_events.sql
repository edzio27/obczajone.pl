/*
  # Zapis kliknięć i wejść na strony

  Do 18.10.2026 wiedzieliśmy tylko tyle, ile mówią dwa liczniki: kliknięcia
  w carVertical (5 od 1.10) i w firmy od oględzin (29 od początku, 1 zapytanie).
  Nie wiedzieliśmy, w co ludzie klikają poza tym, które sekcje strony głównej
  ktoś w ogóle rusza ani co robi na stronie ogłoszenia.

  Zapisujemy anonimowo: co kliknięto (podpis albo nazwa elementu), w której
  sekcji, na jakiej stronie i - na stronie ogłoszenia - przy którym ogłoszeniu.
  Bez identyfikatora osoby, bez ciasteczek, bez treści wpisanych w pola; przy
  linkach na zewnątrz tylko domena. Dlatego nie potrzeba zgody na cookies,
  a wystarczy opis w polityce prywatności.

  Zapis jest otwarty dla przeglądarek (jak affiliate_clicks), odczyt tylko dla
  service_role. Strażnik zalewu odrzuca zapisy powyżej 600 na minutę w całym
  serwisie: przy dzisiejszym ruchu to kilkadziesiąt razy więcej niż szczyt,
  a ktoś z pętlą w konsoli nie zapcha dysku.
*/

CREATE TABLE IF NOT EXISTS ui_events (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('click', 'view')),
  page text NOT NULL CHECK (length(page) <= 120),
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  section text CHECK (length(section) <= 60),
  label text CHECK (length(label) <= 80),
  target text CHECK (length(target) <= 160),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ui_events_created_idx ON ui_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ui_events_listing_idx ON ui_events (listing_id) WHERE listing_id IS NOT NULL;

ALTER TABLE ui_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can log a ui event" ON ui_events;
CREATE POLICY "Anyone can log a ui event" ON ui_events FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION ui_events_flood_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.ui_events WHERE created_at > now() - interval '1 minute') >= 600 THEN
    RAISE EXCEPTION 'ui_events_flood';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ui_events_flood ON ui_events;
CREATE TRIGGER ui_events_flood BEFORE INSERT ON ui_events
  FOR EACH ROW EXECUTE FUNCTION ui_events_flood_guard();

-- Pół roku wystarczy do każdego porównania „przed i po”, dłużej nie trzymamy.
SELECT cron.unschedule('prune-ui-events')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-ui-events');
SELECT cron.schedule(
  'prune-ui-events',
  '25 3 * * *',
  $cron$ DELETE FROM ui_events WHERE created_at < now() - interval '180 days'; $cron$
);
