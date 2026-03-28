/*
  # Dodanie funkcji polubionych ogłoszeń i obrazków

  1. Zmiany w tabelach
    - Dodanie `image_url` do tabeli `listings`
      - `image_url` (text, URL głównego zdjęcia z ogłoszenia)

  2. Nowe tabele
    - `favorites`
      - `id` (uuid, klucz główny)
      - `user_id` (uuid, referencja do auth.users)
      - `listing_id` (uuid, referencja do listings)
      - `created_at` (timestamptz)
      - Unikalny constraint na parę (user_id, listing_id)

  3. Bezpieczeństwo
    - Włączona RLS dla tabeli favorites
    - Użytkownicy mogą dodawać/usuwać tylko swoje ulubione
    - Użytkownicy widzą tylko swoje ulubione

  4. Indeksy
    - Indeks na user_id dla szybkiego wyszukiwania ulubionych użytkownika
    - Indeks na listing_id dla szybkiego sprawdzania popularności
*/

-- Dodanie kolumny image_url do tabeli listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE listings ADD COLUMN image_url text DEFAULT '';
  END IF;
END $$;

-- Tabela favorites
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Użytkownicy mogą czytać swoje ulubione"
  ON favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Użytkownicy mogą dodawać swoje ulubione"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Użytkownicy mogą usuwać swoje ulubione"
  ON favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);