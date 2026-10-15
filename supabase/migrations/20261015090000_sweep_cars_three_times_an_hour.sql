/*
  # Auta trzy razy na godzinę, mieszkania osobno i rzadziej

  15 października 5116 z 7612 aktywnych ogłoszeń Otomoto (67%) nie było
  sprawdzanych od ponad tygodnia. Etykieta „aktualne” kłamała dla dwóch aut
  na trzy: Ford Focus wisiał na stronie głównej jako największa obniżka
  jeszcze 11 dni po tym, jak zniknął z Otomoto.

  Przyczyna: jeden przelot po 25 ogłoszeń na godzinę dzielony między ~7600 aut
  i ~8600 mieszkań, czyli okrążenie co ~27 dni. Ruch z Google dotyczy aut.

  Teraz:
    auta        :07, :27, :47  po 25  →  1800/dobę, okrążenie ~4 dni
    mieszkania  :37 co 2 h     po 25  →   300/dobę
    oglądane    :04, :14, ...  po 10  →  bez zmian
    Otodom (nowe oferty) :50          →  bez zmian

  Żaden przebieg nie zachodzi na inny: przelot 25 ogłoszeń trwa ~85 s,
  oglądanych ~35 s.
*/

SELECT cron.unschedule('price-scraper-sweep')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'price-scraper-sweep');

SELECT cron.unschedule('price-scraper-sweep-flats')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'price-scraper-sweep-flats');

SELECT cron.schedule(
  'price-scraper-sweep',
  '7,27,47 * * * *',
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
    body := '{"source":"otomoto"}'::jsonb,
    timeout_milliseconds := 110000
  )
  $cron$
);

SELECT cron.schedule(
  'price-scraper-sweep-flats',
  '37 */2 * * *',
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
    body := '{"source":"otodom"}'::jsonb,
    timeout_milliseconds := 110000
  )
  $cron$
);
