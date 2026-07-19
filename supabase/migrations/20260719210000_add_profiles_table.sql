/*
  # Add user profiles for review attribution

  1. New table
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `display_name` (text) — shown next to reviews; defaults to the
        local part of the user's email at signup
      - `is_partner` (boolean) — true for known partner/business accounts
      - `partner_logo_url` (text, nullable) — shown instead of display_name
        when is_partner is true
      - `created_at` (timestamptz)

  2. Trigger
    - `on_auth_user_created` inserts a profiles row automatically whenever a
      new auth.users row is created, deriving display_name from the email.

  3. Security
    - Enable RLS on `profiles`
    - Anyone (anon + authenticated) can read profiles
    - No INSERT/UPDATE/DELETE policy for anon/authenticated — only the
      trigger's SECURITY DEFINER function writes rows, matching the
      "system writes, everyone reads" pattern already used for sellers.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  is_partner boolean NOT NULL DEFAULT false,
  partner_logo_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read profiles" ON profiles;
CREATE POLICY "Everyone can read profiles"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users that already existed before this migration.
INSERT INTO profiles (id, display_name)
SELECT id, split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;
