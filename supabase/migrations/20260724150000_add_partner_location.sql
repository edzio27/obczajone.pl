/*
  # Add location fields to partners for a dedicated partners map page

  1. Changes
    - `partners.lat`, `partners.lng` (double precision, nullable) — map
      placement, same pattern as `sellers`.
    - `partners.voivodeship` (text, nullable) — lets the new /partnerzy
      page filter partners by region without geocoding on every request.

  2. Data
    - Backfills the existing DriveCheck Performance row (Wrocław,
      dolnośląskie) with real coordinates.
*/

ALTER TABLE partners ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS voivodeship text;

UPDATE partners
SET lat = 51.1079, lng = 17.0385, voivodeship = 'dolnośląskie'
WHERE name = 'DriveCheck Performance' AND lat IS NULL;
