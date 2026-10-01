/*
  Etap 1 powrotu po awarii z 28 września - 1 października 2026.

  Instancja leżała trzy doby (wyczerpany budżet Disk IO), a 1 października
  wszystkie siedem zadań zostało wyłączonych, żeby nie uderzyły w nią w chwili,
  gdy wstawała. Wracamy etapami, po jednym kroku na dobę obserwacji - inaczej
  nawrót nie powie, które zadanie zawiniło. Ta zasada wzięła się z wcześniejszych
  padów, kiedy wznawialiśmy wszystko naraz i nie dawało się niczego wskazać.

  Etap 1 to dwa zadania i oba są lekkie:
    - `price-scraper-sweep` (:07) - rdzeń serwisu, bez niego nie zbieramy historii
      cen, czyli jedynej rzeczy, której nie da się odtworzyć z żadnego źródła.
      Przelot bierze 1-2 pozycje z kolejki, nie skanuje całych tabel.
    - `send-price-alerts` (7:15) - raz na dobę, czyta garść obserwowanych ofert.
      Ludzie zapisali się na te alerty i od 28 września nic nie dostają.

  Czego tu celowo NIE ma: trzech odświeżeń snapshotów. To one wyczerpały budżet
  IO (72 ciężkie przeloty na dobę z percentylami) i wracają osobno, już
  w wersji dobowej - scripts/reduce-disk-io.sql.

  Definicje przepisane 1:1 z kopia-cronow-2026-10-01.json, spisanej tuż przed
  wyłączeniem. timeout_milliseconds jest obowiązkowy: bez niego pg_net zrywa
  połączenie po pięciu sekundach, cron melduje sukces, a przebieg ginie po
  dwóch pozycjach i nikt się o tym nie dowiaduje.
*/

SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('price-scraper-sweep', 'send-price-alerts');

SELECT cron.schedule(
  'price-scraper-sweep',
  '7 * * * *',
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
    body := '{}'::jsonb,
    timeout_milliseconds := 110000
  )
  $cron$
);

SELECT cron.schedule(
  'send-price-alerts',
  '15 7 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/send-price-alerts',
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

-- Kontrola: mają być dokładnie dwa zadania, oba aktywne.
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
