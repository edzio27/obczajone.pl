# Seller profiles and branch map

## Context

Follow-up to an earlier ChatGPT design session (screenshots reviewed) that sketched a flow: user pastes an Otomoto/OLX link → system auto-detects the seller and either attaches the car to an existing seller profile or creates a new one → seller gets an aggregate rating from car reviews. That flow was never built — today `listings` and `reviews` exist, but there is no seller/dealer concept anywhere in the schema or scraper. This spec adds it, plus a map, with explicit support for dealer networks that have multiple physical branches (e.g. "Auto Premium" in both Poznań and Wrocław) that must not be merged into one profile.

Confirmed with the site owner:
- Each branch is its own seller profile (not one company profile with a location list).
- Address/city takes priority over phone number when deciding if two listings belong to the same seller — a shared central phone number across branches must not merge them.
- Branches of the same network get auto-linked by normalized name matching (no manual admin linking step).
- The map's primary purpose is a "dealers near me" search/browse page, not just a small map embedded on a profile.
- Seller coordinates are geocoded automatically from the scraped address at profile-creation time; no manual pin correction in this iteration.
- Seller rating = average of the ratings already left on that seller's cars (`reviews.rating`). No new rating field, no changes to the review form.

## Data model

New table `sellers` — one row per **branch**, not per company:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source | text | `'otomoto'` \| `'otodom'` |
| external_seller_id | text, nullable | Seller/account ID from the source site, when present in scraped data |
| name | text | e.g. "Auto Premium" |
| phone | text, nullable | |
| city | text | |
| address | text, nullable | Full address string when available, beyond city |
| lat | double precision, nullable | Geocoded |
| lng | double precision, nullable | Geocoded |
| created_at | timestamptz | default now() |

`listings` gets a new nullable column `seller_id uuid references sellers(id)`. Nullable because private-seller listings (no dealer) never get a `sellers` row (see Non-goals).

## Seller matching (dedup) logic

Runs inside `scrape-listing` after a successful scrape, before writing the snapshot:

1. If the scrape yielded an `external_seller_id` **and** an existing `sellers` row has the same `external_seller_id` **and** the same `city` → match. (Both must agree — an ID reused across a rebrand/city move should not silently merge.)
2. Else, look for an existing row with the same `phone` **and** the same `city` (both required together — a shared central phone number across branches must not match on phone alone).
3. Else, create a new `sellers` row and geocode its address (see Geocoding).

If the scrape found no seller name at all (private/individual seller, not a dealer) → `seller_id` stays null, no `sellers` row is created.

## Branch grouping ("other locations of this network")

No join table. At render time on the seller profile page, query `sellers` for other rows where the normalized name matches (lowercase, trimmed, city-name suffix stripped if the source appended it, e.g. "Auto Premium Wrocław" → "auto premium") and `city` differs from the current row. Simple, no manual linking step, consistent with the "automatic grouping" choice — accepted tradeoff: two unrelated dealers that happen to share a common name will be shown as if related.

## Scraper changes (`supabase/functions/scrape-listing/index.ts`)

`scrapeOtomoto` already reads `ad.seller.location` (city only). Extend it to also pull, when present in the same `ad.seller` object:
- `ad.seller.id` → `external_seller_id`
- `ad.seller.name` (or `companyName`, whichever the payload uses) → `name`
- `ad.seller.phones?.[0]` → `phone`
- any address field beyond city, if present, → `address`

`scrapeOtodom` currently doesn't read seller/agency fields at all. Because Otodom's `__NEXT_DATA__` shape for the owner/agency block hasn't been inspected yet, implementing it is scoped as a small research-then-implement step in the plan rather than assumed to mirror Otomoto's shape.

After scraping, the function runs the matching logic above, then updates `listings.seller_id`.

## Geocoding

On creation of a new `sellers` row (not on every scrape — only once, when the row is first created), geocode `address` (or `city` if no street address) via the Nominatim (OpenStreetMap) public API — no API key, consistent with the project having no paid/keyed mapping integration today. Store `lat`/`lng` on the row. If geocoding fails or returns nothing, leave `lat`/`lng` null; the seller row and profile still work, it just won't appear on the map.

## Seller profile page — `app/seller/[id]/page.tsx`

Shows: name, city/address, a small Leaflet map (OpenStreetMap tiles, no API key) centered on `lat`/`lng` if present, aggregate rating (computed client-side as the average of `reviews.rating` across all of this seller's `listings`, same pattern as `averageRating` in `listing-client.tsx` today), the seller's cars (active and historical), and an "other branches of this network" section using the grouping query above.

`listing-client.tsx` gets a link to the seller profile next to the existing location/`MapPin` display, when `listing.seller_id` is set.

## Map search page — `app/komisy/page.tsx`

Full-page Leaflet map, one pin per `sellers` row that has `lat`/`lng` (rows without coordinates are excluded, not shown at a fallback location). Pin popup: name, city, rating, link to profile. Filters: city, minimum rating. Standalone page for this iteration — not linked from the homepage yet.

## RLS

`sellers`: SELECT open to everyone (matches `listings` today). INSERT/UPDATE only via the service role from inside the edge function — no client-side write path, since there's no profile-claiming flow yet.

## Non-goals (this iteration)

- No dealer claiming/verification flow for real owners to take control of their auto-created profile.
- No manual pin correction UI for geocoding mistakes.
- No separate seller-specific rating field — rating is purely derived from car reviews.
- No homepage integration for the map or seller profiles.
- Otodom seller/agency field extraction is not designed in detail here (see Scraper changes) — needs its own inspection step before implementation.

## Verification

- Paste two Otomoto listings from the same real dealer, same city → confirm both attach to one `sellers` row.
- Paste two Otomoto listings from what looks like the same dealer name but different cities → confirm two separate `sellers` rows, and that each profile's "other branches" section links to the other.
- Paste a private-seller (non-dealer) Otomoto listing → confirm no `sellers` row is created and `listings.seller_id` stays null.
- Seller profile page renders correctly for a seller with null `lat`/`lng` (geocoding failure case) — no map, rest of page intact.
- `/komisy` map only plots sellers with coordinates; filters by city and rating work.
- `npx tsc --noEmit` / `npx next lint` clean.
