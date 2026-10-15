/*
  # Trendy cen używanych aut (strona /trendy-cen)

  Wzorowane na cargurus.com/research/price-trends: jedna liczba na górze,
  indeks w czasie, rankingi marek i modeli, które tanieją i drożeją,
  tabele według nadwozia i marki.

  ## Metoda: te same auta, nie mediana wszystkich

  Mediana cen wszystkich ogłoszeń skacze razem ze składem bazy: wystarczy, że
  przelot po modelach dołoży sto BMW, a „rynek drożeje”. Dlatego zmianę cen
  liczymy na tych samych egzemplarzach: ogłoszenie wchodzi do pomiaru tylko
  wtedy, gdy znamy jego cenę na początku i na końcu okresu. Zmiana okresu to
  średnia geometryczna ilorazów cen (koniec / początek).

  Cena w chwili t to ostatnia zapisana zmiana nie późniejsza niż t, pod
  warunkiem że ogłoszenie wtedy żyło: od `first_seen_at` do ostatniego
  sprawdzenia (aktywne) albo ostatniej zapisanej ceny (zdjęte). Zmiana, której
  nie widzieliśmy, trafia do tygodnia, w którym ją zauważyliśmy. Od
  15 października auta są sprawdzane co ~4 dni, więc to przesunięcie jest małe.

  Ilorazy poniżej 0,3 i powyżej 3 odrzucamy: to błędy odczytu (rata zamiast
  ceny, cena w tysiącach), a nie ruchy rynku.

  ## Wydajność

  Ciężkie zapytanie (lateral po zmianach cen dla każdego ogłoszenia
  i każdego tygodnia), więc liczy je nocny cron, a strona czyta jeden wiersz.
  Na tej instancji żaden percentyl ani GROUP BY po tysiącach wierszy nie stoi
  na ścieżce żądania.
*/

