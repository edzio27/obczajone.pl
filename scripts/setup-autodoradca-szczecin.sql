/*
  Uzupełnienie profilu: Autodoradca Szczecin.

  Panel admina zakłada partnera z sześcioma polami (nazwa, kategoria, miasto,
  województwo, link kontaktowy, opis). Pozostałych nie ma dziś w żadnym
  interfejsie, a bez nich profil jest niekompletny:

    - lat/lng          — bez nich firma nie pojawia się na mapie partnerów
                         ani w doborze po odległości przy ogłoszeniach
    - referral_slug    — bez niego odznaka i link polecający nie mają czego liczyć
    - phone/email/www  — partner może je ustawić sam w panelu, ale profil
                         wygląda martwo, dopóki tego nie zrobi

  Dane z autodoradcaszczecin.pl i z wiadomości od firmy.
  Uruchomić PO dodaniu partnera w panelu admina.
*/

BEGIN;

UPDATE partners SET
  lat = 53.4285,
  lng = 14.5528,
  referral_slug = 'autodoradca',
  phone = '533 284 977',
  email = 'autodoradcaszczecin@gmail.com',
  website = 'https://www.autodoradcaszczecin.pl/',
  price_from = 249,
  response_time = 'do 24h',
  services = ARRAY[
    'Oględziny przedzakupowe',
    'Odbiór samochodu nowego',
    'Diagnostyka komputerowa',
    'Kontrola podwozia',
    'Jazda próbna',
    'Raport techniczny ze zdjęciami'
  ],
  about =
    'Autodoradca Szczecin to oględziny pojazdów przed zakupem prowadzone przez ' ||
    'Szymona Jankowiaka na terenie Szczecina i województwa zachodniopomorskiego. ' ||
    E'\n\n' ||
    'Zakres obejmuje sprawdzenie stanu technicznego, diagnostykę komputerową, ' ||
    'kontrolę podwozia i jazdę próbną. Klient dostaje raport techniczny ze ' ||
    'zdjęciami, na podstawie którego może podjąć decyzję o zakupie. ' ||
    E'\n\n' ||
    'Obszar działania: Szczecin, Stargard, Goleniów, Police, Gryfino, Nowogard, ' ||
    'Morzyczyn, Zieleniewo, Lipnik.'
WHERE slug = 'autodoradca-szczecin';

COMMIT;

-- Kontrola: powinien być jeden wiersz z ustawionymi współrzędnymi.
SELECT name, slug, city, voivodeship, lat, lng, referral_slug, price_from, is_active
FROM partners
WHERE slug = 'autodoradca-szczecin';
