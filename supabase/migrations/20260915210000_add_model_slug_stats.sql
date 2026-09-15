/*
  # Lista modeli, które zasługują na własną stronę

  Sitemapa potrzebuje z `fetchModelTrends` jednej rzeczy: nazw modeli powyżej
  progu, żeby złożyć z nich adresy. Dostawała przy tym całe liczenie — funkcja
  ściąga do Node'a wszystkie żywe ogłoszenia ze `specs` i grupuje je w pamięci,
  bo PostgREST nie umie GROUP BY.

  Kosztowało to 29 z 34 sekund generowania sitemapy, czyli więcej niż limit
  funkcji na Vercelu. Efekt: Googlebot dostawał timeout zamiast mapy witryny,
  a serwis miał 13 stron w indeksie.

  Grupowanie robi więc baza i oddaje kilkadziesiąt wierszy zamiast tysięcy —
  ta sama decyzja co przy `city_price_stats` i barometrze, i z tego samego
  powodu: 7 września skanowanie w Next wyczerpało budżet Disk IO tej instancji.

  Próg jest parametrem, a nie stałą, bo jego wartość mieszka w price-trends.ts
  (MIN_SAMPLE_SIZE) i to tam należy do decyzji o wiarygodności statystyki.
  Liczymy tylko żywe oferty — dokładnie jak fetchModelTrends, żeby lista stron
  w sitemapie zgadzała się z tym, które strony naprawdę istnieją.
*/

CREATE OR REPLACE FUNCTION model_slug_stats(min_sample integer DEFAULT 30)
RETURNS TABLE (
  brand text,
  model text,
  listings bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    btrim(specs->>'brand') AS brand,
    btrim(specs->>'model') AS model,
    count(*) AS listings
  FROM listings
  WHERE is_active
    AND current_price > 0
    AND btrim(coalesce(specs->>'brand', '')) <> ''
    AND btrim(coalesce(specs->>'model', '')) <> ''
  GROUP BY 1, 2
  HAVING count(*) >= min_sample
  ORDER BY count(*) DESC;
$$;

GRANT EXECUTE ON FUNCTION model_slug_stats(integer) TO anon, authenticated;
