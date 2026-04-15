/*
  # Konfiguracja cron joba dla historii cen

  ## Co robi ta migracja

  Ustawia automatyczne zadanie (cron job) w Supabase, które codziennie o 03:00 UTC
  wywołuje edge funkcję `daily-price-scraper`. Funkcja ta pobiera aktualne ceny
  ze wszystkich ogłoszeń (Otomoto/Otodom) i zapisuje snapshoty do tabeli `listing_snapshots`.

  ## Szczegóły

  1. Włącza rozszerzenie `pg_cron` do zarządzania zadaniami cyklicznymi
  2. Włącza rozszerzenie `pg_net` do wykonywania żądań HTTP z poziomu bazy danych
  3. Usuwa ewentualny stary cron job o tej samej nazwie (idempotentność)
  4. Tworzy nowy cron job:
     - Nazwa: `daily-price-scraper`
     - Harmonogram: codziennie o 03:00 UTC (`0 3 * * *`)
     - Akcja: wywołanie edge funkcji `daily-price-scraper` przez HTTP POST

  ## Wymagania

  - Rozszerzenie `pg_cron` musi być dostępne w instancji Supabase (jest domyślnie)
  - Rozszerzenie `pg_net` musi być dostępne (jest domyślnie w Supabase)
  - Edge funkcja `daily-price-scraper` musi być wdrożona

  ## Bezpieczeństwo

  - Żądanie HTTP używa service role key jako Bearer token
  - Wywołanie jest wewnętrzne — przez Supabase URL projektu
*/

-- Włącz rozszerzenia
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Usuń stary job jeśli istnieje (idempotentność)
SELECT cron.unschedule('daily-price-scraper')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-price-scraper'
);

-- Utwórz cron job wywołujący edge funkcję codziennie o 03:00 UTC
SELECT cron.schedule(
  'daily-price-scraper',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/daily-price-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
