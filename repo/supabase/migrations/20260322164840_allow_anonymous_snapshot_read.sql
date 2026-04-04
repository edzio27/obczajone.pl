/*
  # Allow anonymous users to read listing snapshots

  1. Changes
    - Drop existing SELECT policy for listing_snapshots
    - Create new policy allowing public (both authenticated and anonymous) to read snapshots
    
  2. Security
    - Read-only access for everyone
    - No changes to INSERT policies
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Wszyscy mogą czytać snapshoty" ON listing_snapshots;

-- Create public read policy
CREATE POLICY "everyone_can_read_snapshots"
  ON listing_snapshots
  FOR SELECT
  TO public
  USING (true);
