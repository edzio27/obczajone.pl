/*
  # Ocena ceny liczona nocą dla wszystkich aktywnych aut

  Ocena („Tańsza niż 3 na 4 podobne”, „X% powyżej mediany”…) liczyła się
  dotąd tylko na stronie ogłoszenia, na żywo: każde wejście ściągało do 500
  ogłoszeń tego modelu i liczyło medianę w Node. Na kafelkach (strona główna,
  archiwum, modele, podobne) to by było kilkanaście takich zapytań na stronę.
  AutoUncle pokazuje ocenę na każdym kafelku i to jest najbardziej widoczna
  różnica między nami (październik 2026).

  Liczymy więc raz na dobę, w bazie, wiernie wobec lib/price-comparison.ts
  i lib/price-verdict.ts:

    poziomy dopasowania (pierwszy z co najmniej 5 ofertami wygrywa):
      1. rocznik ±2, to samo paliwo, przebieg ±40%   (ścisłe)
      2. rocznik ±2, to samo paliwo                  (ścisłe)
      3. rocznik ±3                                  (luźne)
    jeśli górny kwartyl / dolny > 2 - „za mało danych” (oferty zbyt różne)

    werdykt tylko przy ścisłym dopasowaniu:
      okazja  - cena < 25. percentyl i próbka >= 12
      wysoka  - cena > 75. percentyl i próbka >= 12
      ponizej - ponad 3% poniżej mediany
      powyzej - ponad 3% powyżej mediany
      rynkowa - w pozostałych przypadkach

  Różnica wobec wersji w Node: kandydatami są wszystkie ogłoszenia modelu,
  a nie przypadkowe 500. Strona ogłoszenia czyta teraz ten wynik, więc ocena
  na kafelku i na stronie jest ta sama.

  Pełny wynik idzie do `listing_price_assessment` (strona ogłoszenia: mediana,
  przedział, kryterium), sam werdykt do `listings.price_verdict` (kafelki
  dostają go razem z resztą ogłoszenia, bez dodatkowego zapytania).
*/

ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_verdict text;

