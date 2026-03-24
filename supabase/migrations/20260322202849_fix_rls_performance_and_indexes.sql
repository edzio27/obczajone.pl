/*
  # Fix RLS Performance and Remove Unused Indexes

  1. Performance Improvements
    - Optimize all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth functions for each row
    - Significantly improves query performance at scale

  2. Index Cleanup
    - Remove unused indexes to improve write performance
    - Reduces storage overhead
    - Indexes removed:
      - `idx_listings_source`
      - `idx_listings_created_by`
      - `idx_listing_snapshots_scraped_at`
      - `idx_reviews_is_approved`
      - `idx_review_photos_review_id`
      - `idx_reports_review_id`
      - `idx_reports_reported_by`

  3. Tables Updated
    - `listings` - optimized insert policy
    - `reviews` - optimized insert, update, and select policies
    - `review_photos` - optimized select and insert policies
    - `reports` - optimized insert policy
    - `rate_limits` - optimized select and insert policies
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_listings_source;
DROP INDEX IF EXISTS idx_listings_created_by;
DROP INDEX IF EXISTS idx_listing_snapshots_scraped_at;
DROP INDEX IF EXISTS idx_reviews_is_approved;
DROP INDEX IF EXISTS idx_review_photos_review_id;
DROP INDEX IF EXISTS idx_reports_review_id;
DROP INDEX IF EXISTS idx_reports_reported_by;

-- Optimize listings policies
DROP POLICY IF EXISTS unified_listings_insert ON listings;
CREATE POLICY "unified_listings_insert"
  ON listings
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    created_by IS NULL 
    OR created_by = (select auth.uid())
  );

-- Optimize reviews policies
DROP POLICY IF EXISTS reviews_insert_policy ON reviews;
CREATE POLICY "reviews_insert_policy"
  ON reviews
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    user_id IS NULL 
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS reviews_update_policy ON reviews;
CREATE POLICY "reviews_update_policy"
  ON reviews
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS proper_review_visibility ON reviews;
CREATE POLICY "proper_review_visibility"
  ON reviews
  FOR SELECT
  TO authenticated, anon
  USING (
    is_approved = true 
    OR user_id = (select auth.uid()) 
    OR EXISTS (
      SELECT 1 FROM admin_users 
      WHERE admin_users.user_id = (select auth.uid()) 
      AND admin_users.role = 'admin'
    )
  );

-- Optimize review_photos policies
DROP POLICY IF EXISTS review_photos_select_policy ON review_photos;
CREATE POLICY "review_photos_select_policy"
  ON review_photos
  FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_photos.review_id 
      AND (
        reviews.is_approved = true 
        OR reviews.user_id = (select auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS review_photos_insert_policy ON review_photos;
CREATE POLICY "review_photos_insert_policy"
  ON review_photos
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews 
      WHERE reviews.id = review_photos.review_id 
      AND (
        reviews.user_id IS NULL 
        OR reviews.user_id = (select auth.uid())
      )
    )
  );

-- Optimize reports policies
DROP POLICY IF EXISTS reports_insert_policy ON reports;
CREATE POLICY "reports_insert_policy"
  ON reports
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    reported_by IS NULL 
    OR reported_by = (select auth.uid())
  );

-- Optimize rate_limits policies
DROP POLICY IF EXISTS rate_limits_select_policy ON rate_limits;
CREATE POLICY "rate_limits_select_policy"
  ON rate_limits
  FOR SELECT
  TO authenticated, anon
  USING (
    user_id IS NULL 
    OR user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS rate_limits_insert_policy ON rate_limits;
CREATE POLICY "rate_limits_insert_policy"
  ON rate_limits
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    user_id IS NULL 
    OR user_id = (select auth.uid())
  );
