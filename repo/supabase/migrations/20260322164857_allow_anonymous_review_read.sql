/*
  # Allow anonymous users to read reviews

  1. Changes
    - Drop existing SELECT policy for reviews
    - Create new policy allowing public to read reviews
    - Keep INSERT/UPDATE/DELETE restricted to authenticated users
    
  2. Security
    - Read-only access for everyone (anonymous can see reviews)
    - Write operations still require authentication
*/

-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "reviews_select_policy" ON reviews;

-- Create public read policy
CREATE POLICY "everyone_can_read_reviews"
  ON reviews
  FOR SELECT
  TO public
  USING (true);
