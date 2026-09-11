/*
  # Statystyki cen mieszkań w podziale na miasta

  Odpowiednik stron modelowych, tylko dla nieruchomości. Przelot po Otodomie
  podniósł liczbę obserwowanych mieszkań z 52 do 435 w jedną dobę, więc jest
  wreszcie z czego liczyć cokolwiek per miasto.

  Znów liczy baza, nie Next — z tego samego powodu, dla którego tak liczy
  barometr: mediana wyciągana z pobranych wierszy przy każdym renderowaniu
  wyczerpała 7 września budżet Disk IO tej instancji.

  ## Uwaga o cenie za metr

  `specs->>'area'` to tekst i nie zawsze jest liczbą — przy ofertach zebranych
  różnymi drogami trafiają się puste wartości i zapisy z jednostką. Rzutujemy
  więc warunkowo (regexp), a nie wprost: pojedynczy wiersz z "68,24 m²" wywalał
  by całą funkcję, a my wolimy stracić ten jeden wiersz niż całą stronę.
*/

CREATE OR REPLACE FUNCTION city_price_stats(min_listings integer DEFAULT 20)
RETURNS TABLE (
  city text,
  listings bigint,
  median_price numeric,
  median_price_per_m2 numeric,
  median_area numeric,
  dropped bigint,
  median_drop_percent numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      location AS city,
      current_price,
      first_price,
      CASE
        WHEN specs->>'area' ~ '^[0-9]+(\.[0-9]+)?$'
        THEN (specs->>'area')::numeric
      END AS area
    FROM listings
    WHERE source = 'otodom'
      AND is_active
      AND current_price > 0
      AND location <> ''
  )
  SELECT
    city,
    count(*),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price)::numeric, 0),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price / area)
          FILTER (WHERE area > 0)::numeric, 0),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY area)
          FILTER (WHERE area > 0)::numeric, 1),
    count(*) FILTER (WHERE first_price > current_price),
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (first_price - current_price) / first_price * 100
    ) FILTER (WHERE first_price > current_price)::numeric, 1)
  FROM base
  GROUP BY city
  HAVING count(*) >= min_listings
  ORDER BY count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION city_price_stats(integer) TO anon, authenticated;
