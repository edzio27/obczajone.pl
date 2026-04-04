/*
  # Allow Anonymous Listing Creation

  1. Changes
    - Update listings INSERT policy to allow anonymous users
    - Keep rate limiting for logged users only
    - Allow anonymous users to create listings

  2. Security
    - Anonymous users can only INSERT, not UPDATE or DELETE
    - Logged users still have rate limiting protection
*/

-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create listings" ON listings;

-- Create new policy that allows both authenticated and anonymous users
CREATE POLICY "Anyone can create listings"
  ON listings FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
