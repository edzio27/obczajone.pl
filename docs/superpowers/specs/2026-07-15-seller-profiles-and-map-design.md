# Seller profiles and branch map

## Context

Follow-up to an earlier ChatGPT design session (screenshots reviewed) that sketched a flow: user pastes an Otomoto/OLX link → system auto-detects the seller and either attaches the car to an existing seller profile or creates a new one → seller gets an aggregate rating from car reviews. That flow was never built — today `listings` and `reviews` exist, but there is no seller/dealer concept anywhere in the schema or scraper. This spec adds it, plus a map, with explicit support for dealer networks that have multiple physical branches (e.g. "Auto Premium" in both Poznań and Wrocław) that must not be merged into one profile.

Confirmed with the site owner:
- Each branch is its own seller profile (not one company profile with a location list).
- Branches of the same network get auto-linked by normalized name matching (no manual admin linking step).
- The map's primary purpose is a "dealers near me" search/browse page, not just a small map embedded on a profile.
- Seller rating = average of the ratings already left on that seller's cars (`reviews.rating`). No new rating field, no changes to the review form.

**Revised during scraper research (real Otomoto ad fetched and its `__NEXT_DATA__` inspected — see Matching/Geocoding below):** the phone number is not usable for matching — Otomoto ships it as an obfuscated string (`ad.phoneNumbers`, e.g. `"mx2rqzMvI1joGNiDQuWD4T3/...=="`), decrypted client-side only after a user clicks "pokaż numer". The original plan to match on phone+city is replaced with `external_seller_id`+city (Otomoto exposes a stable `ad.seller.id`), falling back to normalized name+city. Otomoto also ships ready-made coordinates (`ad.seller.location.map.latitude/longitude`) for dealers, so geocoding is a fallback path, not the primary source of `lat`/`lng`.

## Data model

New table `sellers` — one row per **branch**, not per company:

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source | text | `'otomoto'` \| `'otodom'` |
| external_seller_id | text, nullable | Seller/account ID from the source site (e.g. Otomoto's `ad.seller.id`) — primary matching key |
| name | text | e.g. "WINCARS" |
| phone | text, nullable | Display-only; not used for matching (see Matching logic — Otomoto doesn't expose a plain phone number server-side) |
| city | text | |
| address | text, nullable | Full address string when available, beyond city |
| lat | double precision, nullable | From the source site when provided, else geocoded (see Geocoding) |
| lng | double precision, nullable | From the source site when provided, else geocoded (see Geocoding) |
| created_at | timestamptz | default now() |

`listings` gets a new nullable column `seller_id uuid references sellers(id)`. Nullable because private-seller listings (no dealer) never get a `sellers` row (see Non-goals).

## Seller matching (dedup) logic

Runs inside `scrape-listing` after a successful scrape, before writing the snapshot:

1. If the scrape yielded an `external_seller_id` **and** an existing `sellers` row has the same `external_seller_id` **and** the same `city` → match. (Both must agree — an ID reused across a rebrand/city move should not silently merge.)
2. Else, look for an existing row with the same normalized `name` (see Branch grouping for the normalization rule) **and** the same `city` (both required together — a common name shared by unrelated dealers across cities must not merge).
3. Else, create a new `sellers` row (see Geocoding for how `lat`/`lng` get set).

Only dealers get a `sellers` row: the scraper only runs this logic when Otomoto's `ad.seller.type === 'PROFESSIONAL'` (confirmed on a real listing; the exact string for private individuals hasn't been observed yet — verify during Task 2 implementation and adjust if it differs). Private-seller listings leave `listings.seller_id` null and never create a `sellers` row.

## Branch grouping ("other locations of this network")

No join table. At render time on the seller profile page, query `sellers` for other rows where the normalized name matches (lowercase, trimmed, city-name suffix stripped if the source appended it, e.g. "Auto Premium Wrocław" → "auto premium") and `city` differs from the current row. Simple, no manual linking step, consistent with the "automatic grouping" choice — accepted tradeoff: two unrelated dealers that happen to share a common name will be shown as if related.

## Scraper changes (`supabase/functions/scrape-listing/index.ts`)

`scrapeOtomoto` already reads `ad.seller.location.city`/`.region` (confirmed real shape via a fetched live listing, WINCARS dealer in Warszawa). Extend it to also pull, when `ad.seller.type === 'PROFESSIONAL'`:
- `ad.seller.id` → `external_seller_id` (confirmed real value: a numeric-string account ID, e.g. `"16260395"`)
- `ad.seller.name` → `name` (confirmed real value, e.g. `"WINCARS"`)
- `ad.seller.location.address` → `address` (confirmed present, e.g. `"UL. ALEJA SOLIDARNOŚCI 163 , U010"`)
- `ad.seller.location.city` → `city`
- `ad.seller.location.map.latitude` / `ad.seller.location.map.longitude` → `lat`/`lng` directly (confirmed present — Otomoto already geocodes dealer addresses itself)
- No phone field is scraped (see Context — not available as plain text).

`scrapeOtodom` currently doesn't read seller/agency fields at all. Because Otodom's `__NEXT_DATA__` shape for the owner/agency block hasn't been inspected yet, implementing it is scoped as a small research-then-implement step in the plan rather than assumed to mirror Otomoto's shape.

After scraping, the function runs the matching logic above, then updates `listings.seller_id`.

## Geocoding

`lat`/`lng` come directly from `ad.seller.location.map.latitude/longitude` when Otomoto provides them (the normal case for dealers, confirmed above) — no geocoding call needed. Only if a new `sellers` row is created without coordinates (Otomoto omitted them, or a future Otodom implementation has no equivalent field) does the scraper fall back to geocoding `address` (or `city` if no street address) via the Nominatim (OpenStreetMap) public API — no API key, consistent with the project having no paid/keyed mapping integration today. If that also fails or returns nothing, `lat`/`lng` stay null; the seller row and profile still work, it just won't appear on the map.

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

- Paste two Otomoto listings from the same real dealer, same city (e.g. two listings from `wincars.pl` / dealer id `16260395` in Warszawa) → confirm both attach to one `sellers` row.
- Paste two Otomoto listings from what looks like the same dealer name but different cities → confirm two separate `sellers` rows, and that each profile's "other branches" section links to the other.
- Paste a private-seller (non-dealer) Otomoto listing → confirm no `sellers` row is created and `listings.seller_id` stays null.
- Seller profile page renders correctly for a seller with null `lat`/`lng` (geocoding failure case) — no map, rest of page intact.
- `/komisy` map only plots sellers with coordinates; filters by city and rating work.
- `npx tsc --noEmit` / `npx next lint` clean.
