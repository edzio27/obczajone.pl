-- 1. Ogloszenia wklejone z linku podgladu Otomoto (?isPreview=1).
--    Sprzedajacy widzi tam wersje, ktorej poza nim nikt nie oglada, wiec nie
--    powinny wchodzic do statystyk ani na strone glowna - jedno z nich zostalo
--    wykresem w naglowku. Nie kasujemy: historia cen zostaje, a wiersz mozna
--    przywrocic jednym UPDATE, gdyby okazalo sie, ze oferta jednak byla jawna.
UPDATE listings
SET is_active = false
WHERE url LIKE '%isPreview%';

-- 2. Ogony adresow: utm_*, fbclid, _gl, lid oraz session_olx / session_long_olx.
--    Oferte identyfikuje "-ID<id>.html" w sciezce, wiec zapytanie nie niesie
--    nic potrzebnego, a identyfikatory sesji OLX nie maja czego szukac w tabeli
--    czytelnej dla wszystkich. Kolejnosc jest istotna: krok 1 rozpoznaje
--    ogloszenia po parametrze, ktory ten krok usuwa.
UPDATE listings
SET url = split_part(url, '?', 1)
WHERE url LIKE '%?%';
