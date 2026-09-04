/*
  # Kolejka przelotu po modelach i jego harmonogram

  ## Dlaczego kolejka w bazie, a nie lista w kodzie

  Pierwsza wersja funkcji miała modele wpisane na stałe i szła po nich od
  początku. Jeden przebieg mieści około 23 pozycji w budżecie 110 sekund, więc
  przy 45 pozycjach cron odświeżałby w kółko pierwsze dwadzieścia parę, a do
  ostatnich nie dotarłby nigdy - i nic by o tym nie powiedział, bo każdy przebieg
  kończyłby się sukcesem.

  Ten sam błąd już raz tu wystąpił: sweep cen sortował kolejkę po polu, które
  przesuwał tylko przy zmianie ceny, więc co godzinę brał te same rekordy
  (patrz 20260829200000 i komentarz przy last_checked_at w daily-price-scraper).
  Lekcja jest ta sama, więc rozwiązanie też: kolejność bierze się ze znacznika
  "kiedy próbowaliśmy", a nie "czy coś z tego wyszło", i przesuwa się przy każdej
  próbie, także nieudanej.

  ## Zakres próby

  15 modeli po 3 strony wyników. Strona to 32 oferty, a kolejne strony prawie
  się nie pokrywają (sprawdzone: 93 unikalne oferty z 96 na trzech stronach,
  powtórki to ogłoszenia promowane), czyli około 1400 obserwowanych ofert.
*/

CREATE TABLE IF NOT EXISTS model_sweep_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Fragment adresu: https://www.otomoto.pl/osobowe/<path>
  path text NOT NULL,
  page integer NOT NULL DEFAULT 1 CHECK (page >= 1),
  -- NULL znaczy "jeszcze nie ruszane" i dlatego idzie w kolejce pierwsze.
  last_swept_at timestamptz,
  -- Ile ofert zwrócił ostatni przebieg albo dlaczego nie zwrócił żadnej.
  last_result text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (path, page)
);

CREATE INDEX IF NOT EXISTS model_sweep_targets_queue_idx
  ON model_sweep_targets (last_swept_at NULLS FIRST);

/*
  Tabelą zarządza wyłącznie funkcja brzegowa działająca na kluczu service_role,
  który omija RLS. Włączamy RLS i świadomie nie dodajemy żadnej polityki: dla
  przeglądarki tabela po prostu nie istnieje, a nie ma powodu, żeby istniała.
*/
ALTER TABLE model_sweep_targets ENABLE ROW LEVEL SECURITY;

INSERT INTO model_sweep_targets (path, page)
SELECT path, page
FROM (
  VALUES
    ('bmw/seria-3'),
    ('bmw/seria-5'),
    ('audi/a4'),
    ('volkswagen/golf'),
    ('volkswagen/passat'),
    ('skoda/octavia'),
    ('skoda/superb'),
    ('toyota/corolla'),
    ('opel/astra'),
    ('ford/focus'),
    ('mercedes-benz/klasa-c'),
    ('renault/megane'),
    ('kia/ceed'),
    ('hyundai/tucson'),
    ('volvo/xc-60')
) AS m(path)
CROSS JOIN generate_series(1, 3) AS page
ON CONFLICT (path, page) DO NOTHING;

/*
  Dwa przebiegi na dobę. Jeden mieści około 23 pozycji, więc dwa obchodzą całe
  45 - czyli każda obserwowana oferta dostaje mniej więcej jeden zapis ceny
  dziennie. Częściej nie ma sensu: ceny nie zmieniają się co godzinę, a każdy
  przebieg dopisuje kilkaset wierszy do listing_snapshots.

  Godziny 3:20 i 15:20 omijają :07, o której rusza sweep pojedynczych ogłoszeń.
  timeout_milliseconds jest obowiązkowy - bez niego pg_net zrywa połączenie po
  5 sekundach, cron melduje sukces i przebieg ginie po dwóch pozycjach.
*/
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'model-sweep';

SELECT cron.schedule(
  'model-sweep',
  '20 3,15 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tumyxmvbytwizmyqnvgc.supabase.co/functions/v1/sweep-model-listings',
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
