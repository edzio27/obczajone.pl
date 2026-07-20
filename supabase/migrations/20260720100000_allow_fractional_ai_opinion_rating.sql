/*
  # Allow fractional AI opinion ratings

  1. Changes
    - `listings.ai_opinion_rating` changed from `smallint` to `numeric(2,1)`
      so values like 3.6 or 4.2 can be stored instead of only whole
      numbers. The scrape-listing function was previously rounding every
      AI-generated rating to the nearest integer, which made almost every
      listing land on 3.0 or 4.0 with nothing in between.
    - The existing 1-5 range check is recreated to keep working on the new
      column type.
*/

ALTER TABLE listings ALTER COLUMN ai_opinion_rating TYPE numeric(2,1);

ALTER TABLE listings DROP CONSTRAINT IF EXISTS ai_opinion_rating_range;
ALTER TABLE listings ADD CONSTRAINT ai_opinion_rating_range
  CHECK (ai_opinion_rating IS NULL OR (ai_opinion_rating >= 1 AND ai_opinion_rating <= 5));
