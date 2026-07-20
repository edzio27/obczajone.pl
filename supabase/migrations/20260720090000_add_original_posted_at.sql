/*
  # Track the listing's true original publish date

  1. Changes
    - `listings.original_posted_at` (timestamptz, nullable) — the date the
      ad was first published on Otomoto/Otodom, as opposed to
      `first_seen_at` (when obczajone.pl first scraped it) or the source
      site's own `createdAt`, which Otomoto resets whenever the seller
      bumps/renews the ad. Populated going forward by scrape-listing;
      existing rows stay NULL until they're re-scraped.
*/

ALTER TABLE listings ADD COLUMN IF NOT EXISTS original_posted_at timestamptz;
