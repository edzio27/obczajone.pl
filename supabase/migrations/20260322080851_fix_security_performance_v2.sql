/*
  # Naprawa problemów bezpieczeństwa i wydajności - v2
  
  1. Dodanie brakujących indeksów
  2. Optymalizacja polityk RLS
  3. Naprawa funkcji z prawidłowym search_path
  4. Usunięcie duplikujących się polityk
*/

-- 1. Dodaj brakujący indeks dla foreign key
CREATE INDEX IF NOT EXISTS idx_reports_reported_by ON reports(reported_by);

-- 2. Napraw funkcje najpierw (bo są używane w politykach)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_action_type text,
  p_max_actions integer,
  p_time_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  action_count integer;
BEGIN
  SELECT COUNT(*) INTO action_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at > NOW() - (p_time_window_minutes || ' minutes')::interval;
  
  RETURN action_count < p_max_actions;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.rate_limits
  WHERE created_at < NOW() - interval '24 hours';
END;
$$;

-- 3. Usuń wszystkie polityki dla reviews (żeby usunąć duplikaty)
DROP POLICY IF EXISTS "Wszyscy mogą czytać zatwierdzone recenzje" ON reviews;
DROP POLICY IF EXISTS "Użytkownicy mogą dodawać recenzje" ON reviews;
DROP POLICY IF EXISTS "Użytkownicy mogą edytować swoje recenzje" ON reviews;
DROP POLICY IF EXISTS "Admini mogą aktualizować wszystkie recenzje" ON reviews;
DROP POLICY IF EXISTS "Admini mogą usuwać recenzje" ON reviews;
DROP POLICY IF EXISTS "Admini mogą czytać wszystkie recenzje" ON reviews;

-- Utwórz pojedyncze, zoptymalizowane polityki dla reviews
CREATE POLICY "reviews_select_policy"
  ON reviews FOR SELECT
  TO authenticated
  USING (
    is_approved = true 
    OR user_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "reviews_insert_policy"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update_policy"
  ON reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "reviews_delete_policy"
  ON reviews FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 4. Popraw polityki dla listings
DROP POLICY IF EXISTS "Uwierzytelnieni użytkownicy mogą dodawać ogłoszenia" ON listings;
CREATE POLICY "listings_insert_policy"
  ON listings FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 5. Popraw polityki dla review_photos
DROP POLICY IF EXISTS "Wszyscy mogą czytać zdjęcia recenzji" ON review_photos;
DROP POLICY IF EXISTS "Użytkownicy mogą dodawać zdjęcia do swoich recenzji" ON review_photos;

CREATE POLICY "review_photos_select_policy"
  ON review_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_photos.review_id
      AND (reviews.is_approved = true OR reviews.user_id = auth.uid())
    )
  );

CREATE POLICY "review_photos_insert_policy"
  ON review_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews
      WHERE reviews.id = review_photos.review_id
      AND reviews.user_id = auth.uid()
    )
  );

-- 6. Popraw polityki dla reports
DROP POLICY IF EXISTS "Użytkownicy mogą zgłaszać recenzje" ON reports;
DROP POLICY IF EXISTS "Admini mogą czytać zgłoszenia" ON reports;
DROP POLICY IF EXISTS "Admini mogą usuwać zgłoszenia" ON reports;

CREATE POLICY "reports_insert_policy"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (reported_by = auth.uid());

CREATE POLICY "reports_select_policy"
  ON reports FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "reports_delete_policy"
  ON reports FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 7. Popraw polityki dla rate_limits
DROP POLICY IF EXISTS "Użytkownicy mogą czytać swoje rate limity" ON rate_limits;
DROP POLICY IF EXISTS "System może dodawać rate limity" ON rate_limits;

CREATE POLICY "rate_limits_select_policy"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "rate_limits_insert_policy"
  ON rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 8. Naprawa polityki dla listing_snapshots - bardziej restrykcyjna
DROP POLICY IF EXISTS "System może dodawać snapshoty" ON listing_snapshots;

CREATE POLICY "listing_snapshots_insert_policy"
  ON listing_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_snapshots.listing_id
    )
  );