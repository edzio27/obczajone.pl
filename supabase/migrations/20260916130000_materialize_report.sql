/*
  # Raport liczony przez crona, nie przez odwiedzającego

  Trzy podejścia do /dla-mediow nie wyszły i każde z innego powodu:

  - prerender przy budowaniu przekraczał ośmiosekundowy limit PostgREST, bo
    liczył się równolegle z sześćdziesięcioma innymi stronami;
  - `force-dynamic` wyłączył cache CDN (Next 13.5 wymusza wtedy no-store), więc
    każde wejście oznaczało dwa ciężkie zapytania, a strona odpowiadała 21 sekund;
  - podniesienie limitu do 30 sekund pozwoliło zapytaniu trzymać połączenie pół
    minuty i timeout zaczęły łapać wszystkie strony, ze stroną główną włącznie -
    czyli dokładnie zatkana pula połączeń z 9 września.

  Wspólny mianownik: percentyle liczone w chwili, gdy ktoś patrzy. Na tej
  instancji to się nie uda żadnym sposobem, więc liczymy je wtedy, gdy nikt nie
  czeka - raz na godzinę, cronem - i zapisujemy wynik. Strona czyta jeden wiersz.

  Ta sama zasada, którą wypracowaliśmy po awariach z 7 i 9 września: drobno,
  często i poza ścieżką żądania.
*/

CREATE TABLE IF NOT EXISTS report_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  models jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE report_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS everyone_can_read_report ON report_snapshot;
CREATE POLICY everyone_can_read_report ON report_snapshot FOR SELECT USING (true);

/*
  Przeliczenie. SECURITY DEFINER, bo woła je cron, a nie użytkownik - i tylko
  ono zapisuje do tabeli, do której wszyscy inni mają wyłącznie odczyt.
*/
CREATE OR REPLACE FUNCTION refresh_report_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO report_snapshot (id, sources, models, computed_at)
  VALUES (
    1,
    coalesce((SELECT jsonb_agg(to_jsonb(r)) FROM price_drop_report(14) r), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM model_drop_report(14, 20) m), '[]'::jsonb),
    now()
  )
  ON CONFLICT (id) DO UPDATE
    SET sources = excluded.sources,
        models = excluded.models,
        computed_at = excluded.computed_at;
END;
$$;

-- Pierwsze wypełnienie, żeby strona miała co pokazać od razu po wdrożeniu.
SELECT refresh_report_snapshot();

/*
  O :35, czyli w wolnej minucie. Przeloty scrapera stoją na :07 (ceny), :20
  (modele) i :50 (Otodom) - rozsuwanie ich to nie estetyka, tylko sposób, żeby
  nie schodziły się na jednym połączeniu.
*/
SELECT cron.schedule(
  'refresh-report-snapshot',
  '35 * * * *',
  $cron$ SELECT refresh_report_snapshot(); $cron$
);
