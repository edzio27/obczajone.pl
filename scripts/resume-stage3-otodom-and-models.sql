/*
  Etap 3 i ostatni: powrót zbierania mieszkań i modeli aut.

  Harmonogram po awarii z 28 września - 3 października wracał etapami, po jednym
  kroku na dobę obserwacji. Etap 1 (4 października): ceny i alerty. Etap 2:
  snapshoty, już dobowe zamiast godzinnych. Teraz dwa ostatnie przeloty.

  `otodom-sweep` o :50 i `model-sweep` o 3:20 i 15:20 - godziny z kopii sprzed
  wyłączenia, celowo rozsunięte względem cen o :07, żeby zadania nie schodziły
  się na jednym połączeniu.

  Oba biorą po kilka pozycji z kolejki i nie skanują całych tabel, więc należą
  do tej samej kategorii co przelot cen, który chodzi bez zarzutu od doby.

  Definicje przepisane 1:1 z kopia-cronow-2026-10-01.json.

  Po uruchomieniu harmonogram jest kompletny: 7 zadań, tyle samo co przed
  awarią, z jedną różnicą - snapshoty chodzą raz na dobę, nie co godzinę.
*/

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'otodom-sweep';

SELECT cron.schedule(
  'otodom-sweep',
  '50 * * * *',
  $cron$
SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/sweep-otodom-listings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  $cron$
);

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'model-sweep';

SELECT cron.schedule(
  'model-sweep',
  '20 3,15 * * *',
  $cron$
SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/sweep-model-listings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  $cron$
);

-- Kontrola: ma być siedem zadań, wszystkie aktywne.
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
