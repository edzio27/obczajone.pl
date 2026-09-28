/*
  Spis wszystkich zadań cyklicznych - do uruchomienia PRZED pause-all-crons.sql.

  Wyłączenie kasuje wpisy z cron.job bezpowrotnie, a część z nich (snapshoty,
  alerty) zakładały migracje rozsiane po historii repo. Bez tego spisu
  przywrócenie ich oznacza szukanie po plikach i zgadywanie godzin.

  Wynik zapisać do pliku:
    node scripts/run-sql.mjs scripts/list-crons.sql > kopia-cronow.txt
*/
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobname;
