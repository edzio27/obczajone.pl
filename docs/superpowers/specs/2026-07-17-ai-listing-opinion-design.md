# AI-generated listing opinion

## Context

New listings have no user reviews yet, and the existing "Ocena wiarygodności" trust score (`lib/listing-score.ts`, see [[2026-07-14-listing-trust-score]]) falls back to neutral defaults ("Brak opinii" / "Za mało danych o cenie") when there's no review or price history — which is most new listings. This spec adds a first, automatically generated "opinion" per listing: an AI review of the listing's price and description, flagged as AI-authored, alongside (not replacing) the trust score.

Confirmed with the site owner:
- Additive to the trust score card, not a replacement.
- AI input is text-only: title, price, location, description, and basic structured specs (brand/model/year/mileage for cars; area/rooms/floor/build year for real estate). No photos, no comparison against other listings in the database.
- Generated once, automatically, at scrape time — not on-demand, not batched.
- Only new listings going forward. No backfill for existing listings.
- Displayed as the first entry in the reviews list, clearly badged "Opinia AI" — not a separate card elsewhere on the page.
- Tone must be cautious: no definitive negative claims about the listing/seller — only hedged suggestions/questions ("może warto dopytać o...").
- Covers both `otomoto` (cars) and `otodom` (real estate) listings, with source-appropriate specs and prompt content.

## Scope

`supabase/functions/scrape-listing/index.ts` (scraping + generation), a new `listings` migration, and `components/review-list.tsx` (display). Does not touch `daily-price-scraper` (it only re-checks prices on existing listings, never creates new ones — confirmed the only listing-creation path is `components/listing-url-form.tsx` calling `scrape-listing`).

## Data model changes

New migration adding to `listings`:

- `description text default ''` — full listing description, HTML-stripped. Not currently captured anywhere (existing `listing_snapshots.description` is hardcoded to `''` today and stays that way — out of scope to fix here).
- `specs jsonb default '{}'` — structured fields, shape depends on `source`:
  - `otomoto`: `{ brand, model, year, mileage, fuel_type }`
  - `otodom`: `{ area, rooms, floor, build_year }`
  JSONB rather than fixed columns because the two source types have disjoint fields and neither should carry NULL columns for the other's schema.
- `ai_opinion_rating smallint` (1–5, matches the existing `reviews.rating` scale so the UI can reuse the same star component)
- `ai_opinion_summary text`
- `ai_opinion_price_note text`
- `ai_opinion_watch_out text[]` — list of hedged suggestions/questions
- `ai_opinion_model text` — e.g. `claude-haiku-4-5`, recorded per-row so a future model change is traceable per listing
- `ai_opinion_generated_at timestamptz`

All nullable with no default (besides timestamp columns using their natural default); a listing with no AI opinion simply has all of these `null`.

## Scraper changes

`scrapeOtomoto()` / `scrapeOtodom()` (`supabase/functions/scrape-listing/index.ts:82` and `:185`) are extended to also extract `description` and `specs`, in addition to the existing `title`/`price`/`location`/`photoUrl`.

Implementation note: the exact `__NEXT_DATA__` field names for car/property parameters (e.g. whether Otomoto exposes them under `ad.parameters` and Otodom under `ad.characteristics` or `ad.target`) are not yet confirmed — verify against a live fetched listing during implementation, following the same pattern already used for `title`/`price`/`seller` extraction (primary path via `__NEXT_DATA__`, regex fallback if the shape doesn't match).

After the existing `listings` update (`index.ts:441`) and snapshot insert, add a new step: call `generateAiOpinion(source, scrapedData)`.

## AI opinion generation

New function in `scrape-listing/index.ts` (or a co-located module):

1. Builds a prompt from the available fields, using a source-specific template (car vs. real estate) so the model asks about the right things (mileage/service history for cars, floor/building age for apartments).
2. Calls the Anthropic API using **Claude Haiku 4.5** — cheap and fast, appropriate since this runs once per new listing a user submits (low volume, not a batch job).
3. Requests structured output (tool-use / JSON schema) with:
   - `rating` (integer 1–5)
   - `summary` (string)
   - `price_note` (string)
   - `watch_out_for` (array of strings)
4. System prompt enforces the cautious tone requirement: the model must never assert that something is wrong with the listing or seller — only phrase concerns as questions or suggestions to verify in person.
5. Wrapped entirely in `try/catch`. Any failure (missing `ANTHROPIC_API_KEY`, timeout, API error, malformed/missing JSON fields) is logged server-side and swallowed — the `ai_opinion_*` columns are left `null` and the scrape response is unaffected. Generation failure must never fail the listing scrape.

Requires a new `ANTHROPIC_API_KEY` secret in the Supabase edge function environment, alongside the existing `SUPABASE_SERVICE_ROLE_KEY` (`index.ts:374`).

## UI / display

`components/review-list.tsx`: when the listing has a non-null `ai_opinion_rating`, render an additional card at the very top of the list — above the "Twoja opinia (czeka na moderację)" section and above "Zatwierdzone opinie (N)".

Card contents:
- A "Opinia AI" badge, visually distinct in color from the existing `visited_in_person` badge (e.g. a blue/violet badge vs. the current gray/secondary one) so it reads as categorically different from user badges at a glance.
- Star rating using the existing `Star` rendering pattern (`review-list.tsx:286-293`) fed by `ai_opinion_rating`, so it looks visually consistent with real reviews.
- `ai_opinion_summary` as the main text.
- A "Cena" section showing `ai_opinion_price_note`.
- A "Na co zwrócić uwagę" section rendering `ai_opinion_watch_out` as a bulleted list.
- A fixed disclaimer line at the bottom of the card: "Opinia wygenerowana automatycznie przez AI na podstawie opisu ogłoszenia. Może się mylić — nie zastępuje oceny na żywo."

The AI card is not counted in the "Zatwierdzone opinie (N)" heading (`review-list.tsx:279`) — that count reflects only real user reviews from the `reviews` table; the AI opinion is sourced from `listings` columns and kept structurally and visually separate.

When `ai_opinion_rating` is `null` (old listings, or generation failed), nothing renders — no change from current behavior.

## Non-goals

- No backfill of AI opinions for existing listings.
- No photos as AI input, no comparison against other listings' prices in the database.
- No on-demand/lazy generation and no batch/cron regeneration — one-shot at scrape time only.
- No changes to `daily-price-scraper` or to the `reviews` table / RLS policies.
- No versioning/regeneration workflow for stale opinions (e.g. after a price change) — `ai_opinion_model` is recorded for future traceability but nothing currently triggers a re-generation.

## Verification

No automated test framework exists in this repo (confirmed: no Jest/Vitest, no `test` script in `package.json`) — following the same precedent as the trust score feature ([[2026-07-14-listing-trust-score]]), this ships with manual verification only, not a new unit-test suite:

- Manual end-to-end test: submit a real Otomoto URL and a real Otodom URL via the add-listing form, confirm `description`/`specs`/`ai_opinion_*` are populated correctly and the AI card renders on the listing page.
- Manual check of `generateAiOpinion` error paths: temporarily unset `ANTHROPIC_API_KEY` (or point it at an invalid value) and confirm the scrape still succeeds with `ai_opinion_*` left `null`, with the error visible in the function logs.
- Manual UI check: a listing with a populated AI opinion, and one without — confirm the card appears/doesn't appear correctly and the "Zatwierdzone opinie (N)" count is unaffected either way.
- `npx tsc --noEmit` / `npx next lint` clean.