CREATE TABLE IF NOT EXISTS listing_price_assessment (
  listing_id uuid PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  sufficient boolean NOT NULL,
  sample_size integer NOT NULL,
  median_price numeric,
  lower_quartile numeric,
  upper_quartile numeric,
  percent_vs_median numeric,
  criteria_label text NOT NULL,
  strict boolean NOT NULL,
  verdict text,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listing_price_assessment ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS everyone_can_read_price_assessment ON listing_price_assessment;
CREATE POLICY everyone_can_read_price_assessment ON listing_price_assessment FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION refresh_price_assessments()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH baza AS (
    SELECT
      l.id, l.is_active, l.current_price AS price,
      btrim(l.specs->>'brand') AS brand,
      btrim(l.specs->>'model') AS model,
      nullif(regexp_replace(coalesce(l.specs->>'year', ''), '\D', '', 'g'), '')::int AS year,
      nullif(regexp_replace(coalesce(l.specs->>'mileage', ''), '\D', '', 'g'), '')::bigint AS km,
      lower(nullif(btrim(l.specs->>'fuel_type'), '')) AS fuel
    FROM listings l
    WHERE l.source = 'otomoto'
      AND l.current_price > 0
      AND btrim(coalesce(l.specs->>'brand', '')) <> ''
      AND btrim(coalesce(l.specs->>'model', '')) <> ''
  ),
  poziomy AS (
    SELECT
      s.id, s.price, s.brand, s.model,
      count(*) AS n_all,
      count(*) FILTER (WHERE l1) AS n1,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l1) AS med1,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l1) AS p25_1,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l1) AS p75_1,
      count(*) FILTER (WHERE l2) AS n2,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l2) AS med2,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l2) AS p25_2,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l2) AS p75_2,
      count(*) FILTER (WHERE l3) AS n3,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l3) AS med3,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l3) AS p25_3,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY c.price) FILTER (WHERE l3) AS p75_3
    FROM baza s
    JOIN baza c ON c.brand = s.brand AND c.model = s.model AND c.id <> s.id
    CROSS JOIN LATERAL (
      SELECT
        (s.year IS NOT NULL AND c.year IS NOT NULL AND abs(c.year - s.year) <= 2) AS y2,
        (s.year IS NOT NULL AND c.year IS NOT NULL AND abs(c.year - s.year) <= 3) AS y3,
        (s.fuel IS NOT NULL AND c.fuel = s.fuel) AS f,
        (s.km IS NOT NULL AND s.km > 0 AND c.km IS NOT NULL AND abs(c.km - s.km)::numeric / s.km <= 0.4) AS k
    ) m
    CROSS JOIN LATERAL (SELECT (m.y2 AND m.f AND m.k) AS l1, (m.y2 AND m.f) AS l2, m.y3 AS l3) lv
    WHERE s.is_active
    GROUP BY s.id, s.price, s.brand, s.model
  ),
  wybor AS (
    SELECT
      p.id, p.price, p.brand, p.model, p.n_all,
      CASE WHEN p.n1 >= 5 THEN 1 WHEN p.n2 >= 5 THEN 2 WHEN p.n3 >= 5 THEN 3 END AS lvl,
      CASE WHEN p.n1 >= 5 THEN p.n1 WHEN p.n2 >= 5 THEN p.n2 WHEN p.n3 >= 5 THEN p.n3 END AS n,
      CASE WHEN p.n1 >= 5 THEN p.med1 WHEN p.n2 >= 5 THEN p.med2 WHEN p.n3 >= 5 THEN p.med3 END AS med,
      CASE WHEN p.n1 >= 5 THEN p.p25_1 WHEN p.n2 >= 5 THEN p.p25_2 WHEN p.n3 >= 5 THEN p.p25_3 END AS p25,
      CASE WHEN p.n1 >= 5 THEN p.p75_1 WHEN p.n2 >= 5 THEN p.p75_2 WHEN p.n3 >= 5 THEN p.p75_3 END AS p75
    FROM poziomy p
  ),
  ocena AS (
    SELECT
      w.*,
      (w.lvl IS NOT NULL AND NOT (w.p25 > 0 AND w.p75 / w.p25 > 2)) AS sufficient,
      (w.lvl IN (1, 2)) AS strict,
      CASE WHEN w.med > 0 THEN (w.price - w.med) / w.med * 100 END AS pct,
      CASE w.lvl
        WHEN 1 THEN w.brand || ' ' || w.model || ', rocznik ±2 lata, ten sam rodzaj paliwa, przebieg ±40%'
        WHEN 2 THEN w.brand || ' ' || w.model || ', rocznik ±2 lata, ten sam rodzaj paliwa'
        WHEN 3 THEN w.brand || ' ' || w.model || ', rocznik ±3 lata'
        ELSE w.brand || ' ' || w.model
      END AS label
    FROM wybor w
  ),
  werdykt AS (
    SELECT o.*,
      CASE
        WHEN NOT o.sufficient OR NOT o.strict OR o.pct IS NULL THEN NULL
        WHEN o.n >= 12 AND o.price < o.p25 THEN 'okazja'
        WHEN o.n >= 12 AND o.price > o.p75 THEN 'wysoka'
        WHEN o.pct < -3 THEN 'ponizej'
        WHEN o.pct > 3 THEN 'powyzej'
        ELSE 'rynkowa'
      END AS verdict
    FROM ocena o
  ),
  zapis AS (
    INSERT INTO listing_price_assessment AS a (
      listing_id, sufficient, sample_size, median_price, lower_quartile, upper_quartile,
      percent_vs_median, criteria_label, strict, verdict, computed_at
    )
    SELECT
      id, sufficient,
      CASE WHEN sufficient THEN n ELSE n_all END,
      CASE WHEN sufficient THEN round(med::numeric, 2) END,
      CASE WHEN sufficient THEN round(p25::numeric, 2) END,
      CASE WHEN sufficient THEN round(p75::numeric, 2) END,
      CASE WHEN sufficient THEN round(pct::numeric, 2) END,
      CASE WHEN sufficient THEN label ELSE brand || ' ' || model END,
      sufficient AND strict,
      verdict, now()
    FROM werdykt
    ON CONFLICT (listing_id) DO UPDATE SET
      sufficient = EXCLUDED.sufficient, sample_size = EXCLUDED.sample_size,
      median_price = EXCLUDED.median_price, lower_quartile = EXCLUDED.lower_quartile,
      upper_quartile = EXCLUDED.upper_quartile, percent_vs_median = EXCLUDED.percent_vs_median,
      criteria_label = EXCLUDED.criteria_label, strict = EXCLUDED.strict,
      verdict = EXCLUDED.verdict, computed_at = EXCLUDED.computed_at
    RETURNING a.listing_id, a.verdict
  )
  -- Zapisujemy tylko tam, gdzie werdykt się zmienił, i czyścimy go przy
  -- ogłoszeniach, które przestały być oceniane (zdjęte, bez danych).
  UPDATE listings l
  SET price_verdict = z.verdict
  FROM (
    SELECT l2.id, zp.verdict
    FROM listings l2
    LEFT JOIN zapis zp ON zp.listing_id = l2.id
    WHERE l2.price_verdict IS NOT NULL OR zp.listing_id IS NOT NULL
  ) z
  WHERE l.id = z.id AND l.price_verdict IS DISTINCT FROM z.verdict;
$$;

REVOKE ALL ON FUNCTION refresh_price_assessments() FROM public, anon, authenticated;

/*
  O 1:50 UTC, po trendach rynku (1:35), z dala od reszty nocnych agregatów.
*/
SELECT cron.unschedule('refresh-price-assessments')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-price-assessments');
SELECT cron.schedule('refresh-price-assessments', '50 1 * * *', $cron$ SELECT refresh_price_assessments(); $cron$);

/*
  Największe obniżki na stronie głównej zwracają kafelki, więc dostają też
  werdykt. Zmiana typu wyniku wymaga DROP - CREATE OR REPLACE tego nie przepuści.
*/
DROP FUNCTION IF EXISTS biggest_price_drops(integer);
CREATE FUNCTION biggest_price_drops(p_limit integer DEFAULT 3)
RETURNS TABLE(id uuid, title text, location text, current_price numeric, first_price numeric, source text,
              created_at timestamptz, image_url text, ai_opinion_rating numeric, price_verdict text)
LANGUAGE sql
STABLE
AS $$
  SELECT l.id, l.title, l.location, l.current_price, l.first_price,
         l.source, l.created_at, l.image_url, l.ai_opinion_rating, l.price_verdict
  FROM listings l
  WHERE l.is_active
    -- Tylko auta: strona główna od 14.10 jest o autach, a przelot Otodom
    -- potrafił wypchnąć na pierwsze miejsce przecenione mieszkanie.
    AND l.source = 'otomoto'
    AND l.first_price IS NOT NULL
    AND l.first_price > 0
    AND l.current_price > 0
    AND coalesce(btrim(l.title), '') <> ''
    AND l.current_price < l.first_price
    -- Najwyżej -70%: niżej zaczynają się zgubione cyfry, nie przeceny.
    AND l.current_price::numeric / l.first_price >= 0.30
  ORDER BY l.current_price::numeric / l.first_price ASC
  LIMIT greatest(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION biggest_price_drops(integer) TO anon, authenticated;
