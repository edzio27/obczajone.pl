/*
  # price_drop_report bez skanowania całej historii cen

  Pierwsza wersja nie mieściła się w ośmiu sekundach, które PostgREST daje
  zapytaniu ("canceling statement due to statement timeout"), więc strona
  /dla-mediow prerenderowała się bez ani jednej liczby.

  Winne było podzapytanie liczące oferty z więcej niż jedną obniżką: szło przez
  wszystkie 32 tysiące zapisanych stanów cen i grupowało je po ogłoszeniu -
  niezależnie od tego, że sam raport mówi wyłącznie o ofertach obserwowanych co
  najmniej dwa tygodnie, czyli o ułamku tego zbioru.

  Teraz liczy to samo, ale wyłącznie dla ofert z próby. Przy okazji znika
  niespójność, której pierwsza wersja nawet nie nazywała: "187 aut obniżyło cenę
  więcej niż raz" pochodziło z całej bazy i stało obok odsetka policzonego
  z próby. Dwie liczby z dwóch różnych zbiorów, podane obok siebie jako opis
  jednego zjawiska - dokładnie ten błąd, przed którym ostrzega metodologia
  na samej stronie.
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
    SELECT l.id, l.source, l.first_price, l.current_price
    FROM listings l
    WHERE l.first_price > 0
      AND l.current_price > 0
      AND l.last_checked_at - l.first_seen_at >= make_interval(days => min_days)
  ),
  -- Tylko oferty z próby, a nie cała tabela snapshotów: indeks na
  -- (listing_id, scraped_at DESC) obsługuje to jako serię lookupów.
  wiele AS (
    SELECT b.source, count(*) AS n
    FROM (
      SELECT b.id, b.source
      FROM baza b
      JOIN listing_snapshots s ON s.listing_id = b.id
      GROUP BY b.id, b.source
      HAVING count(DISTINCT s.price) >= 3
    ) b
    GROUP BY b.source
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
