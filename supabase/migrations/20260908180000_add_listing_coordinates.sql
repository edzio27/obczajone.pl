/*
  # Współrzędne ogłoszenia, zamiast zgadywania po nazwie miasta

  Dobór firmy do oględzin liczy odległość od ogłoszenia, a współrzędne brał
  dotąd ze słownika `CITY_COORDS` w lib/geo.ts — listy 168 miast wpisanych
  ręcznie. Cokolwiek spoza niej nie ma współrzędnych, więc nie ma dopasowania:
  18 z 52 aktywnych ofert Otodomu wypada na tym kroku, choć miasto mają.

  Najboleśniejszy przykład to Pogórze pod Gdynią. Leży w zasięgu firmy, która
  robi odbiory w Trójmieście, ale słownika nie zna, więc te ogłoszenia nie
  zobaczą żadnego partnera. Dopisywanie kolejnych wsi do listy w kodzie nie
  ma końca — w Polsce jest ich kilkadziesiąt tysięcy.

  Otodom podaje przy każdym ogłoszeniu dokładne `location.coordinates`, więc
  wystarczy je zapisać. Dopasowanie przestaje wtedy zależeć od tego, czy ktoś
  wpisał daną miejscowość do słownika, i robi się dokładne co do adresu
  zamiast co do miasta.

  Kolumny są wspólne dla obu źródeł, choć wypełnia je na razie tylko Otodom.
  Przy Otomoto współrzędne mamy okrężną drogą — z geokodowania adresu
  sprzedającego — i ta ścieżka zostaje bez zmian.
*/

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

COMMENT ON COLUMN listings.lat IS
  'Szerokość geograficzna przedmiotu ogłoszenia, jeśli źródło ją podaje. Pierwszeństwo przed słownikiem miast przy doborze partnera.';

COMMENT ON COLUMN listings.lng IS
  'Długość geograficzna przedmiotu ogłoszenia, jeśli źródło ją podaje.';
