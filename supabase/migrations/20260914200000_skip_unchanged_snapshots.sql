/*
  # Zapisujemy cenę tylko wtedy, gdy się zmieniła

  Trzeci mail o Disk IO w ciągu tygodnia. Tym razem winne nie są odczyty —
  z dysku poszło raptem 5271 bloków, trafienia w cache 100%. Winne są zapisy,
  a konkretnie ich bezużyteczna większość:

    31 182 snapshoty razem
     8 566 pierwszych obserwacji
     1 170 realnych zmian ceny
    21 446 powtórzeń tej samej ceny   ← 68,8%

  Co godzinę dopisywaliśmy setki wierszy mówiących „cena taka sama jak
  poprzednio", płacąc za każdy zapisem, utrzymaniem indeksu i późniejszym
  autovacuum. Na t4g.nano, gdzie Disk IO rozlicza się kredytami, to jest
  najdroższy możliwy sposób nieprzekazania żadnej informacji.

  ## Dlaczego nic nie tracimy

  Szereg cenowy odtwarza się w całości z pierwszej obserwacji i kolejnych
  zmian — punkty pomiędzy nimi są z definicji interpolacją prostej poziomej.
  Wszystko, co liczymy (pierwsza cena, obniżka, moment przeceny, mediana),
  bierze się z tych samych wierszy co dotąd.

  Tracimy jedno: informację „sprawdzaliśmy i było tyle samo". Do tego służy
  `listings.last_checked_at`, które i tak przesuwamy przy każdej próbie.

  ## Dlaczego wyzwalacz, a nie poprawka w funkcjach

  Snapshoty pisze dziś trzech klientów — scrape-listing, daily-price-scraper
  i dwa przeloty — a czwarty pojawi się prędzej czy później. Reguła umieszczona
  w jednym z nich byłaby regułą, której pozostali nie znają.
*/

/*
  Indeks pod odczyt „ostatnia cena tego ogłoszenia". Bez niego wyzwalacz
  robiłby przy każdym wstawieniu skan po wszystkich snapshotach ogłoszenia,
  czyli zamienialibyśmy zapis na odczyt - a nie o to chodzi.
*/
CREATE INDEX IF NOT EXISTS listing_snapshots_latest_idx
  ON listing_snapshots (listing_id, scraped_at DESC);

CREATE OR REPLACE FUNCTION skip_unchanged_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  ostatnia numeric;
BEGIN
  SELECT price INTO ostatnia
  FROM public.listing_snapshots
  WHERE listing_id = NEW.listing_id
  ORDER BY scraped_at DESC
  LIMIT 1;

  -- RETURN NULL w wyzwalaczu BEFORE INSERT cicho pomija wiersz. Wołający
  -- dostaje sukces, bo z jego punktu widzenia nic złego się nie stało:
  -- cena jest zapisana, tyle że wcześniej.
  IF ostatnia IS NOT NULL AND ostatnia = NEW.price THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skip_unchanged_snapshot ON listing_snapshots;
CREATE TRIGGER trg_skip_unchanged_snapshot
  BEFORE INSERT ON listing_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION skip_unchanged_snapshot();
