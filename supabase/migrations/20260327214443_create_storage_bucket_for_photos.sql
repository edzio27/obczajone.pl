/*
  # Create Storage Bucket for User Photos

  1. Storage Bucket
    - Create 'listing-photos' bucket
    - Set as public bucket
    - Max file size: 5MB
    - Allowed MIME types: image/jpeg, image/png, image/webp

  2. Security
    - Public bucket so photos are accessible via direct URLs
    - RLS policies control who can upload/delete
    - Anyone can read (for public viewing)
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Anyone can view listing photos"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'listing-photos');

CREATE POLICY "Authenticated users can upload listing photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listing-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'listing-photos' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );