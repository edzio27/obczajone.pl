/*
  Przywraca zadania cykliczne wyłączone przez pause-scraper-crons.sql.

  Godziny są te same co wcześniej i celowo rozsunięte, żeby trzy zadania nie
  schodziły się na jednym połączeniu do bazy: :07 co godzinę, 3:20 i 15:20,
  7:00. Wpis dla Otodomu jest tu pominięty - zakłada go własna migracja razem
  z tabelą kolejki.

  timeout_milliseconds jest przy każdym wywołaniu obowiązkowy: bez niego pg_net
  zrywa połączenie po pięciu sekundach, cron melduje sukces, a przebieg ginie
  po dwóch pozycjach i nikt się o tym nie dowiaduje.

  Uruchamiać dopiero wtedy, gdy baza odpowiada normalnie, a wykres Disk IO
  wrócił do poziomu sprzed problemu.
*/

SELECT cron.schedule(
  'price-scraper-sweep',
  '7 * * * *',
  $$
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
  $$
);

SELECT cron.schedule(
  'model-sweep',
  '20 3,15 * * *',
  $$
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
  $$
);

SELECT cron.schedule(
  'price-drop-alerts',
  '0 7 * * *',
  $$
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
  $$
);

SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
