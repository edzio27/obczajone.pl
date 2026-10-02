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
