/*
  # Liczby do raportu o obniżkach cen

  Strona /dla-mediow podaje dane, które mają być cytowane w prasie, więc nie mogą
  być przepisane do kodu i powoli się starzeć - dziennikarz wraca po nie za miesiąc
  i musi dostać stan z dzisiaj, a nie z dnia, w którym pisaliśmy stronę.

  Liczy baza i oddaje jeden wiersz - ta sama zasada co przy city_price_stats
  i barometrze, i z tego samego powodu: 7 września liczenie median w Next
  wyczerpało budżet Disk IO tej instancji.

  Próg czternastu dni jest sednem metodologii, a nie szczegółem. W całej bazie
  cenę obniżyło 12.8% aut, ale połowa ofert przewija się przez nasze pomiary
  w niecałe sześć dni - za krótko, żeby ktokolwiek zdążył się rozmyślić. Liczba
  policzona bez tego progu mierzy głównie to, jak długo patrzyliśmy.
*/

CREATE OR REPLACE FUNCTION price_drop_report(min_days integer DEFAULT 14)
RETURNS TABLE (
  source text,
  watched bigint,
  dropped bigint,
  dropped_pct numeric,
  median_drop_pct numeric,
  median_drop_pln numeric,
  multi_drop bigint,
  snapshots bigint,
  observed_days integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH baza AS (
    SELECT l.source, l.id, l.first_price, l.current_price
    FROM listings l
    WHERE l.first_price > 0
      AND l.current_price > 0
      AND l.last_checked_at - l.first_seen_at >= make_interval(days => min_days)
  ),
  wiele AS (
    SELECT l.source, count(*) AS n
    FROM (
      SELECT l.id, l.source
      FROM listings l
      JOIN listing_snapshots s ON s.listing_id = l.id
      GROUP BY l.id, l.source
      HAVING count(DISTINCT s.price) >= 3
    ) l
    GROUP BY l.source
  )
  SELECT
    b.source,
    count(*) AS watched,
    count(*) FILTER (WHERE b.current_price < b.first_price) AS dropped,
    round(100.0 * count(*) FILTER (WHERE b.current_price < b.first_price) / count(*), 1) AS dropped_pct,
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY 100.0 * (b.first_price - b.current_price) / b.first_price
    ) FILTER (WHERE b.current_price < b.first_price)::numeric, 1) AS median_drop_pct,
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY b.first_price - b.current_price
    ) FILTER (WHERE b.current_price < b.first_price)::numeric) AS median_drop_pln,
    coalesce((SELECT n FROM wiele w WHERE w.source = b.source), 0) AS multi_drop,
    (SELECT count(*) FROM listing_snapshots) AS snapshots,
    (SELECT extract(day FROM now() - min(first_seen_at))::int FROM listings) AS observed_days
  FROM baza b
  GROUP BY b.source;
$$;

GRANT EXECUTE ON FUNCTION price_drop_report(integer) TO anon, authenticated;
