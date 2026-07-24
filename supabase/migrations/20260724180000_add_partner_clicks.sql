/*
  # Track partner referral clicks

  1. New table
    - `partner_clicks`
      - `id` (uuid, primary key)
      - `partner_id` (uuid, references partners)
      - `context` ('listing_cta' | 'homepage' | 'partners_page') — where
        the click happened, so we can see which placement actually drives
        referrals
      - `listing_id` (uuid, nullable) — which listing the click came from,
        when context is 'listing_cta'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anyone (anon + authenticated) can INSERT a click event — this is a
      fire-and-forget analytics beacon, not user data
    - No SELECT policy for anon/authenticated: click counts are only
      queried directly (SQL) by the site owner, not exposed via the
      public API
*/

CREATE TABLE IF NOT EXISTS partner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  context text NOT NULL CHECK (context IN ('listing_cta', 'homepage', 'partners_page')),
  listing_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_clicks_partner_id ON partner_clicks (partner_id);

ALTER TABLE partner_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log a partner click" ON partner_clicks;
CREATE POLICY "Anyone can log a partner click"
  ON partner_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
