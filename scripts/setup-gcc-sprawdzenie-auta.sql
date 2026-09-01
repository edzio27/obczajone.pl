/*
  Dodanie partnera: GCC Sprawdzenie Auta (Gablota Car Check), Opole/Wrocław.

  Jeden skrypt zamiast "najpierw panel admina, potem SQL": panel ustawia sześć
  pól, a profil bez współrzędnych, usług i ceny "od" wygląda martwo w dniu,
  w którym partner pierwszy raz na niego wejdzie.

  Dane: wiadomość od firmy (telefon, e-mail, obszar) oraz ogledziny-auta.pl
  (zakres usług, widełki cenowe). Adres e-mail podany przez firmę
  (gcc@ogledziny-auta.pl) różni się od tego na stronie
  (gablotacarcheck@gmail.com) - bierzemy ten pierwszy, bo jest nowszy.

  Punkt odniesienia to Opole, nie Wrocław, z dwóch powodów:
    - to geometryczny środek deklarowanego obszaru (Wrocław 78 km, Nysa 43 km,
      Ostrów Wielkopolski 108 km), więc jeden promień domyka wszystko;
    - we Wrocławiu stoi już DriveCheck Performance, a dwie firmy w tym samym
      punkcie na mapie partnerów wyglądają jak duplikat.
  Promień 150 km domyka najdalszy Ostrów Wielkopolski z zapasem.

  is_verified zostaje FALSE - kryteria z /dla-firm#weryfikacja wymagają
  sprawdzonego NIP-u i co najmniej 3 opublikowanych opinii, a firma nie ma
  jeszcze ani jednej. Odznaka nadana na kredyt jest bezwartościowa także dla
  niej samej.
*/

BEGIN;

INSERT INTO partners (
  name, slug, category, city, voivodeship, lat, lng, service_radius_km,
  contact_url, website, phone, email, referral_slug,
  price_from, description, services, about,
  is_active, is_verified, is_promoted, partner_since
) VALUES (
  'GCC Sprawdzenie Auta',
  'gcc-sprawdzenie-auta',
  'car',
  'Opole',
  'opolskie',
  50.6751,
  17.9213,
  150,
  'https://ogledziny-auta.pl/',
  'https://ogledziny-auta.pl/',
  '795 906 806',
  'gcc@ogledziny-auta.pl',
  'gcc',
  400,
  'Oględziny auta przed zakupem — Opole, Wrocław, Nysa, Ostrów Wielkopolski',
  ARRAY[
    'Oględziny przedzakupowe',
    'Weryfikacja ogłoszenia ze stanem faktycznym',
    'Pomiar grubości lakieru i kontrola blacharki',
    'Diagnostyka komputerowa',
    'Jazda próbna',
    'Kontrola na stacji diagnostycznej',
    'Odbiór samochodu nowego z salonu',
    'Oględziny aut zabytkowych i powypadkowych',
    'Dokumentacja zdjęciowa pojazdu'
  ],
  'GCC Sprawdzenie Auta (Gablota Car Check) sprawdza samochody przed zakupem ' ||
  'na terenie województwa opolskiego, dolnośląskiego i południowej Wielkopolski. ' ||
  E'\n\n' ||
  'Oględziny obejmują weryfikację tego, co obiecuje ogłoszenie, wobec stanu ' ||
  'faktycznego auta: pomiar grubości lakieru i kontrolę blacharki, diagnostykę ' ||
  'komputerową, jazdę próbną oraz — w razie potrzeby — kontrolę na stacji ' ||
  'diagnostycznej. Klient dostaje dokumentację zdjęciową i ocenę, na podstawie ' ||
  'której decyduje o zakupie. Firma odbiera także samochody nowe z salonu oraz ' ||
  'ogląda auta zabytkowe i powypadkowe.' ||
  E'\n\n' ||
  'Obszar działania: Opole, Wrocław, Nysa, Ostrów Wielkopolski, Otmuchów, ' ||
  'Paczków, Strzelce Opolskie, Oleśnica, Kępno, Strzelin i okolice.' ||
  E'\n\n' ||
  'Firma na Facebooku: facebook.com/GablotaCarCheck',
  true,
  false,
  false,
  CURRENT_DATE
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  voivodeship = EXCLUDED.voivodeship,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  service_radius_km = EXCLUDED.service_radius_km,
  contact_url = EXCLUDED.contact_url,
  website = EXCLUDED.website,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  referral_slug = EXCLUDED.referral_slug,
  price_from = EXCLUDED.price_from,
  description = EXCLUDED.description,
  services = EXCLUDED.services,
  about = EXCLUDED.about;

COMMIT;

-- Kontrola: jeden wiersz, ze współrzędnymi i promieniem.
SELECT name, slug, city, voivodeship, lat, lng, service_radius_km,
       referral_slug, price_from, is_active, is_verified
FROM partners
WHERE slug = 'gcc-sprawdzenie-auta';

-- Kontrola nakładania się obszarów z DriveCheck (Wrocław, promień 250 km).
SELECT name, city, service_radius_km FROM partners WHERE category = 'car' ORDER BY name;
