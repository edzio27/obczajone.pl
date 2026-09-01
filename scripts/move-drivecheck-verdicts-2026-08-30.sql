/*
  Werdykty DriveCheck z 30 sierpnia lądują tam, gdzie ich miejsce - i sprzątamy
  kopie, które zostały po poprzedniej naprawie.

  Diagnoza. Sekcja oględzin przy ogłoszeniu (ListingInspections) czyta wyłącznie
  `partner_inspections` i stoi wysoko, zaraz pod ogłoszeniem. Karol trzy nowe
  werdykty wpisał znowu formularzem opinii na stronie ogłoszenia, czyli do
  `reviews` - a te lądują na samym dole strony, pod historią cen i podobnymi
  ogłoszeniami. Stąd wrażenie, że oględzin "nie ma na górze".

  Przy okazji wychodzi, że dedupe-drivecheck-reviews.sql nigdy nie został
  uruchomiony: siedem werdyktów z kwietnia i 28 sierpnia jest nadal w obu
  tabelach naraz, więc na siedmiu stronach ogłoszeń ta sama treść stoi dwa razy
  - raz jako oględziny firmy, raz jako opinia użytkownika - i dwa razy
  w danych strukturalnych. Ten skrypt domyka jedno i drugie.

  Werdykty wpisane ręcznie, nie z przelicznika ocen. Automat z poprzedniego
  skryptu (ocena 2 -> not_recommended) postawiłby "Odradzam" nad tekstem, który
  kończy się słowami "Auto warte zakupu po uwzględnieniu nakładów" - a to jest
  publiczna opinia firmy o cudzym samochodzie, więc nie ma tu miejsca na
  przybliżenie.

  Trzecia opinia z 30 sierpnia (0e01efbc, o zdjęciach wygenerowanych przez AI)
  zostaje opinią. To uwaga o samym ogłoszeniu, a nie werdykt z oględzin na
  miejscu - w sekcji oględzin byłaby nadużyciem.

  Uruchomić w Supabase → SQL Editor. Połączenie bezpośrednie liczy się jako
  is_trusted_writer(), więc partner_inspection_write_guard nie cofnie
  is_approved.
*/

BEGIN;

-- 1. Dwa werdykty z 30 sierpnia do partner_inspections.
INSERT INTO partner_inspections (
  partner_id, listing_id, author_user_id,
  verdict, summary, inspected_at, is_approved, created_at
)
SELECT
  '4dca3ab5-730f-4be6-8d23-7cf33d4d730c',  -- DriveCheck Performance
  r.listing_id,
  r.user_id,
  v.verdict,
  btrim(r.comment),
  r.created_at::date,
  true,
  r.created_at
FROM reviews r
JOIN (VALUES
  -- Seat Alhambra: mechanicznie dobrze, lista rzeczy do wymiany, "warte zakupu
  -- po uwzględnieniu nakładów".
  ('6358c976-26ca-40cc-bab9-98c33c86f955'::uuid, 'reservations'),
  -- Szkoda tylna z USA i ślady napraw przodu, ale konkluzja to "zakup wyłącznie
  -- po świadomej analizie i negocjacji ceny", nie odradzenie.
  ('86b69aff-baa0-4ce0-bd1e-0234c4f2da75'::uuid, 'reservations')
) AS v(listing_id, verdict) ON v.listing_id = r.listing_id
WHERE r.user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471'
  AND r.is_approved = true
ON CONFLICT (partner_id, listing_id) DO NOTHING;

-- 2. Kasujemy kopie w reviews - ale tylko te, których treść stoi już
--    w partner_inspections. Opinia o zdjęciach z AI nie ma tam odpowiednika,
--    więc ten warunek zostawia ją nietkniętą.
DELETE FROM reviews r
WHERE r.user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471'
  AND EXISTS (
    SELECT 1 FROM partner_inspections i
    WHERE i.listing_id = r.listing_id
      AND i.partner_id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c'
  );

COMMIT;

-- Kontrola: oczekiwane 9 oględzin i 1 pozostała opinia (ta o zdjęciach z AI).
SELECT
  (SELECT count(*) FROM partner_inspections
   WHERE partner_id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c' AND is_approved) AS ogledziny,
  (SELECT count(*) FROM reviews
   WHERE user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471') AS pozostale_opinie,
  (SELECT inspection_count FROM partners
   WHERE id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c') AS licznik_na_profilu;
