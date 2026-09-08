/*
  Nowy partner: Work Hunters — odbiory techniczne mieszkań od dewelopera,
  Trójmiasto. Pierwszy partner w kategorii `home`; dotąd katalog miał wyłącznie
  firmy od aut.

  Dane pochodzą ze strony firmy na Facebooku (opis, telefon, osoba prowadząca).
  Czego tam NIE było i czego świadomie nie wpisuję:

    - email, website          — firma podaje wyłącznie telefon i Messengera
    - price_from              — cennika nie publikuje
    - response_time           — nie deklaruje
    - services                — opis mówi ogólnie o odbiorach pod względem
                                prawnym i technicznym, bez wyliczenia usług

  Puste pole wygląda gorzej niż wypełnione, ale wymyślone wygląda wiarygodnie
  i jest nieprawdziwe — a to jest katalog, w którym ktoś wybiera firmę do
  wpuszczenia do mieszkania. Partner uzupełni je sam w panelu.

  is_verified zostaje FALSE: weryfikacja ma jawne kryteria opisane na
  /dla-firm#weryfikacja i nikt jej tutaj nie przeprowadził. Odznaka przyznana
  „bo firma wygląda porządnie" psuje znaczenie odznaki u wszystkich pozostałych.
  is_promoted też FALSE — wyróżnienie jest płatne i wymaga oznaczenia.

  Logo leży w repo pod public/partners/, więc MUSI być zacommitowane
  i wypchnięte, ZANIM ten skrypt pójdzie do bazy - inaczej profil pokaże
  złamany obrazek zamiast ikony zastępczej.
*/

BEGIN;

INSERT INTO partners (
  name,
  category,
  city,
  voivodeship,
  slug,
  referral_slug,
  logo_url,
  contact_url,
  phone,
  description,
  about,
  lat,
  lng,
  service_radius_km,
  partner_since,
  is_active,
  is_verified,
  is_promoted
)
VALUES (
  'Work Hunters — odbiory mieszkań, Trójmiasto',
  'home',
  'Gdańsk',
  'pomorskie',
  'work-hunters-trojmiasto',
  'work-hunters',
  '/partners/work-hunters-trojmiasto.jpg',
  -- UZUPEŁNIĆ: adres strony firmy na Facebooku (kolumna jest NOT NULL).
  'FACEBOOK_URL_DO_UZUPELNIENIA',
  '721 097 799',
  'Odbiory deweloperskie mieszkań w Trójmieście — od strony technicznej i prawnej.',
  'Work Hunters prowadzi odbiory techniczne mieszkań od dewelopera na terenie ' ||
  'Trójmiasta i okolic. Firmę prowadzi inż. arch. Łukasz Frąckowiak.' ||
  E'\n\n' ||
  'Odbiór obejmuje sprawdzenie mieszkania pod względem technicznym i prawnym, ' ||
  'zanim kupujący podpisze protokół — czyli w jedynym momencie, w którym ' ||
  'usterki są jeszcze kosztem dewelopera, a nie właściciela.' ||
  E'\n\n' ||
  'Obszar działania: Gdańsk, Gdynia, Sopot i okolice.',
  -- Gdańsk; zasięg 40 km obejmuje całe Trójmiasto wraz z obrzeżami.
  54.3520,
  18.6466,
  40,
  CURRENT_DATE,
  true,
  false,
  false
);

COMMIT;

-- Kontrola: jeden wiersz, kategoria `home`, logo i współrzędne ustawione.
SELECT name, slug, category, city, voivodeship, phone, logo_url,
       lat, lng, service_radius_km, is_active, is_verified
FROM partners
WHERE slug = 'work-hunters-trojmiasto';
