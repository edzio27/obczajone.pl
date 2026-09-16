/*
  # Obniżki model po modelu, na potrzeby raportu dla mediów

  Osobno od price_drop_report, bo odpowiada na inne pytanie i ma inny próg.
  Tamta funkcja mówi, jak zachowuje się rynek; ta - czym różnią się od siebie
  modele, a to twierdzenie wymaga większej ostrożności.

  Stąd dwa progi naraz: oferta musi być obserwowana co najmniej `min_days` dni
  (inaczej mierzymy własną krótkowzroczność), a model mieć co najmniej
  `min_sample` takich ofert. Przy piętnastu sztukach różnica między 38% a 31%
  jest szumem i prasa zrobiłaby z niej ranking, którego dane nie niosą.
*/

CREATE OR REPLACE FUNCTION model_drop_report(
  min_days integer DEFAULT 14,
  min_sample integer DEFAULT 20
)
RETURNS TABLE (
  brand text,
  model text,
  watched bigint,
  dropped bigint,
  dropped_pct numeric,
  median_drop_pct numeric,
  median_drop_pln numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH baza AS (
    SELECT
      btrim(specs->>'brand') AS brand,
      btrim(specs->>'model') AS model,
      first_price,
      current_price
    FROM listings
    WHERE source = 'otomoto'
      AND first_price > 0
      AND current_price > 0
      AND last_checked_at - first_seen_at >= make_interval(days => min_days)
      AND btrim(coalesce(specs->>'brand', '')) <> ''
      AND btrim(coalesce(specs->>'model', '')) <> ''
  )
  SELECT
    b.brand,
    b.model,
    count(*) AS watched,
    count(*) FILTER (WHERE b.current_price < b.first_price) AS dropped,
    round(100.0 * count(*) FILTER (WHERE b.current_price < b.first_price) / count(*), 0) AS dropped_pct,
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY 100.0 * (b.first_price - b.current_price) / b.first_price
    ) FILTER (WHERE b.current_price < b.first_price)::numeric, 1) AS median_drop_pct,
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY b.first_price - b.current_price
    ) FILTER (WHERE b.current_price < b.first_price)::numeric) AS median_drop_pln
  FROM baza b
  GROUP BY b.brand, b.model
  HAVING count(*) >= min_sample
  ORDER BY count(*) FILTER (WHERE b.current_price < b.first_price)::numeric / count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION model_drop_report(integer, integer) TO anon, authenticated;
