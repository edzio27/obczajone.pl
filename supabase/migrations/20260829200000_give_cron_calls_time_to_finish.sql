/*
  # Let the scheduled calls run longer than five seconds

  ## Problem found in production

  The sweep was scheduled, active, and reported success every hour - and did
  almost nothing. cron.job_run_details showed `succeeded` at :07 from 13:07
  through 19:07, but net._http_response told the real story:

      status_code   error_msg
      NULL          Timeout of 5000 ms reached. Total time: 5000.556000 ms
      NULL          Timeout of 5000 ms reached. Total time: 5001.882000 ms
      ...

  `succeeded` in cron only means the SQL statement ran, i.e. pg_net accepted the
  request. Whether a response ever came back is recorded separately, and it
  never did: pg_net's default timeout is 5 seconds, while a sweep of 50 listings
  with a 2 second pause between them needs at least 100.

  So every hour the connection was cut after five seconds, the run was killed
  two listings in, and nothing anywhere reported a failure. Over two hours
  exactly one listing was refreshed.

  ## Fix

  Both jobs now pass an explicit timeout. The sweep gets 110 seconds, which sits
  above the ~85 seconds a batch of 25 needs (the batch was reduced from 50 in
  the same change) and below the edge function's own wall-clock limit. Alerts
  get 60 seconds, which is ample for sending mail and leaves room if a run has a
  lot of recipients.

  ## Verification

  After the next :07, this should show a real status rather than NULL:

      SELECT status_code, error_msg, created
      FROM net._http_response ORDER BY created DESC LIMIT 5;

  And the sweep should start moving through the backlog:

      SELECT count(*) FROM listings
      WHERE last_checked_at > now() - interval '2 hours';
*/

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
    body := '{}'::jsonb,
    timeout_milliseconds := 110000
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
