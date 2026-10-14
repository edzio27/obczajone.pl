/*
  # Codzienna cena dla każdego kiedykolwiek oglądanego ogłoszenia

  Do tej pory kolejka `watched-price-sweep` brała ogłoszenia oglądane w ciągu
  ostatnich 14 dni, po 25 raz na godzinę. Dwie zmiany:

  1. Bez okna 14 dni. Ogłoszenie, w które ktoś raz wszedł, dostaje nową cenę
     codziennie, dopóki wisi na Otomoto lub Otodom. 14 października właściciel
     trafił na BMW, które między 14.09 a 9.10 nie było sprawdzane ani razu,
     i nie wiadomo, kiedy stanieło o 30 tys. zł.

  2. Mniejsze porcje, częściej: 10 ogłoszeń co 10 minut zamiast 25 co godzinę.
     To 1440 na dobę zamiast 600, a pojedynczy przebieg trwa ~35 s zamiast ~85.
     Na tej bazie szkodzi skokowość, nie suma (patrz Disk IO w notatkach
     o infrastrukturze), więc rozłożenie pracy jest tańsze od jej zebrania.

  `last_viewed_at` działa od 13 października. Wcześniejsze zainteresowanie
  odtwarzamy jednorazowo z tego, co ludzie zostawili w bazie: ogłoszenie
  wklejone przez zalogowanego, opinia, sygnał „byłem na miejscu”, kliknięcie
  w sprawdzenie VIN. Alerty mailowe i ulubione kolejka sprawdza osobno.
*/

UPDATE listings l
SET last_viewed_at = GREATEST(
  CASE WHEN l.created_by IS NOT NULL THEN l.created_at END,
  (SELECT max(r.created_at) FROM reviews r WHERE r.listing_id = l.id),
  (SELECT max(s.created_at) FROM listing_signals s WHERE s.listing_id = l.id),
  (SELECT max(a.created_at) FROM affiliate_clicks a WHERE a.listing_id = l.id)
)
WHERE l.last_viewed_at IS NULL
  AND (
    l.created_by IS NOT NULL
    OR EXISTS (SELECT 1 FROM reviews r WHERE r.listing_id = l.id)
    OR EXISTS (SELECT 1 FROM listing_signals s WHERE s.listing_id = l.id)
    OR EXISTS (SELECT 1 FROM affiliate_clicks a WHERE a.listing_id = l.id)
  );

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
      l.last_viewed_at IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.listing_price_watchers w WHERE w.listing_id = l.id)
      OR EXISTS (SELECT 1 FROM public.favorites f WHERE f.listing_id = l.id)
    )
  ORDER BY l.last_checked_at ASC NULLS FIRST
  LIMIT p_limit;
$$;

/*
  Minuty 4, 14, ..., 54: między głównym przelotem (:07) a Otodom (:50)
  zostają co najmniej trzy minuty, a przebieg 10 ogłoszeń trwa ~35 s.
*/
SELECT cron.unschedule('watched-price-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watched-price-sweep');

SELECT cron.schedule(
  'watched-price-sweep',
  '4-59/10 * * * *',
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
    body := '{"mode":"watched","limit":10}'::jsonb,
    timeout_milliseconds := 110000
  )
  $cron$
);
