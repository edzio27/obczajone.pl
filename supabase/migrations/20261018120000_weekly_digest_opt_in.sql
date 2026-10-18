/*
  # Zgoda na cotygodniowe podsumowanie

  Planowaliśmy poniedziałkowy mail „co potaniało i co nowego w tym modelu”.
  18 października okazało się, że nie ma do kogo go wysłać: alert na model
  (od 23.09) ma 0 zapisów, alert na ogłoszenie 22 od 16 osób. Te osoby
  zapisały się na „daj znać, gdy cena tego auta spadnie”. Mail z innymi autami
  to inna wiadomość, więc nie dopisujemy ich z automatu - podsumowanie jest
  na wyraźne „tak”:

    - pole w formularzach (domyślnie odznaczone),
    - link „włącz podsumowanie” w mailach z alertem, dla tych, którzy już są.

  Sama wysyłka przyjdzie, gdy zbierze się kilkanaście zgód. Kolumna zapisuje
  też, od kiedy ktoś się zgodził - przy zgodzie na wiadomość warto umieć to
  pokazać.
*/

ALTER TABLE listing_price_watchers
  ADD COLUMN IF NOT EXISTS weekly_digest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_digest_since timestamptz;

ALTER TABLE model_price_watchers
  ADD COLUMN IF NOT EXISTS weekly_digest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_digest_since timestamptz;

-- Datę zgody ustawia baza, nie przeglądarka: formularz bez konta może wysłać
-- dowolne pole, a data zgody ma być prawdziwa.
CREATE OR REPLACE FUNCTION stamp_weekly_digest_consent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.weekly_digest THEN
    IF TG_OP = 'INSERT' OR NOT OLD.weekly_digest THEN
      NEW.weekly_digest_since := now();
    END IF;
  ELSE
    NEW.weekly_digest_since := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_watchers_digest_consent ON listing_price_watchers;
CREATE TRIGGER listing_watchers_digest_consent
  BEFORE INSERT OR UPDATE OF weekly_digest ON listing_price_watchers
  FOR EACH ROW EXECUTE FUNCTION stamp_weekly_digest_consent();

DROP TRIGGER IF EXISTS model_watchers_digest_consent ON model_price_watchers;
CREATE TRIGGER model_watchers_digest_consent
  BEFORE INSERT OR UPDATE OF weekly_digest ON model_price_watchers
  FOR EACH ROW EXECUTE FUNCTION stamp_weekly_digest_consent();

/*
  Włączenie podsumowania linkiem z maila. Ten sam token co przy wypisaniu:
  zna go tylko adresat, a funkcja zmienia wyłącznie jego wiersz.
*/
CREATE OR REPLACE FUNCTION enable_weekly_digest(token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  changed integer := 0;
  n integer;
BEGIN
  UPDATE public.listing_price_watchers SET weekly_digest = true WHERE unsubscribe_token = token;
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;
  UPDATE public.model_price_watchers SET weekly_digest = true WHERE unsubscribe_token = token;
  GET DIAGNOSTICS n = ROW_COUNT;
  changed := changed + n;
  RETURN changed > 0;
END;
$$;

REVOKE ALL ON FUNCTION enable_weekly_digest(uuid) FROM public;
GRANT EXECUTE ON FUNCTION enable_weekly_digest(uuid) TO anon, authenticated;
