/*
  # Fix admin review update policy

  ## Problem
  The current UPDATE policy on `reviews` only allows users to update their own reviews
  (where user_id = auth.uid()). This prevents admins from approving/rejecting reviews
  since the review belongs to a different user.

  ## Changes
  - Drop the existing restrictive UPDATE policy
  - Create a new UPDATE policy that allows:
    1. Users to update their own reviews (existing behavior)
    2. Admins (via is_admin() function) to update any review (needed for approval)
*/

DROP POLICY IF EXISTS "reviews_update_policy" ON reviews;

CREATE POLICY "reviews_update_policy"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid()) OR is_admin()
  )
  WITH CHECK (
    (user_id = auth.uid()) OR is_admin()
  );
