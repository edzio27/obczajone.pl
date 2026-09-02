/*
  DriveCheck Performance na całą Polskę - decyzja biznesowa właściciela serwisu.

  600 km z Wrocławia zamyka kraj z zapasem: najdalszy punkt to Suwałki (519 km),
  dalej Białystok (475) i Przemyśl (431). 600 to jednocześnie górna granica
  ograniczenia partners_service_radius_range, więc dalej się nie da.

  Co to realnie zmienia w doborze firm przy ogłoszeniu:
    - DriveCheck pojawia się tam, gdzie dziś nie pojawia się nikt, bo nawet
      awaryjny próg 350 km nie sięga (Suwalszczyzna, Podlasie, Podkarpacie);
    - na dystansach 250-350 km przestaje być pokazywany jako firma spoza
      swojego zasięgu i trafia do normalnej listy.

  Zasięg jest polem, które partner ustawia sobie sam w panelu (zakładka Profil),
  i nie pilnuje go partner_self_update_guard - więc Karol może tę wartość
  później zmienić bez pytania nikogo. Jeśli ma zostać na 600, musi o niej
  wiedzieć.
*/

UPDATE partners
SET service_radius_km = 600
WHERE slug = 'drivecheck-performance';

SELECT name, city, service_radius_km
FROM partners
WHERE category = 'car'
ORDER BY service_radius_km DESC;
