/*
  # Fix review visibility policy

  1. Changes
    - Drop overly permissive review SELECT policy
    - Create new policy that:
      * Shows approved reviews to everyone
      * Shows pending reviews only to their authors
      * Shows all reviews to admins
    
  2. Security
    - Users can only see their own pending reviews
    - Everyone can see approved reviews
    - Admins can see everything
*/

-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "everyone_can_read_reviews" ON reviews;

-- Create proper visibility policy
CREATE POLICY "proper_review_visibility"
  ON reviews
  FOR SELECT
  TO public
  USING (
    is_approved = true 
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  );
