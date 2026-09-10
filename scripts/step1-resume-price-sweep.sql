/*
  KROK 1 z trzech: wraca sam godzinowy sweep cen. Nic więcej.

  Po awarii wracamy pojedynczo, bo przy włączeniu wszystkiego naraz nawrót
  problemu nie powiedziałby nam, które zadanie go wywołało — a to jest jedyna
  informacja, po którą tu w ogóle wracamy.

  To zadanie jest pierwsze, bo jest najlżejsze i najstarsze: 25 ogłoszeń na
  przebieg, jeden przebieg na godzinę, i chodziło tak przez tygodnie, zanim
  cokolwiek zaczęło się psuć.

  Po wykonaniu: zostaw na dobę i patrz na wykres Disk IO. Jeśli zostanie
  nisko — wtedy krok 2 (przelot po modelach w drobnych porcjach).
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

-- Kontrola: powinno być dokładnie jedno zadanie, price-scraper-sweep.
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