CREATE OR REPLACE FUNCTION price_trends_full()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH baza AS (
    SELECT
      l.id, l.title, l.image_url, l.is_active, l.current_price, l.first_price,
      btrim(l.specs->>'brand') AS brand,
      btrim(l.specs->>'model') AS model,
      nullif(btrim(l.specs->>'body_type'), '') AS body,
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
  -- Poniedziałki od pierwszego pełnego tygodnia pomiarów (przeloty po modelach
  -- ruszyły 4 września) do bieżącego.
  tygodnie AS (
    SELECT generate_series(
      date_trunc('week', timestamptz '2026-09-07'),
      date_trunc('week', now()),
      interval '1 week'
    ) AS t
  ),
  ceny_w_tygodniu AS (
    SELECT b.id, w.t, p.price
    FROM baza b
    JOIN tygodnie w ON w.t BETWEEN b.first_seen_at AND b.known_until
    CROSS JOIN LATERAL (
      SELECT s.price FROM listing_snapshots s
      WHERE s.listing_id = b.id AND s.scraped_at <= w.t
      ORDER BY s.scraped_at DESC LIMIT 1
    ) p
  ),
  tygodniowe AS (
    SELECT c1.t, exp(avg(ln(c1.price / c0.price))) AS ratio, count(*) AS n
    FROM ceny_w_tygodniu c0
    JOIN ceny_w_tygodniu c1 ON c1.id = c0.id AND c1.t = c0.t + interval '1 week'
    WHERE c0.price > 0 AND c1.price / c0.price BETWEEN 0.3 AND 3
    GROUP BY c1.t
  ),
  indeks AS (
    SELECT t, n,
      100 * exp(sum(ln(ratio)) OVER (ORDER BY t)) AS value
    FROM tygodniowe
  ),
  -- Zmiana za ostatnie 30 dni na tych samych autach: cena 30 dni temu i dziś.
  okno AS (
    SELECT b.id, b.brand, b.model, b.body, p0.price AS p0, p1.price AS p1
    FROM baza b
    CROSS JOIN LATERAL (
      SELECT s.price FROM listing_snapshots s
      WHERE s.listing_id = b.id AND s.scraped_at <= now() - interval '30 days'
      ORDER BY s.scraped_at DESC LIMIT 1
    ) p0
    CROSS JOIN LATERAL (
      SELECT s.price FROM listing_snapshots s
      WHERE s.listing_id = b.id
      ORDER BY s.scraped_at DESC LIMIT 1
    ) p1
    WHERE b.is_active
      AND b.first_seen_at <= now() - interval '30 days'
      AND p0.price > 0
      AND p1.price / p0.price BETWEEN 0.3 AND 3
  ),
  aktywne AS (
    SELECT brand, model, body, current_price FROM baza WHERE is_active
  ),
  -- Grupy: cały rynek, nadwozie, marka, model. Próg 30 aut w oknie 30 dni,
  -- tak jak przy stronach modeli: z mniejszej próbki procent jest anegdotą.
  grupy AS (
    SELECT 'all' AS kind, NULL::text AS brand, NULL::text AS model, NULL::text AS body,
           exp(avg(ln(p1 / p0))) - 1 AS change30, count(*) AS n30,
           avg((p1 <> p0)::int) AS changed_share
    FROM okno
    UNION ALL
    SELECT 'body', NULL, NULL, body, exp(avg(ln(p1 / p0))) - 1, count(*), avg((p1 <> p0)::int)
    FROM okno WHERE body IS NOT NULL GROUP BY body HAVING count(*) >= 30
    UNION ALL
    SELECT 'make', brand, NULL, NULL, exp(avg(ln(p1 / p0))) - 1, count(*), avg((p1 <> p0)::int)
    FROM okno GROUP BY brand HAVING count(*) >= 30
    UNION ALL
    SELECT 'model', brand, model, NULL, exp(avg(ln(p1 / p0))) - 1, count(*), avg((p1 <> p0)::int)
    FROM okno GROUP BY brand, model HAVING count(*) >= 30
  ),
  ceny_grup AS (
    SELECT 'all' AS kind, NULL::text AS brand, NULL::text AS model, NULL::text AS body,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price) AS median_price,
           count(*) AS active
    FROM aktywne
    UNION ALL
    SELECT 'body', NULL, NULL, body, percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price), count(*)
    FROM aktywne WHERE body IS NOT NULL GROUP BY body
    UNION ALL
    SELECT 'make', brand, NULL, NULL, percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price), count(*)
    FROM aktywne GROUP BY brand
    UNION ALL
    SELECT 'model', brand, model, NULL, percentile_cont(0.5) WITHIN GROUP (ORDER BY current_price), count(*)
    FROM aktywne GROUP BY brand, model
  ),
  wyniki AS (
    SELECT g.kind, g.brand, g.model, g.body,
           round((100 * g.change30)::numeric, 2) AS change30_percent,
           g.n30,
           round((100 * g.changed_share)::numeric, 1) AS changed_share_percent,
           round(c.median_price::numeric) AS median_price,
           c.active
    FROM grupy g
    LEFT JOIN ceny_grup c
      ON c.kind = g.kind
     AND c.brand IS NOT DISTINCT FROM g.brand
     AND c.model IS NOT DISTINCT FROM g.model
     AND c.body IS NOT DISTINCT FROM g.body
  ),
  -- Przykłady: aktywne auta, które potaniały w ostatnich 7 dniach.
  ostatnie_obnizki AS (
    SELECT b.id, b.title, b.image_url, b.brand, b.model, prev.price AS from_price,
           last.price AS to_price, last.scraped_at AS changed_at
    FROM baza b
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
      AND last.scraped_at > now() - interval '7 days'
      AND last.price < prev.price
      AND last.price / prev.price >= 0.3
      -- Bez aut za 2-4 tys. zł: przy nich 30% to tysiąc złotych i przykłady
      -- wyglądały jak przegląd złomowiska, a nie rynku.
      AND last.price >= 10000
    ORDER BY (prev.price - last.price) / prev.price DESC
    LIMIT 6
  )
  SELECT jsonb_build_object(
    'computed_at', now(),
    'index', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                'week', t, 'value', round(value::numeric, 2), 'n', n) ORDER BY t), '[]'::jsonb)
              FROM indeks),
    'groups', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) FROM wyniki w),
    'recent_drops', (SELECT coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) FROM ostatnie_obnizki o)
  );
$$;

CREATE TABLE IF NOT EXISTS price_trends_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE price_trends_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS everyone_can_read_price_trends ON price_trends_snapshot;
CREATE POLICY everyone_can_read_price_trends ON price_trends_snapshot FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION refresh_price_trends_snapshot()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO price_trends_snapshot (id, data, computed_at)
  VALUES (1, price_trends_full(), now())
  ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, computed_at = EXCLUDED.computed_at;
$$;

REVOKE ALL ON FUNCTION refresh_price_trends_snapshot() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION price_trends_full() FROM public, anon, authenticated;

/*
  Raz na dobę o 1:35 (UTC), z dala od reszty nocnych agregatów (2:35 raport,
  3:20 modele, 4:45 trendy modeli, 5:55 ceny miast). Rankingi „30 dni”
  nie potrzebują świeżości co do godziny.
*/
SELECT cron.unschedule('refresh-price-trends')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-price-trends');

SELECT cron.schedule('refresh-price-trends', '35 1 * * *', $cron$ SELECT refresh_price_trends_snapshot(); $cron$);
