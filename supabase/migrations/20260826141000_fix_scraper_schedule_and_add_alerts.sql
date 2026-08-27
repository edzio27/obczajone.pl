/*
  # Sweep the whole database, and schedule price-drop alerts

  ## Problem found in production

  89% of listings had not been re-checked in over a week:

      ostatnie 24h:   29
      1-2 dni:        16
      2-7 dni:        61
      ponad 7 dni:   894

  The scraper selected every listing ordered by `created_at DESC` with no limit
  and slept 2 seconds between requests. At ~1600 listings that is 53 minutes of
  work inside an edge function that is killed after well under two. Every run
  therefore processed the newest few dozen listings and died, and the next run
  started from the same place - so older listings were never revisited at all.

  That is most of why price history is so thin, and why the price comparator has
  so little to work with.

  ## Fix

  The function now takes 50 listings per run, oldest-checked first, so runs walk
  through the database instead of circling the newest entries. This schedule
  runs it hourly: 24 x 50 = 1200 listings a day, a full sweep of the current
  database roughly every 1.3 days, at a rate of 50 requests an hour to the
  source site.

  The job is renamed because "daily" is no longer accurate.

  ## Project URL

  The previous cron migration pointed at https://sasjatiohbwejsdptaef.supabase.co,
  which is not this project - this one is tumyxmvbytwizmyqnvgc, confirmed from
  the live REST endpoint and the anon key's `ref` claim. If the old job was
  firing at all, it was firing at someone else's project. Verify afterwards with:

      SELECT jobname, schedule, active FROM cron.job;

  ## Alerts

  `price-drop-alerts` runs once a day at 07:00, after several sweeps have
  refreshed prices overnight. It no-ops harmlessly until RESEND_API_KEY is set,
  so scheduling it now is safe.
*/

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'daily-price-scraper';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'price-scraper-sweep';
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'price-drop-alerts';

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
    body := '{}'::jsonb
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
    body := '{}'::jsonb
  )
  $$
);
