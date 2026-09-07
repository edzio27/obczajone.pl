/*
  # Pierwsza obserwowana cena jako kolumna, a nie wynik skanowania historii

  ## Co się stało

  Supabase przysłał ostrzeżenie "running out of Disk IO Budget". To nie jest
  ostrzeżenie o miejscu - cała baza waży 25 MB przy limicie 500 MB. Chodzi
  o liczbę operacji dyskowych, a w statystykach zapytań na drugim miejscu pod
  względem sumarycznego czasu stoi odczyt `listing_snapshots`.

  Powód: żeby powiedzieć, czy ogłoszenie staniało, potrzebujemy jego PIERWSZEJ
  ceny, a ta była wyliczana przez przejrzenie całej historii - 18 400 wierszy -
  przy każdym renderowaniu. Stron modeli jest ~90 i każda odświeża się co
  godzinę, więc ten sam pełny skan powtarzał się dziesiątki razy na godzinę.
  Przelot po modelach dokłada 1500 snapshotów dziennie, czyli z każdym dniem
  ten skan robi się droższy - problem sam z siebie by narastał.

  ## Rozwiązanie

  Pierwsza cena nie zmienia się nigdy: to jedna liczba na ogłoszenie, ustalana
  raz. Trzymanie jej w `listings` sprawia, że statystyki obniżek przestają
  w ogóle dotykać tabeli snapshotów - porównują dwie kolumny w tym samym
  wierszu. Historia cen zostaje tam, gdzie była; przestaje tylko być czytana
  po to, żeby odpowiedzieć na pytanie, na które wystarczy jedna wartość.

  Pilnuje tego wyzwalacz, a nie kod funkcji brzegowych. Snapshoty pisze dziś
  trzech różnych klientów (scrape-listing, daily-price-scraper i przelot po
  modelach) i czwarty pojawi się prędzej czy później - reguła umieszczona
  w jednym z nich rozjechałaby się przy pierwszym nowym.
*/

ALTER TABLE listings ADD COLUMN IF NOT EXISTS first_price numeric;

COMMENT ON COLUMN listings.first_price IS
  'Pierwsza cena zapisana dla tego ogłoszenia. Ustawiana raz, przez wyzwalacz przy pierwszym snapshocie. Punkt odniesienia dla obniżek.';

/*
  Ustawiamy tylko wtedy, gdy pusta - stąd COALESCE zamiast przypisania.
  Nadpisanie przy każdym snapshocie zmieniłoby "pierwszą cenę" w "ostatnią"
  i skasowało całą informację o obniżce.
*/
CREATE OR REPLACE FUNCTION set_listing_first_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.price IS NOT NULL AND NEW.price > 0 THEN
    UPDATE public.listings
    SET first_price = NEW.price
    WHERE id = NEW.listing_id
      AND first_price IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_listing_first_price ON listing_snapshots;
CREATE TRIGGER trg_set_listing_first_price
  AFTER INSERT ON listing_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION set_listing_first_price();

/*
  Uzupełnienie dla tego, co już w bazie jest. DISTINCT ON z sortowaniem po
  scraped_at daje najstarszy zapis każdego ogłoszenia - dokładnie to, co
  dotąd liczył kod, tyle że raz zamiast przy każdym wyświetleniu strony.
*/
UPDATE listings l
SET first_price = s.price
FROM (
  SELECT DISTINCT ON (listing_id) listing_id, price
  FROM listing_snapshots
  WHERE price > 0
  ORDER BY listing_id, scraped_at ASC
) s
WHERE s.listing_id = l.id
  AND l.first_price IS NULL;
