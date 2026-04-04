/*
  # Fix Anonymous Listing Creation Policy

  1. Changes
    - Drop overly permissive policy
    - Create proper policy that allows INSERT for both anonymous and authenticated users
    - Ensure created_by can be null for anonymous users

  2. Security
    - Anonymous users can create listings with created_by = null
    - Authenticated users can create listings with created_by = their user id
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Anyone can create listings" ON listings;

-- Create policy that validates created_by matches auth.uid() for authenticated users
-- or allows null for anonymous users
CREATE POLICY "Anyone can create listings"
  ON listings FOR INSERT
  WITH CHECK (
    (auth.uid() IS NULL AND created_by IS NULL) OR 
    (auth.uid() IS NOT NULL AND created_by = auth.uid())
  );
