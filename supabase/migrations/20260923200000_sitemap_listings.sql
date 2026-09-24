/*
  # Adresy ogłoszeń do sitemapy, wybrane przez bazę

  Poprzednia wersja pobierała wszystkie czternaście tysięcy ogłoszeń piętnastoma
  zapytaniami i odsiewała je w Node. Przy przeciążonej instancji nie dało się
  tego dokończyć - budowanie przerywało się na sitemapie po trzech próbach,
  czyli naprawa obciążenia nie mogła wejść, bo baza była obciążona.

  Filtr należy do zapytania, tym bardziej że odsiewa trzy czwarte wierszy.
  PostgREST nie porówna dwóch kolumn ze sobą (`first_price <> current_price`),
  więc robi to funkcja.

  Kryterium jest treściowe, nie wydajnościowe: strona ogłoszenia ma sens, gdy
  pokazuje coś, czego nie ma w samym ogłoszeniu. Czyli historię ceny albo to,
  że oferta zniknęła. Aktywna oferta stojąca od początku na tej samej cenie jest
  kopią cudzej treści - zostaje dostępna w serwisie, ale nie zajmuje crawlerowi
  czasu ani nam połączenia.
*/

CREATE OR REPLACE FUNCTION sitemap_listings()
RETURNS TABLE (id uuid, last_checked_at timestamptz, is_active boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id, last_checked_at, is_active
  FROM listings
  WHERE current_price > 0
    AND title <> ''
    AND (
      NOT is_active                                   -- archiwum: zawsze
      OR (first_price > 0 AND first_price <> current_price)  -- ma historię ceny
    )
  ORDER BY id;
$$;

GRANT EXECUTE ON FUNCTION sitemap_listings() TO anon, authenticated;
