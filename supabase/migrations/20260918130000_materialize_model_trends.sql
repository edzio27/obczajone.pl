/*
  # Trendy modeli liczone w bazie i zapisywane raz na godzinę

  Build przestał przechodzić: 32 strony przekroczyły limit, a
  /ile-spada-cena/mercedes-benz-klasa-e wywalił go po trzech próbach.

  Przyczyna nie była w tych stronach, tylko w tym, jak pobierały dane.
  `fetchModelTrend(slug)` wołało `fetchModelTrends()`, które ściąga do Node'a
  wszystkie żywe ogłoszenia i grupuje je w pamięci - osobno dla każdej z 36
  stron modelowych. Przy 9287 ogłoszeniach to ponad 330 tysięcy wierszy
  przeciąganych w jednym budowaniu.

  Dwa dni temu to jeszcze przechodziło. Scraper dokłada ~600 ogłoszeń dziennie,
  więc próg został przekroczony sam z siebie i będzie przekraczany dalej.

  To ten sam wzorzec, który usuwaliśmy 16 września z sitemapy i z raportu dla
  mediów. Wtedy przy sitemapie zrobiliśmy obejście (`fetchModelSlugs` zamiast
  pełnych trendów) i zostawiliśmy źródło nietknięte - stąd nawrót. Teraz liczy
  baza, a wynik czeka gotowy w tabeli.

  Logika przepisana wiernie z price-trends.ts, łącznie z dwoma progami:
  model musi mieć `min_sample` ogłoszeń, żeby w ogóle dostać stronę, a mediana
  obniżki pokazuje się dopiero przy `min_drops` przecenach - bo mediana z jednej
  obserwacji opisuje tę obserwację, a nie model.
*/

CREATE OR REPLACE FUNCTION model_trends_full(
  min_sample integer DEFAULT 30,
  min_drops integer DEFAULT 3
)
RETURNS TABLE (
  brand text,
  model text,
  sample_size bigint,
  median_price numeric,
  dropped_count bigint,
  median_drop_percent numeric,
  median_drop_pln numeric,
  biggest_drop_listing_id uuid,
  biggest_drop_title text,
  biggest_drop_from numeric,
  biggest_drop_to numeric,
  median_days_listed numeric
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
      id, title, current_price, first_price, first_seen_at, last_checked_at
    FROM listings
    WHERE is_active
      AND current_price > 0
      AND btrim(coalesce(specs->>'brand', '')) <> ''
      AND btrim(coalesce(specs->>'model', '')) <> ''
  ),
  modele AS (
    SELECT brand, model, count(*) AS sample_size
    FROM baza GROUP BY brand, model HAVING count(*) >= min_sample
  ),
  przeceny AS (
    SELECT b.brand, b.model, b.id, b.title, b.first_price, b.current_price,
           b.first_price - b.current_price AS pln,
           100.0 * (b.first_price - b.current_price) / b.first_price AS percent
    FROM baza b JOIN modele m USING (brand, model)
    WHERE b.first_price > 0 AND b.current_price < b.first_price
  ),
  najwieksza AS (
    SELECT DISTINCT ON (brand, model) brand, model, id, title, first_price, current_price
    FROM przeceny ORDER BY brand, model, pln DESC
  ),
  agregaty AS (
    SELECT
      m.brand, m.model, m.sample_size,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY b.current_price) AS median_price,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY extract(epoch FROM (b.last_checked_at - b.first_seen_at)) / 86400
      ) FILTER (WHERE b.first_seen_at IS NOT NULL AND b.last_checked_at IS NOT NULL
                  AND b.last_checked_at >= b.first_seen_at) AS median_days_listed
    FROM modele m JOIN baza b USING (brand, model)
    GROUP BY m.brand, m.model, m.sample_size
  ),
  spadki AS (
    SELECT brand, model, count(*) AS dropped_count,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY percent) AS median_percent,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY pln) AS median_pln
    FROM przeceny GROUP BY brand, model
  )
  SELECT
    a.brand, a.model, a.sample_size,
    round(a.median_price::numeric, 2),
    coalesce(s.dropped_count, 0),
    CASE WHEN coalesce(s.dropped_count, 0) >= min_drops
         THEN round(s.median_percent::numeric, 2) END,
    CASE WHEN coalesce(s.dropped_count, 0) >= min_drops
         THEN round(s.median_pln::numeric, 2) END,
    n.id, n.title, n.first_price, n.current_price,
    round(a.median_days_listed::numeric, 2)
  FROM agregaty a
  LEFT JOIN spadki s USING (brand, model)
  LEFT JOIN najwieksza n USING (brand, model)
  ORDER BY a.sample_size DESC;
$$;

GRANT EXECUTE ON FUNCTION model_trends_full(integer, integer) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS model_trends_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE model_trends_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS everyone_can_read_model_trends ON model_trends_snapshot;
CREATE POLICY everyone_can_read_model_trends ON model_trends_snapshot FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION refresh_model_trends_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO model_trends_snapshot (id, trends, computed_at)
  VALUES (1, coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM model_trends_full(30, 3) t), '[]'::jsonb), now())
  ON CONFLICT (id) DO UPDATE
    SET trends = excluded.trends, computed_at = excluded.computed_at;
END;
$$;

SELECT refresh_model_trends_snapshot();

-- :45 - po przelotach (:07, :20) i po raporcie (:35), przed Otodomem (:50).
SELECT cron.schedule(
  'refresh-model-trends',
  '45 * * * *',
  $cron$ SELECT refresh_model_trends_snapshot(); $cron$
);
