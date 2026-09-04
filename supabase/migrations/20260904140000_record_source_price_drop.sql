/*
  # Obniżka deklarowana przez Otomoto, obok naszej własnej obserwacji

  Strona wyników podaje przy części ofert pole `priceDrop`: procent obniżki
  i cenę odniesienia. To jest gotowa odpowiedź na pytanie, na które my czekamy
  tygodniami - ale jest to ICH wyliczenie, nie nasza obserwacja, więc nie idzie
  na stronę i nie wchodzi do median na /ile-spada-cena. Zapisujemy je wyłącznie
  jako kontrolę: kiedy uzbieramy własne obniżki, będzie z czym je porównać
  i będzie wiadomo, czy nasza metoda liczenia trzyma się rzeczywistości.

  ## Uwaga do nazwy pola u źródła

  Otomoto nazywa cenę odniesienia `lowestPrice`, co wprowadza w błąd - jest ona
  WYŻSZA od ceny bieżącej. Sprawdzone na żywej ofercie: cena 184 900 zł,
  `lowestPrice` 187 900 zł (podane w groszach jako 18790000), `percentage` 1.6.
  Rachunek się zgadza tylko w jedną stronę: (187900 - 184900) / 187900 = 1,6%.
  Czyli to cena SPRZED obniżki. Nasza kolumna nazywa się więc zgodnie z tym,
  czym to jest, a nie zgodnie z tym, jak nazywa to źródło.
*/

ALTER TABLE listing_snapshots
  ADD COLUMN IF NOT EXISTS source_drop_percent numeric,
  -- W złotych, nie w groszach - przeliczane przy zapisie.
  ADD COLUMN IF NOT EXISTS source_price_before numeric;

COMMENT ON COLUMN listing_snapshots.source_drop_percent IS
  'Procent obniżki deklarowany przez Otomoto w chwili tego odczytu. Dane kontrolne - nie publikujemy ich i nie liczymy z nich statystyk.';

COMMENT ON COLUMN listing_snapshots.source_price_before IS
  'Cena odniesienia sprzed obniżki wg Otomoto, w złotych. Źródło nazywa ją "lowestPrice", choć jest wyższa od ceny bieżącej.';
