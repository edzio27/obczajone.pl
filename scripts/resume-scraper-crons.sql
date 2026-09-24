/*
  UWAGA na symetrię z pause-scraper-crons.sql.

  Do 24 września ta para była niesymetryczna: pauza wyłączała `otodom-sweep`,
  a wznowienie go nie włączało. Każde użycie obu skryptów po cichu kasowało
  zbieranie mieszkań i wychodziło to na jaw dopiero wtedy, gdy ktoś porównał
  listy. Dopisując tu przelot, dopisz go też tam - i odwrotnie.

  Alerty cenowe mają własny wpis (`send-price-alerts`, 7:15) założony migracją
  i nie należą do tej pary. Wcześniej stał tu `price-drop-alerts` wołający tę
  samą funkcję, co po wznowieniu dawało dwa zadania robiące to samo.
*/
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
  'otodom-sweep',
  '50 * * * *',
  $$
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
  $$
);

SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
