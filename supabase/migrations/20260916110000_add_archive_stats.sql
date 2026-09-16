/*
  # Statystyki archiwum liczone w bazie

  fetchArchiveStats pobierało wszystkie wygaszone ogłoszenia (1835 wierszy) do
  Node'a, żeby policzyć z nich jedną medianę i jeden licznik. Przy budowaniu,
  gdy 66 stron generuje się równolegle, to wystarczyło, żeby /archiwum-otomoto
  przekroczyło limit trzy razy z rzędu i cały build się wywalił.

  To ta sama pomyłka, którą poprawialiśmy wczoraj w sitemapie: liczenie w Next
  tego, co Postgres zrobi jednym zapytaniem. Na instancji, która w tym miesiącu
  dwa razy zahaczyła o swój sufit, jest to różnica między działającym deployem
  a nieudanym.
*/

CREATE OR REPLACE FUNCTION archive_stats(p_source text DEFAULT NULL)
RETURNS TABLE (
  total bigint,
  dropped bigint,
  median_drop_pct numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE first_price > 0 AND current_price < first_price) AS dropped,
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY 100.0 * (first_price - current_price) / first_price
    ) FILTER (WHERE first_price > 0 AND current_price < first_price)::numeric, 1) AS median_drop_pct
  FROM listings
  WHERE is_active = false
    AND current_price > 0
    AND title <> ''
    AND (p_source IS NULL OR source = p_source);
$$;

GRANT EXECUTE ON FUNCTION archive_stats(text) TO anon, authenticated;
