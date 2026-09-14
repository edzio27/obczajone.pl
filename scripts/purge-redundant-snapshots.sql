/*
  Usuwa powtórzenia tej samej ceny z historii — te, które powstały, zanim
  wyzwalacz trg_skip_unchanged_snapshot zaczął je pomijać.

  Stan przed uruchomieniem: 31 182 wiersze, z czego 21 446 (68,8%) to zapis
  „cena taka sama jak poprzednio". Zostają pierwsze obserwacje i realne zmiany,
  czyli komplet informacji — szereg cenowy odtwarza się z nich w całości,
  bo punkty pomiędzy zmianami są interpolacją prostej poziomej.

  ZACHOWUJEMY dodatkowo ostatni zapis każdego ogłoszenia, nawet gdy powtarza
  cenę. Dzięki temu nie gubimy informacji, do kiedy dana cena obowiązywała.

  To jest operacja nieodwracalna. Uruchamiać świadomie, najlepiej po zerknięciu
  na wynik zapytania kontrolnego na dole, które pokazuje stan po usunięciu.
*/

BEGIN;

WITH kolejne AS (
  SELECT id, listing_id, price, scraped_at,
         lag(price)  OVER (PARTITION BY listing_id ORDER BY scraped_at) AS poprzednia,
         row_number() OVER (PARTITION BY listing_id ORDER BY scraped_at DESC) AS od_konca
  FROM listing_snapshots
)
DELETE FROM listing_snapshots s
USING kolejne k
WHERE s.id = k.id
  AND k.poprzednia IS NOT NULL
  AND k.poprzednia = k.price
  AND k.od_konca > 1;

COMMIT;

-- Kontrola: powinny zostać wyłącznie pierwsze obserwacje, zmiany i ostatnie zapisy.
SELECT count(*) AS wierszy_po_czyszczeniu,
       pg_size_pretty(pg_total_relation_size('listing_snapshots')) AS rozmiar
FROM listing_snapshots;
