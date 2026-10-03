/*
  Co naprawdę zajmuje dysk i generuje ruch IO.

  Powód powstania: dane w schemacie `public` ważą 6 MB (backup z 1 października:
  16 003 ogłoszenia, 39 831 zapisów cen, 56 387 wierszy razem). Sześciomegabajtowa
  baza nie powinna zabijać żadnej maszyny, nawet t4g.nano - a ta pada przy jednym
  lekkim przelocie na godzinę. To znaczy, że tłumaczenie "percentyle po
  ogłoszeniach wyczerpały budżet IO" jest co najmniej niepełne i szukamy dalej.

  Dwaj podejrzani, obaj poza `public`, więc backup ich nie pokazał:

  1. `cron.job_run_details` - pg_cron dopisuje wiersz przy KAŻDYM uruchomieniu
     zadania i domyślnie nic tego nie kasuje. Pięć zadań co godzinę przez pół roku
     to dziesiątki tysięcy wierszy, które rosną w nieskończoność.

  2. `net._http_response` - pg_net zapisuje tu odpowiedź każdego `net.http_post`.
     Nasze zadania wołają funkcje brzegowe co godzinę, a odpowiedzi zostają.

  Obie tabele są klasycznym źródłem bloatu na Supabase i obie czyści się za
  darmo. Jeśli to one, upgrade compute byłby leczeniem objawu.

  Sprawdzamy też martwe krotki: jeśli autovacuum nie nadążał w trakcie awarii,
  tabela może mieć wielokrotnie więcej martwych wierszy niż żywych i każdy odczyt
  przemiela je po drodze.

  Uruchamiać, gdy tylko baza przyjmie połączenie:
    node scripts/run-sql.mjs scripts/diagnose-disk-io.sql
*/

-- 1. Dwadzieścia największych tabel w CAŁEJ bazie, nie tylko w public.
SELECT
  schemaname || '.' || relname AS tabela,
  pg_size_pretty(pg_total_relation_size(relid)) AS rozmiar_calkowity,
  pg_size_pretty(pg_relation_size(relid))       AS same_dane,
  n_live_tup                                     AS wierszy_zywych,
  n_dead_tup                                     AS wierszy_martwych,
  last_autovacuum
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- 2. Historia uruchomień crona: ile wpisów i od kiedy.
SELECT
  count(*)                       AS wpisow,
  min(start_time)                AS najstarszy,
  max(start_time)                AS najnowszy,
  count(*) FILTER (WHERE status <> 'succeeded') AS nieudanych
FROM cron.job_run_details;

-- 3. Rozkład statusów - jeśli zadania masowo padały, to też jest ślad.
SELECT jobid, status, count(*) AS ile
FROM cron.job_run_details
GROUP BY jobid, status
ORDER BY ile DESC
LIMIT 15;

-- 4. Kolejka odpowiedzi pg_net.
SELECT count(*) AS odpowiedzi_pg_net FROM net._http_response;

-- 5. Rozmiar całej bazy dla porównania z 6 MB z backupu.
SELECT pg_size_pretty(pg_database_size(current_database())) AS cala_baza;

/*
  DOPISANE 3 października 2026, po zobaczeniu metryk z dashboardu.

  Liczby: DISK IO 100%, COMPUTE 100%, CPU 77% - przy instancji, do której nikt
  się nie dostaje i na której nie wykonuje się żaden cron. Coś mieli dysk bez
  jednego zapytania z zewnątrz.

  Rozkład miejsca wskazuje winnego: baza 55,8 MB, a WAL 128 MB. Dziennik zmian
  dwa i pół raza większy niż dane, które opisuje, oznacza, że Postgres nie może
  go sprzątnąć. Najczęstszy powód to porzucony slot replikacji: dopóki slot
  istnieje i nikt z niego nie czyta, serwer trzyma cały WAL od momentu jego
  utworzenia. Rośnie w nieskończoność i generuje ciągły ruch na dysku.

  To tłumaczyłoby rzecz, której nie umiałem wyjaśnić: dlaczego budżet Disk IO
  nie odbudował się przez trzy doby całkowitego bezruchu. Bo bezruchu nie było.
*/

-- 6. Sloty replikacji: nieaktywny slot trzyma WAL i nie pozwala go skasować.
SELECT
  slot_name,
  plugin,
  slot_type,
  active,
  pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS wal_zatrzymany_przez_slot
FROM pg_replication_slots
ORDER BY pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) DESC NULLS LAST;

-- 7. Ile WAL-u leży na dysku i ile plików.
SELECT
  count(*)                                   AS plikow_wal,
  pg_size_pretty(sum(size))                  AS rozmiar_wal
FROM pg_ls_waldir();

-- 8. Ustawienia, które decydują o tym, ile WAL-u serwer zatrzymuje.
SELECT name, setting, unit
FROM pg_settings
WHERE name IN ('wal_keep_size', 'max_slot_wal_keep_size', 'checkpoint_timeout',
               'max_wal_size', 'min_wal_size', 'archive_mode');

-- 9. Transakcje wiszące od dawna też blokują sprzątanie (WAL i martwych krotek).
SELECT pid, state, now() - xact_start AS trwa, left(query, 80) AS zapytanie
FROM pg_stat_activity
WHERE xact_start IS NOT NULL
ORDER BY xact_start
LIMIT 10;
