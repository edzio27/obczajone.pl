/*
  # Track visits sent to us BY a partner

  `partner_clicks` already records traffic going the other way - a visitor
  clicking through from our page to a partner. There was no way to measure what
  a partner sends back, which is the number that decides whether a barter
  arrangement is worth renewing.

  1. Changes
    - `partners.referral_slug` (text, unique) — short code a partner puts on a
      QR sticker or link, e.g. obczajone.pl/?ref=drivecheck. Nullable, because
      not every partner promotes us.
    - New table `partner_referrals` — one row per inbound visit.
      - `partner_id` (uuid) references partners
      - `landing_path` (text) — where the visit landed, so we can tell a QR code
        on a car apart from a link in a bio
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled.
    - Anyone (anon + authenticated) may INSERT, same as partner_clicks: the
      visit is logged from the browser before we know who the visitor is.
    - Nobody may SELECT through the anon key. These counts feed commercial
      negotiations, so they are readable only by admins, consistent with how
      partner_clicks is handled.

  3. Notes
    - No IP address or user agent is stored. A raw visit count is enough to
      settle "how many people did you send us", and storing less keeps this out
      of scope for the personal-data questions the privacy policy answers.
*/

ALTER TABLE partners ADD COLUMN IF NOT EXISTS referral_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_referral_slug
  ON partners (referral_slug)
  WHERE referral_slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  landing_path text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_referrals_partner_id
  ON partner_referrals (partner_id, created_at DESC);

ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log a referral visit" ON partner_referrals;
CREATE POLICY "Anyone can log a referral visit"
  ON partner_referrals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read referral visits" ON partner_referrals;
CREATE POLICY "Admins can read referral visits"
  ON partner_referrals FOR SELECT
  TO authenticated
  USING (is_admin());
