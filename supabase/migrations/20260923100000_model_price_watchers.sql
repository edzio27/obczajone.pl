/*
  # Alert na model, nie na jedno ogłoszenie

  `listing_price_watchers` pilnuje konkretnej oferty i ma wbudowaną datę
  ważności: ogłoszenie znika ze źródła po kilku tygodniach i alert przestaje
  cokolwiek znaczyć. Tymczasem kupujący nie szuka tego jednego egzemplarza,
  tylko auta - i zwykle jest gotów poczekać, aż trafi się tańszy.

  Stąd zapis na model z opcjonalnym pułapem ceny: "daj znać, gdy pojawi się
  Škoda Octavia poniżej 40 000 zł". Taki alert nie wygasa razem z ofertą,
  a przy 36 stronach modelowych ma gdzie stać.

  1. `model_price_watchers`
    - `brand` i `model` przechowujemy tak, jak stoją w `listings.specs`, bo po
      nich szuka zadanie wysyłkowe. Slug jest tylko adresem strony.
    - `max_price` NULL znaczy "każda cena" - wtedy alert mówi o nowych ofertach
      tego modelu, a nie o okazjach.
    - Jeden wiersz na (marka, model, adres): drugie kliknięcie tego samego
      przycisku nie jest nową subskrypcją.

  2. `model_watcher_notifications`
    - Pamięć tego, o czym już napisaliśmy komu. Bez niej każdy przebieg
      wysyłałby ten sam komplet ofert od nowa.
    - Pełni też rolę punktu odniesienia. Świeżo zapisany obserwujący ma zwykle
      kilkadziesiąt pasujących ofert, które wiszą od dawna - wysłanie mu ich
      wszystkich byłoby spamem zamiast alertu. Pierwszy przebieg oznacza je
      jako widziane i nie wysyła nic; dopiero to, co pojawi się później,
      trafia do maila. Ta sama zasada, którą `listing_price_watchers` realizuje
      przez `last_notified_price`.

  3. Bezpieczeństwo - identyczne co przy alertach na ogłoszenie
    - INSERT otwarty dla anon: zapisanie własnego alertu jest sednem.
    - Zero polityk SELECT. To adresy e-mail ludzi bez konta; czyta je wyłącznie
      zadanie wysyłkowe kluczem serwisowym.
    - Wypisanie przez SECURITY DEFINER z tokenem - token kasuje własny wiersz
      i nic poza nim.
    - Flood guard: 50 zapisów na model na godzinę. Formularz bez konta jest
      celem dla spamu, a kosztem nadużycia są maile wychodzące z naszej domeny
      do obcych ludzi.
*/

CREATE TABLE IF NOT EXISTS model_price_watchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  model text NOT NULL,
  max_price numeric,
  email text NOT NULL,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT model_price_watchers_email_shape
    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  CONSTRAINT model_price_watchers_price_sane
    CHECK (max_price IS NULL OR (max_price > 0 AND max_price < 100000000)),
  CONSTRAINT model_price_watchers_one_per_model UNIQUE (brand, model, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_watchers_token
  ON model_price_watchers (unsubscribe_token);

ALTER TABLE model_price_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can watch a model" ON model_price_watchers;
CREATE POLICY "Anyone can watch a model"
  ON model_price_watchers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can remove model watchers" ON model_price_watchers;
CREATE POLICY "Admins can remove model watchers"
  ON model_price_watchers FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE IF NOT EXISTS model_watcher_notifications (
  watcher_id uuid NOT NULL REFERENCES model_price_watchers(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  sent_at timestamptz DEFAULT now(),
  PRIMARY KEY (watcher_id, listing_id)
);

ALTER TABLE model_watcher_notifications ENABLE ROW LEVEL SECURITY;
-- Bez polityk: wyłącznie zadanie wysyłkowe, kluczem serwisowym.

CREATE OR REPLACE FUNCTION public.model_watcher_flood_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM public.model_price_watchers
  WHERE brand = NEW.brand AND model = NEW.model
    AND created_at > now() - interval '1 hour';

  IF recent >= 50 THEN
    RAISE EXCEPTION 'model_watcher_flood';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS model_watcher_flood ON model_price_watchers;
CREATE TRIGGER model_watcher_flood
  BEFORE INSERT ON model_price_watchers
  FOR EACH ROW EXECUTE FUNCTION public.model_watcher_flood_guard();

/*
  Wypisanie obsługuje teraz oba rodzaje alertu.

  Token z maila jest jedyną rzeczą, jaką ma w ręku odbiorca, i nie wie, którego
  rodzaju dotyczy - ani nie powinien. Funkcja próbuje obu tabel i mówi, czy
  cokolwiek skasowała.
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
  DELETE FROM public.listing_price_watchers WHERE unsubscribe_token = token;
  GET DIAGNOSTICS removed = ROW_COUNT;

  IF removed = 0 THEN
    DELETE FROM public.model_price_watchers WHERE unsubscribe_token = token;
    GET DIAGNOSTICS removed = ROW_COUNT;
  END IF;

  RETURN removed > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_price_watch(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unsubscribe_price_watch(uuid) TO anon, authenticated;

/*
  Oferty, o których trzeba komuś powiedzieć.

  Zwraca pary (obserwujący, ogłoszenie) jeszcze nieodnotowane w
  `model_watcher_notifications`, wraz z informacją, czy dla tego obserwującego
  to pierwszy przebieg - bo wtedy zamiast maila oznaczamy je jako widziane.

  Liczy baza, nie funkcja brzegowa: przy 14 tysiącach ogłoszeń dobieranie ich
  po stronie Deno oznaczałoby ściąganie całej tabeli raz na obserwującego.
*/
CREATE OR REPLACE FUNCTION public.pending_model_alerts()
RETURNS TABLE (
  watcher_id uuid,
  email text,
  unsubscribe_token uuid,
  brand text,
  model text,
  max_price numeric,
  is_first_run boolean,
  listing_id uuid,
  title text,
  current_price numeric,
  location text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    w.id, w.email, w.unsubscribe_token, w.brand, w.model, w.max_price,
    NOT EXISTS (SELECT 1 FROM model_watcher_notifications n WHERE n.watcher_id = w.id),
    l.id, l.title, l.current_price, l.location
  FROM model_price_watchers w
  JOIN listings l
    ON l.is_active
   AND l.current_price > 0
   AND l.title <> ''
   AND btrim(coalesce(l.specs->>'brand', '')) = w.brand
   AND btrim(coalesce(l.specs->>'model', '')) = w.model
   AND (w.max_price IS NULL OR l.current_price <= w.max_price)
  WHERE NOT EXISTS (
    SELECT 1 FROM model_watcher_notifications n
    WHERE n.watcher_id = w.id AND n.listing_id = l.id
  )
  ORDER BY w.id, l.current_price ASC;
$$;

REVOKE ALL ON FUNCTION public.pending_model_alerts() FROM public, anon, authenticated;
