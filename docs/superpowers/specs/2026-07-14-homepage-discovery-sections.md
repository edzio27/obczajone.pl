# Homepage discovery sections: biggest price drops + recently checked

## Context

Items from the same external redesign proposal referenced earlier this session: "Największe obniżki" (biggest price drops) and "Ostatnio sprawdzane" (recently checked). Confirmed with the site owner: "Ostatnio sprawdzane" means listings our own scraper most recently refreshed (`last_checked_at`), not a per-user browsing history (which we don't track and isn't in scope).

## Sections

### 1. Największe obniżki (biggest price drops)

- Pool: the 100 most recently-checked **active** listings (`is_active = true`, ordered by `last_checked_at` descending, limited to 100) — not every listing ever scraped, to keep the query bounded as the catalog grows.
- For each listing in that pool, compute the price-change percent the same way `components/recent-listings.tsx` already does: fetch `listing_snapshots` for those listing ids, take each listing's earliest snapshot, run it through the existing `computePriceChangePercent(currentPrice, earliestPrice)` from `lib/price-change.ts`.
- Filter to listings where the result is a negative percent (an actual drop — `null` or `>= 0` excluded).
- Sort ascending by percent (most negative — biggest drop — first).
- Take the top 3.
- Render with the existing `ListingCard` component (same as every other listing grid on the site) in a `grid md:grid-cols-3 gap-6`.
- If fewer than 3 (or zero) qualifying listings exist, render however many there are; if zero, don't render the section at all (no empty-state card for this one — it's a "highlights" section, not a primary list).

### 2. Ostatnio sprawdzane (recently checked)

- Query: active listings ordered by `last_checked_at` descending, limit 3.
- No price-change computation needed for this one — just the plain listing fields already used elsewhere (`title`, `location`, `current_price`, `source`, `created_at`, `image_url`), same as the "Wszystkie sprawdzone ogłoszenia" grid.
- Render with `ListingCard` in the same 3-column grid style.
- Always has content as long as any active listings exist (this is a simple "most recent" query, not a filtered one) — if there are truly zero active listings site-wide, skip rendering (matches the existing empty-state pattern in `RecentListings`).

## Placement

Both sections go on the homepage (`app/page.tsx`), after `<WhyUs />` and before the existing "Wszystkie sprawdzone ogłoszenia" (`RecentListings`) block — surfacing the more curated/exciting content above the full catalog listing.

Order: Największe obniżki, then Ostatnio sprawdzane, then the existing full list.

## Non-goals

- No per-user browsing history or personalization.
- No new database schema, columns, or scraper changes — both sections are computed entirely from data already collected (`listings.last_checked_at`, `listings.is_active`, `listing_snapshots`).
- No pagination on either new section — fixed at 3 items each, unlike the paginated "Wszystkie sprawdzone ogłoszenia" grid.
- Homepage FAQPage JSON-LD and other existing sections are unaffected.

## Verification

- Visual check at 1280px and 375px: both new sections render between WhyUs and the full listings grid, each showing up to 3 `ListingCard`s with photos/badges/prices consistent with the rest of the site.
- Confirm the "Największe obniżki" cards actually show a negative price-change badge (already part of `ListingCard`'s existing rendering when `priceChangePercent` is passed).
- `npx tsc --noEmit` / `npx next lint` clean.
