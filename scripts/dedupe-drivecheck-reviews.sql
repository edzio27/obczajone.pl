/*
  Usunięcie duplikatu treści na stronach ogłoszeń.

  Skrypt fix-drivecheck-partner-content.sql skopiował werdykty Karola z tabeli
  `reviews` do `partner_inspections` i celowo zostawił oryginały, żeby nic nie
  zniknęło ze stron ogłoszeń. Skutek uboczny: ta sama treść jest teraz na
  stronie dwa razy - raz w sekcji oględzin partnera, raz w opiniach
  użytkowników - i dwa razy w danych strukturalnych, jako Review osoby i
  Review organizacji.

  Dla Google to wygląda jak sztuczne mnożenie recenzji tego samego autora,
  a dla czytelnika po prostu jak błąd.

  Werdykty zostają tam, gdzie ich miejsce: w `partner_inspections`. Kasujemy
  tylko kopie w `reviews`. Uruchomić w Supabase → SQL Editor.
*/

BEGIN;

-- Kontrola przed: powinno pokazać 7 wierszy do usunięcia.
SELECT count(*) AS do_usuniecia
FROM reviews r
WHERE r.user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471'
  AND EXISTS (
    SELECT 1 FROM partner_inspections i
    WHERE i.listing_id = r.listing_id
      AND i.partner_id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c'
  );

DELETE FROM reviews r
WHERE r.user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471'
  AND EXISTS (
    SELECT 1 FROM partner_inspections i
    WHERE i.listing_id = r.listing_id
      AND i.partner_id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c'
  );

COMMIT;

-- Kontrola po: werdykty nadal na miejscu, kopie zniknęły.
SELECT
  (SELECT count(*) FROM partner_inspections
   WHERE partner_id = '4dca3ab5-730f-4be6-8d23-7cf33d4d730c' AND is_approved) AS ogledziny,
  (SELECT count(*) FROM reviews
   WHERE user_id = '37f0e5d5-c4a9-45c7-86d3-3bfcd3eb2471') AS pozostale_opinie;
