/*
  Największe obniżki liczone w bazie, z odsianiem błędów scrapera.

  Dwa problemy naraz, oba widoczne 6 października, gdy sekcja obniżek awansowała
  na drugie miejsce strony głównej.

  PIERWSZY - treść. Trzy "największe obniżki" pokazywane czytelnikowi to były
  błędy zbierania danych, nie przeceny:
    - ogłoszenie bez tytułu, cena 590 000 -> 0 (-100%),
    - Audi A6 Allroad, 648 888 -> 64 888 (-90%),
    - apartament, 7 750 000 -> 775 000 (-90%).
  W dwóch ostatnich zgubiła się jedna cyfra. Pierwsza prawdziwa obniżka stała
  dopiero na czwartym miejscu (Ford Focus, 7 500 -> 4 000). Serwis, którego
  jedynym produktem jest rzetelna historia cen, pokazywał na wejściu trzy
  nieprawdy.

  Stąd próg 70%: używane auto ani mieszkanie nie tanieje o więcej, a zgubiona
  cyfra daje dokładnie okolice -90%. Odsiewamy też cenę zero i pusty tytuł -
  jedno i drugie oznacza przelot, który się nie udał. To kryterium rzeczowe,
  nie wydajnościowe, więc nie zestarzeje się razem z planem hostingu.

  DRUGI - koszt. `fetchBiggestPriceDrops` pobierała WSZYSTKIE aktywne
  ogłoszenia (13 892 w dniu pisania, z paginacją po 1000), liczyła procenty
  w Node i brała trzy. Przy każdej regeneracji strony głównej i strony
  /obnizki. To ten sam wzorzec, który we wrześniu wywracał deploye przy
  medianach cen mieszkań - praca należąca do bazy wykonywana w aplikacji.
  Teraz baza zwraca tyle wierszy, ile widać na ekranie.
*/

CREATE OR REPLACE FUNCTION biggest_price_drops(p_limit int DEFAULT 3)
RETURNS TABLE (
  id uuid,
  title text,
  location text,
  current_price numeric,
  first_price numeric,
  source text,
  created_at timestamptz,
  image_url text,
  ai_opinion_rating numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT l.id, l.title, l.location, l.current_price, l.first_price,
         l.source, l.created_at, l.image_url, l.ai_opinion_rating
  FROM listings l
  WHERE l.is_active
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

GRANT EXECUTE ON FUNCTION biggest_price_drops(int) TO anon, authenticated;

-- Indeks pod ten sort: bez niego baza i tak przechodzi po wszystkich aktywnych.
CREATE INDEX IF NOT EXISTS idx_listings_active_price_drop
  ON listings (((current_price::numeric / first_price)))
  WHERE is_active AND first_price > 0 AND current_price > 0;
