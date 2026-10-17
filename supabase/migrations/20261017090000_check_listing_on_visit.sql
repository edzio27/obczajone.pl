/*
  # Sprawdzenie ogłoszenia przy wejściu

  Ktoś otwiera ogłoszenie, którego cena jest starsza niż doba: przeglądarka
  prosi scrapera (`daily-price-scraper`, tryb `visit`) o sprawdzenie go od razu,
  a strona po kilku sekundach pokazuje aktualną cenę albo „zdjęte”.

  Powód: 15 października Ford Focus wisiał u nas jako aktywny i jako największa
  obniżka na stronie głównej przez 11 dni po tym, jak zniknął z Otomoto. Po
  przyspieszeniu przelotu aut okrążenie trwa ~4 dni, więc takie przypadki są
  rzadsze, ale człowiek, który właśnie otworzył ogłoszenie, nie powinien czekać
  na kolejny przebieg.

  Wywołanie przychodzi z przeglądarki, czyli od kogokolwiek. Dlatego wszystkie
  warunki sprawdza baza w jednej transakcji, a nie funkcja:
    - tylko aktywne ogłoszenia,
    - tylko niesprawdzane od 24 godzin (każde najwyżej raz na dobę),
    - najwyżej 60 takich sprawdzeń na godzinę w całym serwisie, więc przelecenie
      bazy po identyfikatorach daje co najwyżej jeden dodatkowy mały przelot.
  `last_checked_at` przestawiamy od razu przy przydziale, więc dwie karty
  otwarte naraz nie wywołają dwóch pobrań.
*/

CREATE TABLE IF NOT EXISTS visit_checks (
  id bigserial PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visit_checks_created_idx ON visit_checks (created_at DESC);

-- Tylko do odczytu przez funkcję poniżej i service_role; nikt z zewnątrz.
ALTER TABLE visit_checks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION claim_visit_check(p_listing_id uuid)
RETURNS TABLE (id uuid, url text, source text, current_price numeric, specs jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Globalny limit. Zamek doradczy szereguje równoległe wywołania, żeby
  -- licznik nie przepuścił kilku naraz na granicy limitu.
  PERFORM pg_advisory_xact_lock(hashtext('claim_visit_check'));
  IF (SELECT count(*) FROM public.visit_checks v WHERE v.created_at > now() - interval '1 hour') >= 60 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.listings l
  SET last_checked_at = now()
  WHERE l.id = p_listing_id
    AND l.is_active
    AND l.source IN ('otomoto', 'otodom')
    AND (l.last_checked_at IS NULL OR l.last_checked_at < now() - interval '24 hours')
  RETURNING l.id, l.url, l.source, l.current_price, l.specs;

  IF FOUND THEN
    INSERT INTO public.visit_checks (listing_id) VALUES (p_listing_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION claim_visit_check(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_visit_check(uuid) TO service_role;

-- Stare wpisy nie są potrzebne do niczego poza limitem godzinowym.
SELECT cron.unschedule('prune-visit-checks')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-visit-checks');
SELECT cron.schedule(
  'prune-visit-checks',
  '15 3 * * *',
  $cron$ DELETE FROM visit_checks WHERE created_at < now() - interval '2 days'; $cron$
);
