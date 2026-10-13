/*
  # Codzienna cena dla ogłoszeń, które ktoś oglądał

  Główny przelot (`price-scraper-sweep`, :07) bierze 25 ogłoszeń na godzinę,
  czyli 600 na dobę, przy ~15 900 aktywnych. Każde ogłoszenie dostaje więc nową
  cenę mniej więcej raz na 26 dni. 13 października 8 786 aktywnych ogłoszeń nie
  było sprawdzanych od ponad tygodnia. Dla archiwum to wystarcza, ale osoba,
  która wchodzi na konkretne auto przed zakupem, widzi historię z jednym punktem.

  Tu dokładamy drugą, mniejszą kolejkę: ogłoszenia, którymi ktoś się
  zainteresował (wszedł na stronę w ciągu ostatnich 14 dni, zapisał alert
  mailowy albo dodał do ulubionych), sprawdzamy raz na dobę. Ten sam scraper
  dostaje ją co godzinę o :27 z `{"mode":"watched"}`. Główny przelot nadal
  obsługuje resztę bazy i sam omija te ogłoszenia, bo `last_checked_at`
  przesuwa się przy każdej próbie.

  Gdy zainteresowanych jest więcej niż 600 na dobę, kolejka nie pęka, tylko
  sprawdza je rzadziej niż raz dziennie, zaczynając od najdawniej sprawdzanych.
*/

ALTER TABLE listings ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

/*
  Indeks częściowy obejmuje tylko ogłoszenia, które kiedykolwiek były oglądane,
  więc zostaje mały i nie obciąża zapisów w głównym przelocie.
*/
CREATE INDEX IF NOT EXISTS listings_viewed_due_idx
  ON listings (last_checked_at)
  WHERE is_active AND last_viewed_at IS NOT NULL;

/*
  Wołane z przeglądarki na stronie ogłoszenia. Zapis najwyżej raz na 6 godzin
  na ogłoszenie: przy popularnym aucie każde wejście byłoby inaczej osobnym
  UPDATE-em, a kolejce wystarcza informacja „ktoś tu był w tym tygodniu".

  Nie zapisujemy nic o osobie, tylko znacznik czasu na ogłoszeniu. Nadużycie
  (oznaczenie wszystkich ogłoszeń naraz) niczego nie psuje: kolejka ma stały
  rozmiar partii, więc zamieniłaby się po prostu w drugi zwykły przelot.
*/
CREATE OR REPLACE FUNCTION mark_listing_viewed(p_listing_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.listings
  SET last_viewed_at = now()
  WHERE id = p_listing_id
    AND is_active
    AND (last_viewed_at IS NULL OR last_viewed_at < now() - interval '6 hours');
$$;

REVOKE ALL ON FUNCTION mark_listing_viewed(uuid) FROM public;
GRANT EXECUTE ON FUNCTION mark_listing_viewed(uuid) TO anon, authenticated;

/*
  Kolejka dla scrapera: zainteresowane, aktywne i niesprawdzane od 20 godzin.
  20, a nie 24, bo cron chodzi co godzinę i przy 24 ogłoszenie sprawdzone
  o 10:27 łapałoby się dopiero następnego dnia o 11:27, czyli dryfowało.
*/
CREATE OR REPLACE FUNCTION watched_listings_due(p_limit int)
RETURNS TABLE (id uuid, url text, source text, current_price numeric, specs jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT l.id, l.url, l.source, l.current_price, l.specs
  FROM public.listings l
  WHERE l.is_active
    AND (l.last_checked_at IS NULL OR l.last_checked_at < now() - interval '20 hours')
    AND (
      l.last_viewed_at > now() - interval '14 days'
      OR EXISTS (SELECT 1 FROM public.listing_price_watchers w WHERE w.listing_id = l.id)
      OR EXISTS (SELECT 1 FROM public.favorites f WHERE f.listing_id = l.id)
    )
  ORDER BY l.last_checked_at ASC NULLS FIRST
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION watched_listings_due(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION watched_listings_due(int) TO service_role;

/*
  O :27, czyli między głównym przelotem (:07) a resztą harmonogramu
  (:50 Otodom, dobowe agregaty w nocy), żeby nie schodzić się na jednym
  połączeniu.
*/
SELECT cron.unschedule('watched-price-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watched-price-sweep');

SELECT cron.schedule(
  'watched-price-sweep',
  '27 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/daily-price-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{"mode":"watched"}'::jsonb,
    timeout_milliseconds := 110000
  )
  $cron$
);
