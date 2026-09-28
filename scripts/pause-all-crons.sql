/*
  Wyłącza WSZYSTKIE zadania cykliczne, nie tylko scrapera.

  Powstało 28 września 2026, gdy instancja bazy przeszła w stan Unhealthy
  i nie wstała po restarcie. Powód jest konkretny: pg_cron żyje w bazie, więc
  w czasie awarii zadania i tak nie chodzą - ale w chwili, gdy baza wstanie,
  ruszają wszystkie naraz, razem z zaległymi przelotami. Instancja, która
  dopiero co nie dawała rady, dostaje wtedy pełne obciążenie w pierwszej
  minucie życia. Ten skrypt daje jej wstać spokojnie.

  NAJPIERW zrób spis, bo to kasuje wpisy bezpowrotnie:
    node scripts/run-sql.mjs scripts/list-crons.sql > kopia-cronow.txt
    node scripts/run-sql.mjs scripts/pause-all-crons.sql

  Przywracanie: scripts/resume-scraper-crons.sql wraca tylko trzy przeloty
  scrapera. Snapshoty (:35, :45, :55) i alerty (7:15) trzeba odtworzyć
  z kopia-cronow.txt - dlatego ten spis nie jest opcjonalny.
*/
SELECT cron.unschedule(jobid) FROM cron.job;

-- Kontrola: po wykonaniu ma zwrócić zero wierszy.
SELECT jobid, jobname FROM cron.job;
