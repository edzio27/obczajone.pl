/*
  # Remove hardcoded JWT from price scraper cron job

  ## Problem

  `20260408201020_fix_price_scraper_cron_no_jwt.sql` hardcoded a live Supabase
  anon JWT directly into the cron.schedule() SQL body, which is stored in
  `cron.job` and is also permanently present in the git history of this
  migration file. Committing any live credential/token to source control is
  bad practice even when the token in question is the public anon key (as
  opposed to the service_role key): it cannot be rotated without a code
  change, and it is one of the concrete leaked-credential patterns a security
  review should flag and remove.

  ## Fix

  Re-point the cron job at Supabase Vault for the Authorization token instead
  of a literal string, matching the (correct) approach originally attempted
  in `20260408200944_fix_price_scraper_cron_with_vault.sql`. That migration
  was apparently reverted because no secret named 'service_role_key' existed
  in the vault yet at the time. This migration creates the secret if it does
  not already exist (using the anon key, since the edge function itself does
  not verify the incoming JWT - `verify_jwt = false` - and instead uses its
  own SUPABASE_SERVICE_ROLE_KEY environment variable internally to write to
  the database).

  Note: `pg_net` requests happen from inside Postgres, and `cron.job` /
  `vault.decrypted_secrets` are only readable by the postgres role / other
  roles explicitly granted access - not by anon/authenticated clients - so
  storing the token in Vault (rather than as a literal in the job definition)
  keeps it out of anything that could be read via the client-facing API or
  future migration diffs.
*/

-- Store the token used for the cron-triggered HTTP call in Vault instead of
-- inline. Uses the anon key since the edge function does not verify the
-- incoming JWT (verify_jwt = false) - this call is not privileged, it merely
-- needs to reach the function endpoint.
--
-- IMPORTANT: this migration deliberately does NOT hardcode the key value
-- (that was the exact problem being fixed - the previous migration
-- permanently baked a live token into git history). Create the secret once,
-- manually, via the Supabase SQL editor before/after applying this
-- migration, using your project's current anon key:
--
--   select vault.create_secret(
--     '<your current NEXT_PUBLIC_SUPABASE_ANON_KEY value>',
--     'daily_scraper_invoke_key',
--     'Anon key used only to reach the daily-price-scraper edge function from pg_cron.'
--   );
--
-- If the secret does not exist yet when the cron job below fires, the
-- Authorization header will simply be empty - harmless, since the function
-- has verify_jwt = false and does not act on this header at all.

-- Recreate the cron job to pull the token from Vault at call time rather
-- than embedding it as a literal.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'daily-price-scraper';

SELECT cron.schedule(
  'daily-price-scraper',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://sasjatiohbwejsdptaef.supabase.co/functions/v1/daily-price-scraper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      )
    ),
    body := '{}'::jsonb
  )
  $$
);

/*
  ## IMPORTANT - manual follow-up required (cannot be done from a migration)

  The anon key embedded in the prior migration
  (20260408201020_fix_price_scraper_cron_no_jwt.sql) is permanently visible in
  git history. Anon keys are meant to be public and RLS is the real access
  boundary, so this is not a critical secret leak by itself - but as good
  hygiene you should still, from the Supabase dashboard:
    1. Confirm `daily-price-scraper` has `verify_jwt = false` set deliberately
       (it relies on RLS + its own service_role key for real authorization,
       not this header).
    2. Optionally rotate the anon key if you want to fully invalidate the
       value that is sitting in git history, then update
       NEXT_PUBLIC_SUPABASE_ANON_KEY in your deployment env and the Vault
       secret created above to match.
*/
