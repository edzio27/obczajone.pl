/*
  # Schemat bazy danych dla aplikacji obczajone.pl
  
  1. Nowe tabele
    - `listings`
      - `id` (uuid, klucz główny)
      - `listing_id` (text, unikalny ID z Otomoto/Otodom)
      - `source` (text, 'otomoto' lub 'otodom')
      - `url` (text, oryginalny URL)
      - `title` (text)
      - `location` (text)
      - `current_price` (numeric)
      - `is_active` (boolean, czy ogłoszenie jest aktywne)
      - `first_seen_at` (timestamptz)
      - `last_checked_at` (timestamptz)
      - `created_by` (uuid, referencja do auth.users)
      - `created_at` (timestamptz)
      
    - `listing_snapshots`
      - `id` (uuid, klucz główny)
      - `listing_id` (uuid, referencja do listings)
      - `price` (numeric)
      - `title` (text)
      - `description` (text)
      - `photo_urls` (jsonb, tablica URL-i zdjęć)
      - `metadata` (jsonb, dodatkowe dane jak przebieg, wyposażenie)
      - `scraped_at` (timestamptz)
      
    - `reviews`
      - `id` (uuid, klucz główny)
      - `listing_id` (uuid, referencja do listings)
      - `user_id` (uuid, referencja do auth.users)
      - `visited_in_person` (boolean)
      - `rating` (integer, 1-5)
      - `price_difference` (text)
      - `condition_difference` (text)
      - `size_mileage_difference` (text)
      - `equipment_difference` (text)
      - `photos_difference` (text)
      - `comment` (text)
      - `is_approved` (boolean, domyślnie false)
      - `is_reported` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      
    - `review_photos`
      - `id` (uuid, klucz główny)
      - `review_id` (uuid, referencja do reviews)
      - `photo_url` (text)
      - `uploaded_at` (timestamptz)
      
    - `reports`
      - `id` (uuid, klucz główny)
      - `review_id` (uuid, referencja do reviews)
      - `reported_by` (uuid, referencja do auth.users)
      - `reason` (text)
      - `created_at` (timestamptz)
      
  2. Bezpieczeństwo
    - Włączona RLS dla wszystkich tabel
    - Polityki dostępu dla użytkowników uwierzytelnionych
    - Restrykcyjne polityki dla operacji zapisu
*/

-- Tabela listings
CREATE TABLE IF NOT EXISTS listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id text UNIQUE NOT NULL,
  source text NOT NULL CHECK (source IN ('otomoto', 'otodom')),
  url text NOT NULL,
  title text DEFAULT '',
  location text DEFAULT '',
  current_price numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  first_seen_at timestamptz DEFAULT now(),
  last_checked_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wszyscy mogą czytać aktywne ogłoszenia"
  ON listings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Uwierzytelnieni użytkownicy mogą dodawać ogłoszenia"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Tabela listing_snapshots
CREATE TABLE IF NOT EXISTS listing_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  price numeric DEFAULT 0,
  title text DEFAULT '',
  description text DEFAULT '',
  photo_urls jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  scraped_at timestamptz DEFAULT now()
);

ALTER TABLE listing_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wszyscy mogą czytać snapshoty"
  ON listing_snapshots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System może dodawać snapshoty"
  ON listing_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tabela reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  visited_in_person boolean DEFAULT false,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  price_difference text DEFAULT '',
  condition_difference text DEFAULT '',
  size_mileage_difference text DEFAULT '',
  equipment_difference text DEFAULT '',
  photos_difference text DEFAULT '',
  comment text DEFAULT '',
  is_approved boolean DEFAULT false,
  is_reported boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wszyscy mogą czytać zatwierdzone recenzje"
  ON reviews FOR SELECT
  TO authenticated
  USING (is_approved = true OR auth.uid() = user_id);

CREATE POLICY "Użytkownicy mogą dodawać recenzje"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Użytkownicy mogą edytować swoje recenzje"
  ON reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tabela review_photos
CREATE TABLE IF NOT EXISTS review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE review_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wszyscy mogą czytać zdjęcia recenzji"
  ON review_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND (reviews.is_approved = true OR reviews.user_id = auth.uid())
    )
  );

CREATE POLICY "Użytkownicy mogą dodawać zdjęcia do swoich recenzji"
  ON review_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_id
      AND reviews.user_id = auth.uid()
    )
  );

-- Tabela reports
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid REFERENCES reviews(id) ON DELETE CASCADE,
  reported_by uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Użytkownicy mogą zgłaszać recenzje"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_listings_listing_id ON listings(listing_id);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_created_by ON listings(created_by);
CREATE INDEX IF NOT EXISTS idx_listing_snapshots_listing_id ON listing_snapshots(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_snapshots_scraped_at ON listing_snapshots(scraped_at);
CREATE INDEX IF NOT EXISTS idx_reviews_listing_id ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_is_approved ON reviews(is_approved);
CREATE INDEX IF NOT EXISTS idx_review_photos_review_id ON review_photos(review_id);
CREATE INDEX IF NOT EXISTS idx_reports_review_id ON reports(review_id);