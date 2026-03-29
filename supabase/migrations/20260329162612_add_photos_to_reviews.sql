/*
  # Link photos to reviews

  1. Changes
    - Add review_id column to user_listing_photos table
    - Make review_id nullable to support both review photos and standalone photos
    - Update RLS policies to allow users to manage photos attached to their reviews
    - Add cascade delete when review is deleted

  2. Security
    - Users can add photos to their own reviews
    - Users can view all photos
    - Users can delete only their own photos
*/

-- Add review_id column to user_listing_photos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_listing_photos' AND column_name = 'review_id'
  ) THEN
    ALTER TABLE user_listing_photos ADD COLUMN review_id uuid REFERENCES reviews(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_listing_photos_review_id ON user_listing_photos(review_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view all photos" ON user_listing_photos;
DROP POLICY IF EXISTS "Users can upload photos" ON user_listing_photos;
DROP POLICY IF EXISTS "Users can delete own photos" ON user_listing_photos;

CREATE POLICY "Anyone can view all photos"
  ON user_listing_photos FOR SELECT
  USING (true);

CREATE POLICY "Users can upload photos"
  ON user_listing_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos"
  ON user_listing_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);