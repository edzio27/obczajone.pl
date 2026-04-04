/*
  # Dodanie ról administratorskich
  
  1. Nowe tabele
    - `admin_users`
      - `user_id` (uuid, referencja do auth.users)
      - `role` (text, 'admin' lub 'moderator')
      - `created_at` (timestamptz)
      
  2. Bezpieczeństwo
    - Włączona RLS
    - Tylko administratorzy mogą czytać tabelę admin_users
    
  3. Funkcje
    - `is_admin()` - sprawdza czy użytkownik jest adminem
    - Polityki dla admina do zarządzania recenzjami
*/

-- Tabela admin_users
CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  role text NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Funkcja sprawdzająca czy użytkownik jest adminem
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Polityka dla adminów do czytania tabeli admin_users
CREATE POLICY "Admini mogą czytać listę adminów"
  ON admin_users FOR SELECT
  TO authenticated
  USING (is_admin());

-- Polityka dla adminów do zatwierdzania recenzji
CREATE POLICY "Admini mogą aktualizować wszystkie recenzje"
  ON reviews FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Polityka dla adminów do usuwania recenzji
CREATE POLICY "Admini mogą usuwać recenzje"
  ON reviews FOR DELETE
  TO authenticated
  USING (is_admin());

-- Polityka dla adminów do czytania wszystkich recenzji (nawet niezatwierdzonych)
CREATE POLICY "Admini mogą czytać wszystkie recenzje"
  ON reviews FOR SELECT
  TO authenticated
  USING (is_admin() OR is_approved = true OR auth.uid() = user_id);

-- Polityka dla adminów do czytania zgłoszeń
CREATE POLICY "Admini mogą czytać zgłoszenia"
  ON reports FOR SELECT
  TO authenticated
  USING (is_admin());

-- Polityka dla adminów do usuwania zgłoszeń
CREATE POLICY "Admini mogą usuwać zgłoszenia"
  ON reports FOR DELETE
  TO authenticated
  USING (is_admin());