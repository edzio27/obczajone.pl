/*
  # Poprawka cron joba — użycie hardcoded URL projektu

  ## Co robi ta migracja

  Zastępuje poprzedni cron job poprawioną wersją, która używa bezpośrednio
  URL projektu Supabase zamiast `current_setting`. Wywołuje edge funkcję
  `daily-price-scraper` codziennie o 03:00 UTC.

  ## Uwagi

  - `pg_net.http_post` wykonuje żądanie asynchronicznie
  - Wyniki wywołania można sprawdzić w tabeli `net._http_response`
  - Service role key jest potrzebny do autoryzacji edge funkcji
*/

-- Usuń stary job
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'daily-price-scraper';

-- Utwórz nowy cron job z bezpośrednim URL projektu
SELECT cron.schedule(
  'daily-price-scraper',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sasjatiohbwejsdptaef.supabase.co/functions/v1/daily-price-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  )
  $$
);
