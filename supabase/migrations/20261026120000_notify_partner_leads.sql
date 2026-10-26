/*
  # Mail do firmy o nowym zapytaniu

  Do dziś zapytanie z formularza trafiało tylko do `partner_leads`, a firma
  widziała je wyłącznie w panelu partnera - do którego połowa firm nie ma
  konta. Wysyłkę robi funkcja `notify-partner-leads`; tu jest to, co ją woła.

  - `notified_at` mówi, czy mail już poszedł. Funkcja ustawia je przed
    wysyłką (zajęcie) i zdejmuje, gdy Resend odmówi.
  - Trigger po INSERT woła funkcję od razu, przez pg_net, czyli bez czekania:
    zapis zapytania nie może się wywrócić przez pocztę.
  - Cron co kwadrans ponawia, ale tylko gdy coś czeka - przez większość doby
    nie robi nic poza jednym zapytaniem do małej tabeli.
*/

ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS notified_at timestamptz;

/*
  Zapytania sprzed tej zmiany oznaczamy jako obsłużone, żeby po wdrożeniu nie
  poszły do firm z opóźnieniem. Dotyczy to jednego zapytania z 13.10 do GCC -
  jeśli ma jeszcze trafić do firmy, to świadomie, a nie przy okazji migracji.
*/
UPDATE partner_leads SET notified_at = created_at WHERE notified_at IS NULL;

CREATE OR REPLACE FUNCTION public.notify_partner_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/notify-partner-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Poczta nie może zablokować zapisu zapytania; cron spróbuje później.
  RAISE WARNING 'notify_partner_lead: %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_partner_lead ON partner_leads;
CREATE TRIGGER trg_notify_partner_lead
  AFTER INSERT ON partner_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_partner_lead();

SELECT cron.unschedule('notify-partner-leads')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-partner-leads');

SELECT cron.schedule(
  'notify-partner-leads',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/notify-partner-leads',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  WHERE EXISTS (
    SELECT 1 FROM public.partner_leads
    WHERE notified_at IS NULL AND created_at > now() - interval '7 days'
  )
  $cron$
);
