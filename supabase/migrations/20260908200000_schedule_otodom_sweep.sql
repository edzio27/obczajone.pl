/*
  # Kolejka i harmonogram przelotu po Otodomie

  Strona nieruchomości rosła dotąd wyłącznie z wklejek: 52 aktywne oferty wobec
  ponad trzech tysięcy samochodowych. Przelot po modelach obchodzi tylko
  Otomoto, więc kategoria `home` — a od dziś także pierwszy partner w niej —
  nie miała czego obsługiwać.

  Ta sama konstrukcja co przy Otomoto i z tego samego powodu: kolejność bierze
  się z tabeli, a nie ze stałej listy w kodzie. Jeden przebieg mieści około
  dwudziestu pozycji, więc lista zaczynana od początku odświeżałaby w kółko
  początek i nigdy nie dowiozła końcówki, meldując przy tym sukces.

  ## Zakres

  11 miast po 2 strony wyników. Każdy adres sprawdzony pojedynczo — dwunasta
  pozycja, Bydgoszcz, wypadła z listy, bo Otodom nie ma jej pod przewidywanym
  adresem i zwraca 404. Lepiej mieć jedenaście działających pozycji niż
  dwanaście, z których jedna po cichu nie robi nic.

  ## Czego ten przelot NIE przyniesie

  Współrzędnych. Otomoto podaje w wynikach cenę i parametry, Otodom podaje
  cenę i miasto, ale `coordinates` ma wyłącznie na stronie pojedynczej oferty
  (sprawdzone: 0 z 31 wpisów na liście je niesie). Zebrane tu ogłoszenia będą
  więc dopasowywane do firm przez słownik miast, a dokładne współrzędne dostaną
  dopiero wtedy, gdy ktoś otworzy konkretną ofertę. Pobieranie strony każdej
  oferty osobno kosztowałoby trzydzieści żądań zamiast jednego i nie jest tego
  warte.
*/

CREATE TABLE IF NOT EXISTS otodom_sweep_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fragment adresu: /pl/wyniki/sprzedaz/mieszkanie/<path>
  path text NOT NULL,
  page integer NOT NULL DEFAULT 1 CHECK (page >= 1),
  last_swept_at timestamptz,
  last_result text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (path, page)
);

CREATE INDEX IF NOT EXISTS otodom_sweep_targets_queue_idx
  ON otodom_sweep_targets (last_swept_at NULLS FIRST);

-- Obsługiwana wyłącznie przez funkcję brzegową na kluczu service_role, który
-- omija RLS. Brak polityk jest celowy: dla przeglądarki tabela nie istnieje.
ALTER TABLE otodom_sweep_targets ENABLE ROW LEVEL SECURITY;

INSERT INTO otodom_sweep_targets (path, page)
SELECT path, page
FROM (
  VALUES
    ('mazowieckie/warszawa/warszawa/warszawa'),
    ('malopolskie/krakow/krakow/krakow'),
    ('dolnoslaskie/wroclaw/wroclaw/wroclaw'),
    ('wielkopolskie/poznan/poznan/poznan'),
    ('pomorskie/gdansk/gdansk/gdansk'),
    ('pomorskie/gdynia/gdynia/gdynia'),
    ('lodzkie/lodz/lodz/lodz'),
    ('slaskie/katowice/katowice/katowice'),
    ('zachodniopomorskie/szczecin/szczecin/szczecin'),
    ('lubelskie/lublin/lublin/lublin'),
    ('podlaskie/bialystok/bialystok/bialystok')
) AS m(path)
CROSS JOIN generate_series(1, 2) AS page
ON CONFLICT (path, page) DO NOTHING;

/*
  Dwa przebiegi na dobę, o 9:40 i 21:40. Godziny omijają :07 (sweep pojedynczych
  ogłoszeń) i 3:20/15:20 (przelot po modelach), żeby trzy zadania nie schodziły
  się na jednym połączeniu do bazy — po ostrzeżeniu o Disk IO nie ma powodu
  robić sobie sztucznych szczytów.

  timeout_milliseconds jest obowiązkowy: bez niego pg_net zrywa połączenie po
  pięciu sekundach, cron melduje sukces i przebieg ginie po dwóch pozycjach.
*/
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'otodom-sweep';

SELECT cron.schedule(
  'otodom-sweep',
  '40 9,21 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/sweep-otodom-listings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE((
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'daily_scraper_invoke_key'
        LIMIT 1
      ), '')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  $$
);
