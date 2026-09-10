/*
  # Funkcje liczące „Barometr obniżek"

  Cztery liczby na stronę /barometr. Wszystkie mogłyby powstać w Next.js z
  pobranych wierszy — i to jest dokładnie ten błąd, który w niedzielę wyczerpał
  budżet Disk IO: mediana liczona przez przeciągnięcie całej tabeli snapshotów
  przy każdym renderowaniu strony.

  Tu liczy je baza i oddaje kilkanaście wierszy zamiast dziesiątek tysięcy.
  Strona ma `revalidate`, więc przy godzinnym odświeżaniu to jedno zapytanie
  agregujące na godzinę.

  Wszystkie trzy funkcje są STABLE (nie modyfikują danych) i SECURITY INVOKER —
  czytają przez RLS wołającego, a `listings` ma politykę pozwalającą czytać
  wszystkim, więc anon widzi dokładnie to, co widzi na stronie ogłoszenia.
*/

/*
  Obniżkę liczymy zawsze tak samo: od pierwszej ceny, jaką u siebie
  zapisaliśmy, do dzisiejszej. Bierzemy wyłącznie oferty nadal aktywne —
  ogłoszenie zdjęte z serwisu ma cenę zamrożoną i z czasem ciągnęłoby
  statystykę w przeszłość.
*/
CREATE OR REPLACE FUNCTION barometer_overview()
RETURNS TABLE (
  active_listings bigint,
  dropped_listings bigint,
  drop_share numeric,
  median_days_to_drop numeric,
  days_sample bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT id, first_price, current_price
    FROM listings
    WHERE is_active AND current_price > 0 AND first_price > 0
  ),
  dropped AS (
    SELECT id FROM base WHERE current_price < first_price
  ),
  /*
    Ile dni mija, zanim sprzedający zejdzie z ceny. Liczymy od pierwszego
    zapisu do pierwszego, który jest od niego niższy - a nie do ostatniego,
    bo interesuje nas moment PIERWSZEJ obniżki, nie długość całej historii.
  */
  timings AS (
    SELECT s.listing_id,
           EXTRACT(epoch FROM (min(s.scraped_at) FILTER (WHERE s.price < f.first_seen_price)
                               - min(s.scraped_at))) / 86400 AS days
    FROM listing_snapshots s
    JOIN (
      SELECT DISTINCT ON (listing_id) listing_id, price AS first_seen_price
      FROM listing_snapshots WHERE price > 0 ORDER BY listing_id, scraped_at
    ) f ON f.listing_id = s.listing_id
    WHERE s.price > 0 AND s.listing_id IN (SELECT id FROM dropped)
    GROUP BY s.listing_id, f.first_seen_price
  )
  SELECT
    (SELECT count(*) FROM base),
    (SELECT count(*) FROM dropped),
    round(100.0 * (SELECT count(*) FROM dropped) / NULLIF((SELECT count(*) FROM base), 0), 1),
    round(percentile_cont(0.5) WITHIN GROUP (ORDER BY days)::numeric, 0),
    count(*)
  FROM timings
  WHERE days IS NOT NULL AND days >= 0;
$$;

/*
  Ranking modeli. Próg trzech przecen jest ten sam co na stronach modeli
  (MIN_DROPS_FOR_MEDIAN): mediana z jednej obserwacji opisuje tę obserwację,
  a nie model, i czytelnik bierze ją potem za regułę rynku.
*/
CREATE OR REPLACE FUNCTION barometer_by_model(min_drops integer DEFAULT 3)
RETURNS TABLE (
  brand text,
  model text,
  drops bigint,
  listings_total bigint,
  median_drop_percent numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    specs->>'brand',
    specs->>'model',
    count(*) FILTER (WHERE current_price < first_price),
    count(*),
    round(percentile_cont(0.5) WITHIN GROUP (
      ORDER BY (first_price - current_price) / first_price * 100
    ) FILTER (WHERE current_price < first_price)::numeric, 1)
  FROM listings
  WHERE is_active AND current_price > 0 AND first_price > 0
    AND specs->>'brand' IS NOT NULL AND specs->>'model' IS NOT NULL
  GROUP BY 1, 2
  HAVING count(*) FILTER (WHERE current_price < first_price) >= min_drops
  ORDER BY 5 DESC;
$$;

/*
  Rozkład wielkości obniżek. Odpowiada na pytanie, które zadaje sobie każdy
  negocjujący: czy pięć procent to dużo. Przedziały są nierówne celowo -
  powyżej 20% przypadków jest garstka i osobne słupki co 5% byłyby szumem.
*/
CREATE OR REPLACE FUNCTION barometer_distribution()
RETURNS TABLE (bucket text, sort_order integer, listings bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH d AS (
    SELECT (first_price - current_price) / first_price * 100 AS pct
    FROM listings
    WHERE is_active AND current_price > 0 AND first_price > 0
      AND current_price < first_price
  )
  SELECT b.label, b.ord, count(d.pct)
  FROM (VALUES
    ('do 2%', 1, 0::numeric, 2::numeric),
    ('2–5%', 2, 2, 5),
    ('5–10%', 3, 5, 10),
    ('10–20%', 4, 10, 20),
    ('ponad 20%', 5, 20, 1000)
  ) AS b(label, ord, lo, hi)
  LEFT JOIN d ON d.pct >= b.lo AND d.pct < b.hi
  GROUP BY b.label, b.ord
  ORDER BY b.ord;
$$;

GRANT EXECUTE ON FUNCTION barometer_overview() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION barometer_by_model(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION barometer_distribution() TO anon, authenticated;
