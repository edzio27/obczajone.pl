/*
  Jednorazowa naprawa danych — DriveCheck Performance.

  Diagnoza: Karol nie ma wpisu w `partner_users`, więc nie ma dostępu do
  /panel-partnera i nie mógł dodać oględzin przez zakładkę „Oględziny”.
  Swoje werdykty wpisał jako zwykłe opinie o ogłoszeniach (tabela `reviews`),
  a te — nawet zatwierdzone — z założenia nie trafiają na profil partnera.

  Uruchomić w Supabase → SQL Editor (połączenie bezpośrednie jest traktowane
  jako `is_trusted_writer()`, więc `is_approved = true` nie zostanie cofnięte
  przez `partner_inspection_write_guard`).
*/

-- 1. Podpięcie konta Karola do firmy — od tej pory ma panel partnera.
INSERT INTO partner_users (partner_id, user_id, role)
VALUES (
  '4dca3ab5-730f-4be6-8d23-7cf33d4d730c',  -- DriveCheck Performance
  '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471',  -- konto „DriveCheck Performance”
  'owner'
)
ON CONFLICT (partner_id, user_id) DO NOTHING;

-- 2. Duplikat: dwa identyczne wpisy do tego samego ogłoszenia, różnica 23 ms
--    (podwójne kliknięcie „Wyślij”). Zostawiamy nowszy.
DELETE FROM reviews WHERE id = '59ca9ff1-2283-4be2-8afc-42554e3490af';

-- 3. Przeniesienie werdyktów Karola do `partner_inspections`, czyli tam, skąd
--    czyta je profil firmy i sekcja przy ogłoszeniu. Opinie w `reviews`
--    zostają nietknięte — nadal wiszą przy ogłoszeniach.
INSERT INTO partner_inspections (
  partner_id, listing_id, author_user_id,
  verdict, summary, inspected_at, is_approved, created_at
)
SELECT
  '4dca3ab5-730f-4be6-8d23-7cf33d4d730c',
  r.listing_id,
  r.user_id,
  CASE
    WHEN r.rating >= 4 THEN 'recommended'
    WHEN r.rating = 3  THEN 'reservations'
    ELSE 'not_recommended'
  END,
  btrim(r.comment),
  r.created_at::date,
  true,
  r.created_at
FROM reviews r
WHERE r.user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471'
  AND r.is_approved = true
  AND char_length(btrim(r.comment)) BETWEEN 20 AND 5000
ON CONFLICT (partner_id, listing_id) DO NOTHING;

-- 4. Kontrola: `inspection_count` ustawia trigger, powinno być > 0.
SELECT name, rating_count, inspection_count
FROM partners
WHERE id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c';
