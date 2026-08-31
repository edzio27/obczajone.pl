/*
  Zasięg deklarowany przez partnera zamiast sztywnych 200 km dla wszystkich.

  Firmy różnią się tym, jak daleko jeżdżą: jedna obsługuje jedno województwo,
  inna pół kraju. Wspólny próg albo obcinał tę pierwszą, albo wysyłał drugiej
  zapytania, których nie obsłuży.

  Domyślne 200 km odpowiada dotychczasowemu zachowaniu, więc uruchomienie tego
  skryptu niczego nie zmienia, dopóki partner sam nie ustawi swojej wartości
  w panelu.

  URUCHOMIĆ PRZED WYPCHNIĘCIEM KODU — nowa kolumna jest w zapytaniach o profil
  partnera, a zapytanie o nieistniejącą kolumnę zwraca błąd i wygasza CTA
  oraz katalog partnerów.
*/

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS service_radius_km integer NOT NULL DEFAULT 200
  CONSTRAINT partners_service_radius_range CHECK (service_radius_km BETWEEN 20 AND 600);

-- DriveCheck deklaruje na swoim profilu Dolny Śląsk, Opolszczyznę, Śląsk
-- i Wielkopolskę - 200 km nie domyka Wielkopolski.
UPDATE partners SET service_radius_km = 250 WHERE slug = 'drivecheck-performance';

SELECT name, city, service_radius_km FROM partners ORDER BY name;
