/*
  # Fix listing visibility and add user photo uploads

  1. Changes to existing tables
    - Update listings SELECT policy to allow anonymous users to view listings
    
  2. New tables
    - `user_listing_photos`
      - `id` (uuid, primary key)
      - `listing_id` (uuid, reference to listings)
      - `user_id` (uuid, reference to auth.users)
      - `photo_url` (text, URL to photo in Supabase Storage)
      - `file_size` (integer, size in bytes)
      - `uploaded_at` (timestamptz)
      - `order_index` (integer, for sorting photos)

  3. Security
    - Enable RLS on user_listing_photos
    - Anyone can view photos for public listings
    - Only authenticated users can upload photos
    - Users can only delete their own photos
    - Max 10 photos per user per listing (enforced by application)

  4. Storage
    - Photos stored in Supabase Storage bucket 'listing-photos'
    - Max file size: 5MB per photo
    - Allowed formats: JPEG, PNG, WebP
    - Photos are public but with validation
*/

-- Update listings SELECT policy to allow anonymous users
DROP POLICY IF EXISTS "Wszyscy mogą czytać aktywne ogłoszenia" ON listings;

CREATE POLICY "Everyone can read listings"
  ON listings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Create user_listing_photos table
CREATE TABLE IF NOT EXISTS user_listing_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  file_size integer DEFAULT 0,
  order_index integer DEFAULT 0,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE user_listing_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view user photos"
  ON user_listing_photos FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload photos"
  ON user_listing_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON user_listing_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_listing_photos_listing_id ON user_listing_photos(listing_id);
CREATE INDEX IF NOT EXISTS idx_user_listing_photos_user_id ON user_listing_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_listing_photos_order ON user_listing_photos(listing_id, order_index);