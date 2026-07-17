-- supabase/functions/scrape-listing/index.ts's generateAiOpinion depends on
-- the columns added by this migration existing in the target database.
--
-- Full listing description and structured specs, used as AI-opinion input.
-- Not currently captured anywhere (listing_snapshots.description is always '').
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}';

-- AI-generated first opinion. Populated once at scrape time for new
-- listings only; null for every listing scraped before this migration,
-- and for any listing where AI generation failed.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_rating smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_summary text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_price_note text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_watch_out text[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_model text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_generated_at timestamptz;

ALTER TABLE listings DROP CONSTRAINT IF EXISTS ai_opinion_rating_range;
ALTER TABLE listings ADD CONSTRAINT ai_opinion_rating_range
  CHECK (ai_opinion_rating IS NULL OR (ai_opinion_rating >= 1 AND ai_opinion_rating <= 5));
