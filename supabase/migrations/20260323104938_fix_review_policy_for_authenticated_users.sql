/*
  # Fix review visibility for authenticated users

  1. Changes
    - Drop current review visibility policy
    - Create corrected policy that properly checks authentication
    - Ensures authenticated users can see their own reviews regardless of approval status
    
  2. Security
    - Users can see their own reviews (approved or not)
    - Everyone can see approved reviews
    - Admins can see everything
*/

DROP POLICY IF EXISTS "proper_review_visibility" ON reviews;

CREATE POLICY "proper_review_visibility"
  ON reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    is_approved = true 
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = auth.uid() 
      AND admin_users.role = 'admin'
    ))
  );