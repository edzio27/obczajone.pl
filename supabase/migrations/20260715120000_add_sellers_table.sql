/*
  # Add seller/branch profiles

  1. New tables
    - `sellers`
      - `id` (uuid, primary key)
      - `source` (text, 'otomoto' or 'otodom')
      - `external_seller_id` (text, nullable — dealer account id from the source site, e.g. Otomoto's ad.seller.id)
      - `name` (text)
      - `phone` (text, nullable — display only, not used for matching)
      - `city` (text)
      - `address` (text, nullable)
      - `lat` (double precision, nullable)
      - `lng` (double precision, nullable)
      - `created_at` (timestamptz)

  2. Changes to existing tables
    - `listings.seller_id` (uuid, nullable, references sellers) — set by the scraper when
      the listing belongs to a dealer with a matched/created seller row

  3. Security
    - Enable RLS on `sellers`
    - Anyone (anon + authenticated) can read sellers
    - No INSERT/UPDATE/DELETE policy for anon/authenticated — only the edge function's
      service-role client (which bypasses RLS) writes sellers, matching the
      "system writes, everyone reads" pattern already used for listing_snapshots
*/

CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('otomoto', 'otodom')),
  external_seller_id text,
  name text NOT NULL,
  phone text,
  city text NOT NULL DEFAULT '',
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read sellers"
  ON sellers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Speeds up the matching lookups the scraper runs on every scrape
CREATE INDEX IF NOT EXISTS idx_sellers_external_id_city ON sellers (external_seller_id, city);
CREATE INDEX IF NOT EXISTS idx_sellers_name_city ON sellers (name, city);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES sellers(id);
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings (seller_id);
