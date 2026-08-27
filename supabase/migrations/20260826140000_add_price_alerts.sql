/*
  # Price-drop alerts on saved listings

  A visitor pastes a link, reads the answer and leaves. Nothing brings them back,
  and nothing captures a way to reach them. A price-drop alert turns a one-shot
  lookup into a reason to return, and the resulting list is people who are in the
  middle of buying a car right now.

  1. Changes
    - `favorites.notify_on_price_drop` (boolean, default false) — opt-in.
      Saving a listing and asking to be emailed about it are different
      intentions, so the flag defaults off and the interface asks separately.
    - `favorites.last_notified_price` (numeric) — the price this user was last
      told about. An alert fires only below it, and it moves down after each
      send, so one slow slide in price produces one message per step rather
      than a message every night.

  2. Security
    - No new tables, so the existing per-user policies on `favorites` continue
      to apply unchanged: a user reads and writes only their own rows.
    - The alert job runs with the service role, which bypasses RLS by design.

  3. Notes
    - Nothing here stores an email address. The address lives in auth.users and
      is looked up at send time, so deleting an account removes it from alerts
      through the existing ON DELETE CASCADE.
*/

ALTER TABLE favorites
  ADD COLUMN IF NOT EXISTS notify_on_price_drop boolean NOT NULL DEFAULT false;

ALTER TABLE favorites
  ADD COLUMN IF NOT EXISTS last_notified_price numeric;

-- Only the opted-in rows are ever scanned by the alert job.
CREATE INDEX IF NOT EXISTS idx_favorites_price_alerts
  ON favorites (listing_id)
  WHERE notify_on_price_drop = true;
