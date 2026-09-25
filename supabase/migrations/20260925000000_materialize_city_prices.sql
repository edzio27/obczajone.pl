/*
  # Ceny mieszkań liczone przez crona, nie przy każdym renderze

  Deploy na Vercelu padł dwa razy z rzędu na "Collecting page data is still
  timing out after 2 attempts", a nie na sitemapie, jak zakładaliśmy.

  Winne jest `/ceny-mieszkan/[slug]`. `generateStaticParams` woła
  `fetchCityPrices` raz, ale `fetchCityPrice` - używana w metadanych i w samej
  stronie każdego miasta - przelicza komplet median od nowa dla jednego miasta:

    const all = await fetchCityPrices(supabase);
    return all.find((c) => c.slug === slug) ?? null;

  Przy jedenastu miastach daje to około dwudziestu pięciu pełnych przeliczeń
  percentyli po wszystkich mieszkaniach Otodomu. Zmierzone: 1.46 s jedno
  wywołanie, ~37 s w buildzie przy spokojnej bazie. Limit Next to 60 sekund,
  więc przy bazie obciążonej crawlerem build przestaje się mieścić - i przestał.

  Rozwiązanie to samo, które działa już przy raporcie dla mediów i trendach
  modeli: liczy cron, gdy nikt nie czeka, a strona czyta jeden wiersz.
  Na tej instancji percentyle liczone w chwili renderowania nie udają się
  żadnym sposobem i to jest czwarty raz, kiedy się o tym przekonujemy.
*/

CREATE TABLE IF NOT EXISTS city_prices_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE city_prices_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS everyone_can_read_city_prices ON city_prices_snapshot;
CREATE POLICY everyone_can_read_city_prices ON city_prices_snapshot FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION refresh_city_prices_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO city_prices_snapshot (id, cities, computed_at)
  VALUES (
    1,
    coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM city_price_stats(20) c), '[]'::jsonb),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET cities = excluded.cities, computed_at = excluded.computed_at;
END;
$$;

SELECT refresh_city_prices_snapshot();

/*
  :55 - ostatnia wolna minuta. :07 ceny, :20 modele, :35 raport, :45 trendy,
  :50 Otodom. Ceny miast liczą się z danych Otodomu, więc wypadają zaraz po nim.
*/
SELECT cron.schedule(
  'refresh-city-prices',
  '55 * * * *',
  $cron$ SELECT refresh_city_prices_snapshot(); $cron$
);
