/*
  # Fix anonymous listing creation policy

  1. Changes
    - Drop conflicting INSERT policies
    - Create single unified INSERT policy that works for both authenticated and anonymous users
    - Allow anonymous users to insert with created_by = NULL
    - Allow authenticated users to insert with created_by = auth.uid()
    
  2. Security
    - Anonymous users can only create listings with NULL created_by
    - Authenticated users can only create listings assigned to themselves
*/

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "listings_insert_policy" ON listings;
DROP POLICY IF EXISTS "Anyone can create listings" ON listings;

-- Create unified INSERT policy that works for everyone
CREATE POLICY "unified_listings_insert" 
  ON listings 
  FOR INSERT 
  TO public
  WITH CHECK (
    (auth.uid() IS NULL AND created_by IS NULL) OR 
    (auth.uid() IS NOT NULL AND created_by = auth.uid())
  );

-- Also ensure anonymous users can read listings
DROP POLICY IF EXISTS "Wszyscy mogą czytać aktywne ogłoszenia" ON listings;

CREATE POLICY "everyone_can_read_listings"
  ON listings
  FOR SELECT
  TO public
  USING (true);
