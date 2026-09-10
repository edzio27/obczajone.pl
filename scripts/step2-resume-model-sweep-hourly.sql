/*
  KROK 2 z trzech: wraca przelot po modelach — co godzinę, po dwie pozycje.

  Uruchamiać dopiero wtedy, gdy krok 1 przechodził dobę bez wzrostu Disk IO,
  ORAZ po wdrożeniu poprawionej funkcji (QUEUE_BATCH = 2). W odwrotnej
  kolejności pierwszy przebieg wziąłby 40 pozycji ze starej wersji, czyli
  dokładnie to, przed czym uciekamy.

  Co się zmienia wobec poprzedniego harmonogramu:

    było:  3:20 i 15:20, po ~23 pozycje  →  ~740 zapisów w dwie minuty
    jest:  co godzinę o :20, po 2        →  ~64 zapisy na przebieg

  Suma dobowa rośnie z 45 pozycji do 48, więc pokrycie nie maleje. Maleje
  szczyt — mniej więcej dziesięciokrotnie, i to jest cały sens tej zmiany.
  Instancja t4g.nano rozlicza Disk IO kredytami, więc koszt bierze się ze
  skokowości, a nie z sumy.

  Minuta :20 jest wybrana tak, żeby nie schodzić się z :07 (sweep cen).
*/

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'model-sweep';

SELECT cron.schedule(
  'model-sweep',
  '20 * * * *',
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
    timeout_milliseconds := 60000
  )
  $$
);

-- Kontrola: dwa zadania, price-scraper-sweep o :07 i model-sweep o :20.
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
