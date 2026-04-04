/*
  # System rate limiting
  
  1. Nowe tabele
    - `rate_limits`
      - `id` (uuid, klucz główny)
      - `user_id` (uuid, referencja do auth.users)
      - `action_type` (text, np. 'add_listing', 'add_review')
      - `created_at` (timestamptz)
      
  2. Funkcje pomocnicze
    - Funkcja sprawdzająca limity
    
  3. Bezpieczeństwo
    - RLS włączone
    - Użytkownicy mogą sprawdzać swoje limity
*/

-- Tabela rate_limits
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Użytkownicy mogą czytać swoje rate limity"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System może dodawać rate limity"
  ON rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Funkcja sprawdzająca rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_action_type text,
  p_max_actions integer,
  p_time_window_minutes integer
) RETURNS boolean AS $$
DECLARE
  action_count integer;
BEGIN
  SELECT COUNT(*) INTO action_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at > NOW() - (p_time_window_minutes || ' minutes')::interval;
  
  RETURN action_count < p_max_actions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funkcja do czyszczenia starych wpisów rate limit (można wywołać cron jobem)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits() RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits
  WHERE created_at < NOW() - interval '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indeksy dla wydajności
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action ON rate_limits(user_id, action_type, created_at);