/*
  # Kliknięcia w linki afiliacyjne

  Pierwszy kanał w tym serwisie, który ma przynieść przychód, a nie tylko lead
  do partnera. Bez własnego licznika jedynym źródłem wiedzy o tym, czy to
  działa, byłby panel programu partnerskiego - a ten pokaże wyłącznie kliknięcia
  zakończone sprzedażą i nie powie, z której strony przyszły. Bez tego nie da
  się odpowiedzieć na jedyne pytanie, które ma tu znaczenie: czy strony modeli
  („ile spada cena Passata") sprzedają lepiej niż strony pojedynczych ogłoszeń.

  `context` rozdziela właśnie te dwa miejsca. `listing_id` wypełniamy tylko na
  stronie ogłoszenia - na stronie modelu nie ma jednego auta, do którego dałoby
  się to przypiąć.

  Nie zapisujemy nic o osobie klikającej: ani adresu IP, ani identyfikatora
  sesji. Do policzenia konwersji wystarczy licznik, a tabela z INSERT-em
  otwartym dla anonimowych nie jest miejscem na dane osobowe.
*/

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Nazwa programu, np. 'autodna'. Trzymamy ją, bo program można zmienić,
  -- a wtedy porównanie „przed i po" musi być możliwe.
  provider text NOT NULL,
  context text NOT NULL CHECK (context IN ('listing', 'model_page')),
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliate_clicks_created_idx
  ON affiliate_clicks (created_at DESC);

ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;

/*
  Zapisywać może każdy, czytać nikt spoza service_role. Tak samo jak przy
  partner_clicks: licznik ma działać dla niezalogowanego odwiedzającego, ale
  statystyka przychodowa nie jest publiczna.
*/
DROP POLICY IF EXISTS "Anyone can log an affiliate click" ON affiliate_clicks;
CREATE POLICY "Anyone can log an affiliate click"
  ON affiliate_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
