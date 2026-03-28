/*
  # Utworzenie Storage dla zdjęć użytkowników i tabeli user_photos

  1. Storage Bucket
    - Nazwa: `listing-photos`
    - Publiczny dostęp do odczytu
    - Upload tylko dla zalogowanych użytkowników
    - Limity: max 5MB na plik, tylko obrazy (jpg, jpeg, png, webp)

  2. Nowa tabela user_photos
    - `id` (uuid, klucz główny)
    - `listing_id` (uuid, referencja do listings)
    - `user_id` (uuid, referencja do auth.users)
    - `storage_path` (text, ścieżka w storage)
    - `file_size` (bigint, rozmiar w bajtach)
    - `created_at` (timestamptz)
    
  3. Bezpieczeństwo
    - RLS włączone
    - Użytkownicy mogą uploadować max 10 zdjęć na listing
    - Użytkownicy mogą usuwać tylko swoje zdjęcia
    - Wszyscy mogą czytać zdjęcia

  4. Trigger
    - Automatyczne czyszczenie plików ze storage przy usunięciu rekordu
*/

-- Utworzenie bucketu storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Polityki storage - upload
CREATE POLICY "Zalogowani mogą uploadować zdjęcia"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'listing-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Polityki storage - odczyt (wszyscy)
CREATE POLICY "Wszyscy mogą czytać zdjęcia"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'listing-photos');

-- Polityki storage - usuwanie
CREATE POLICY "Użytkownicy mogą usuwać swoje zdjęcia"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'listing-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Tabela user_photos
CREATE TABLE IF NOT EXISTS user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  storage_path text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Wszyscy mogą czytać zdjęcia użytkowników"
  ON user_photos FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Użytkownicy mogą dodawać zdjęcia"
  ON user_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    (
      SELECT COUNT(*) FROM user_photos
      WHERE user_id = auth.uid() AND listing_id = user_photos.listing_id
    ) < 10
  );

CREATE POLICY "Użytkownicy mogą usuwać swoje zdjęcia"
  ON user_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_user_photos_listing_id ON user_photos(listing_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_user_id ON user_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_photos_created_at ON user_photos(created_at DESC);

-- Funkcja do czyszczenia storage przy usunięciu zdjęcia
CREATE OR REPLACE FUNCTION delete_storage_object()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'listing-photos' AND name = OLD.storage_path;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_user_photo_deleted ON user_photos;
CREATE TRIGGER on_user_photo_deleted
  AFTER DELETE ON user_photos
  FOR EACH ROW
  EXECUTE FUNCTION delete_storage_object();
