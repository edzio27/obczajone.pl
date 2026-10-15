/*
  # Wykresy na stronach modeli (/ile-spada-cena/[model])

  Dla każdego modelu z co najmniej 30 aktywnymi ogłoszeniami (ten sam próg,
  od którego model w ogóle ma stronę):

    - indeks cen tych samych aut tydzień po tygodniu (metoda jak na /trendy-cen,
      patrz migracja 20261015100000), punkt tylko przy co najmniej 15 autach,
    - mediana ceny według rocznika (rocznik z co najmniej 3 ogłoszeniami),
    - mediana ceny według przebiegu, w progach co 50 tys. km,
    - rozkład cen: 8 przedziałów między 5. a 95. percentylem, bo kilka aut
      za 3 tys. i jedno za 900 tys. zgniotłoby resztę do jednego słupka,
    - do 4 aut, które potaniały w ostatnich 14 dniach.

  Jeden wiersz na model, strona czyta tylko swój. Liczy ten sam nocny cron co
  trendy rynku (refresh_price_trends_snapshot).
*/

CREATE TABLE IF NOT EXISTS model_price_charts (
  brand text NOT NULL,
  model text NOT NULL,
  data jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand, model)
);

ALTER TABLE model_price_charts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS everyone_can_read_model_price_charts ON model_price_charts;
CREATE POLICY everyone_can_read_model_price_charts ON model_price_charts FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION model_price_charts_full()
RETURNS TABLE (brand text, model text, data jsonb)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH baza AS (
    SELECT
      l.id, l.title, l.image_url, l.is_active, l.current_price,
      btrim(l.specs->>'brand') AS brand,
      btrim(l.specs->>'model') AS model,
      nullif(regexp_replace(coalesce(l.specs->>'year', ''), '\D', '', 'g'), '')::int AS year,
      nullif(regexp_replace(coalesce(l.specs->>'mileage', ''), '\D', '', 'g'), '')::bigint AS km,
      l.first_seen_at,
      CASE WHEN l.is_active THEN l.last_checked_at
           ELSE (SELECT max(s.scraped_at) FROM listing_snapshots s WHERE s.listing_id = l.id)
      END AS known_until
    FROM listings l
    WHERE l.source = 'otomoto'
      AND l.current_price > 0
      AND btrim(coalesce(l.specs->>'brand', '')) <> ''
      AND btrim(coalesce(l.specs->>'model', '')) <> ''
  ),
  modele AS (
    SELECT brand, model FROM baza WHERE is_active GROUP BY brand, model HAVING count(*) >= 30
  ),
  b AS (
    SELECT baza.* FROM baza JOIN modele USING (brand, model)
  ),
  tygodnie AS (
    SELECT generate_series(
      date_trunc('week', timestamptz '2026-09-07'),
      date_trunc('week', now()),
      interval '1 week'
    ) AS t
  ),
  ceny_w_tygodniu AS (
    SELECT b.id, b.brand, b.model, w.t, p.price
    FROM b
    JOIN tygodnie w ON w.t BETWEEN b.first_seen_at AND b.known_until
    CROSS JOIN LATERAL (
      SELECT s.price FROM listing_snapshots s
      WHERE s.listing_id = b.id AND s.scraped_at <= w.t
      ORDER BY s.scraped_at DESC LIMIT 1
    ) p
  ),
  tygodniowe AS (
    SELECT c0.brand, c0.model, c1.t, exp(avg(ln(c1.price / c0.price))) AS ratio, count(*) AS n
    FROM ceny_w_tygodniu c0
    JOIN ceny_w_tygodniu c1 ON c1.id = c0.id AND c1.t = c0.t + interval '1 week'
    WHERE c0.price > 0 AND c1.price / c0.price BETWEEN 0.3 AND 3
    GROUP BY c0.brand, c0.model, c1.t
  ),
  indeks AS (
    SELECT brand, model, jsonb_agg(jsonb_build_object(
      'week', t, 'value', round(value::numeric, 2), 'n', n) ORDER BY t) AS points
    FROM (
      -- Tydzień z małą próbką nie dostaje punktu, ale jego iloraz wchodzi do
      -- kolejnych: inaczej wykres „gubiłby” spadek z tego tygodnia.
      SELECT brand, model, t, n,
             100 * exp(sum(ln(ratio)) OVER (PARTITION BY brand, model ORDER BY t)) AS value
      FROM tygodniowe
    ) x
    WHERE n >= 15
    GROUP BY brand, model
  ),
  roczniki AS (
    SELECT brand, model, jsonb_agg(jsonb_build_object(
      'year', year, 'median', round(med::numeric), 'n', n) ORDER BY year) AS points
    FROM (
      SELECT brand, model, year,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price) AS med, count(*) AS n
      FROM b
      WHERE is_active AND year BETWEEN 1990 AND extract(year FROM now())::int + 1
      GROUP BY brand, model, year
      HAVING count(*) >= 3
    ) y
    GROUP BY brand, model
  ),
  przebiegi AS (
    SELECT brand, model, jsonb_agg(jsonb_build_object(
      'from', band * 50000, 'median', round(med::numeric), 'n', n) ORDER BY band) AS points
    FROM (
      SELECT brand, model, least(km / 50000, 6) AS band,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price) AS med, count(*) AS n
      FROM b
      WHERE is_active AND km IS NOT NULL AND km < 2000000
      GROUP BY brand, model, least(km / 50000, 6)
      HAVING count(*) >= 3
    ) k
    GROUP BY brand, model
  ),
  granice AS (
    SELECT brand, model,
           percentile_cont(0.05) WITHIN GROUP (ORDER BY current_price) AS lo,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY current_price) AS hi
    FROM b WHERE is_active GROUP BY brand, model
  ),
  rozklad AS (
    SELECT brand, model, jsonb_agg(jsonb_build_object(
      'from', round((lo + (bucket - 1) * (hi - lo) / 8)::numeric),
      'to', round((lo + bucket * (hi - lo) / 8)::numeric),
      'n', n) ORDER BY bucket) AS points
    FROM (
      SELECT b.brand, b.model, g.lo, g.hi,
             least(greatest(width_bucket(b.current_price, g.lo, g.hi, 8), 1), 8) AS bucket,
             count(*) AS n
      FROM b JOIN granice g USING (brand, model)
      WHERE b.is_active AND g.hi > g.lo
      GROUP BY 1, 2, 3, 4, 5
    ) h
    GROUP BY brand, model
  ),
  obnizki AS (
    SELECT brand, model, jsonb_agg(jsonb_build_object(
      'id', id, 'title', title, 'image_url', image_url,
      'from_price', from_price, 'to_price', to_price, 'changed_at', changed_at)
      ORDER BY pct DESC) AS items
    FROM (
      SELECT b.brand, b.model, b.id, b.title, b.image_url, prev.price AS from_price,
             last.price AS to_price, last.scraped_at AS changed_at,
             (prev.price - last.price) / prev.price AS pct,
             row_number() OVER (PARTITION BY b.brand, b.model
                                ORDER BY (prev.price - last.price) / prev.price DESC) AS rn
      FROM b
      CROSS JOIN LATERAL (
        SELECT s.price, s.scraped_at FROM listing_snapshots s
        WHERE s.listing_id = b.id ORDER BY s.scraped_at DESC LIMIT 1
      ) last
      CROSS JOIN LATERAL (
        SELECT s.price FROM listing_snapshots s
        WHERE s.listing_id = b.id AND s.scraped_at < last.scraped_at
        ORDER BY s.scraped_at DESC LIMIT 1
      ) prev
      WHERE b.is_active
        AND last.scraped_at > now() - interval '14 days'
        AND last.price < prev.price
        AND last.price / prev.price >= 0.3
        AND last.price >= 5000
    ) d
    WHERE rn <= 4
    GROUP BY brand, model
  )
  SELECT m.brand, m.model, jsonb_build_object(
    'index', coalesce(i.points, '[]'::jsonb),
    'by_year', coalesce(r.points, '[]'::jsonb),
    'by_mileage', coalesce(p.points, '[]'::jsonb),
    'distribution', coalesce(h.points, '[]'::jsonb),
    'recent_drops', coalesce(o.items, '[]'::jsonb)
  )
  FROM modele m
  LEFT JOIN indeks i USING (brand, model)
  LEFT JOIN roczniki r USING (brand, model)
  LEFT JOIN przebiegi p USING (brand, model)
  LEFT JOIN rozklad h USING (brand, model)
  LEFT JOIN obnizki o USING (brand, model);
$$;

REVOKE ALL ON FUNCTION model_price_charts_full() FROM public, anon, authenticated;

/*
  Ten sam nocny przebieg odświeża rynek i modele. Tabela modeli jest
  podmieniana w całości w jednej transakcji (funkcja SQL), więc strona nigdy
  nie zobaczy jej pustej.
*/
CREATE OR REPLACE FUNCTION refresh_price_trends_snapshot()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO price_trends_snapshot (id, data, computed_at)
  VALUES (1, price_trends_full(), now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, computed_at = EXCLUDED.computed_at;

  DELETE FROM model_price_charts;

  INSERT INTO model_price_charts (brand, model, data, computed_at)
  SELECT brand, model, data, now() FROM model_price_charts_full();
$$;

REVOKE ALL ON FUNCTION refresh_price_trends_snapshot() FROM public, anon, authenticated;
