/*
  # Finalna poprawka cron joba dla daily-price-scraper

  ## Co robi ta migracja

  Aktualizuje cron job tak, żeby wywoływał edge funkcję `daily-price-scraper`
  z użyciem anon key. Edge funkcja działa z `verify_jwt = false`, więc
  autoryzacja jest uproszczona — funkcja i tak używa service_role_key
  wewnętrznie do zapisu danych.

  ## Harmonogram

  Codziennie o 03:00 UTC.
*/

-- Usuń stary job
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'daily-price-scraper';

-- Utwórz finalny cron job
SELECT cron.schedule(
  'daily-price-scraper',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sasjatiohbwejsdptaef.supabase.co/functions/v1/daily-price-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhc2phdGlvaGJ3ZWpzZHB0YWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzU4MzEsImV4cCI6MjA4OTcxMTgzMX0.A84bJLBcoNjQ5fLPLhu-YOlTN6kY24omO1THZTn_5g4'
    ),
    body := '{}'::jsonb
  )
  $$
);
