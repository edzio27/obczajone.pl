/*
  # Add partners table for inspection-service referrals

  1. New table
    - `partners`
      - `id` (uuid, primary key)
      - `name` (text)
      - `category` (text, 'car' or 'home') — which kind of listing this
        partner is relevant for (Otomoto cars vs Otodom properties)
      - `city` (text, nullable) — for future regional matching
      - `logo_url` (text, nullable)
      - `contact_url` (text) — where the CTA button links to
      - `description` (text)
      - `is_active` (boolean) — lets a partner be paused without deleting it
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anyone (anon + authenticated) can read partners
    - No INSERT/UPDATE/DELETE policy — this table is curated manually by
      the site owner, not written by users or the scraper.

  3. Seed data
    - DriveCheck Performance (previously hardcoded in promotional-banner.tsx)
*/

CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('car', 'home')),
  city text,
  logo_url text,
  contact_url text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read partners" ON partners;
CREATE POLICY "Everyone can read partners"
  ON partners FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO partners (name, category, city, logo_url, contact_url, description)
VALUES (
  'DriveCheck Performance',
  'car',
  'Wrocław',
  '/partners/drivecheck-performance.jpg',
  'https://www.instagram.com/drivecheckperformance',
  'Ekspert techniczny – sprawdzanie auta przed zakupem'
);
