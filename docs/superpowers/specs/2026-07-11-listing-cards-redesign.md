# Listing cards & detail page redesign

## Context

Follow-up polish pass after the navy/green rebrand (see `2026-07-10-rebranding-design.md`). The rebrand didn't touch `components/listing-card.tsx` or `app/listing/[id]/listing-client.tsx`, so both still use the pre-rebrand blue palette (`text-blue-600`, `hover:border-blue-200`, `ring-blue-500`, `bg-gray-50`) instead of the new design tokens. Separately, the site owner flagged three concrete UX issues:

1. Listing photos look "flat" — `ListingCard`'s image container is a fixed `h-48` regardless of card width, so at typical 3-column grid widths the photo renders at a very wide, short aspect ratio.
2. The homepage's "Wszystkie sprawdzone ogłoszenia" section fetches and renders all 50 listings at once — no pagination, a long heavy scroll.
3. The listing detail page and the cards don't surface the one thing this site is actually for: whether the price changed. Price history is already captured (`listing_snapshots`), just never displayed as a quick signal.

Confirmed with the site owner: `listing_snapshots.description` and `.metadata` are always empty (the scraper hardcodes them) — this redesign works only with data that is genuinely populated (title, price, location, photo_urls, source, first_seen_at/last_checked_at, ratings, and the price history already in `listing_snapshots.price`/`scraped_at`). No scraper changes.

## Price-change indicator

A small derived signal, not new data: compare a listing's current price against its **earliest recorded snapshot price** and show a percentage change.

- `> 0` (price went up): red, e.g. `+8%`.
- `< 0` (price dropped): green (`text-verified`), e.g. `-8%`.
- `0` or only one snapshot exists: neutral badge, "Cena bez zmian" (or omit entirely if there's only ever been one snapshot — nothing to compare against).

New helper `lib/price-change.ts`:
```ts
export function computePriceChangePercent(currentPrice: number, earliestPrice: number): number | null {
  if (!earliestPrice || earliestPrice <= 0) return null;
  if (currentPrice === earliestPrice) return 0;
  return ((currentPrice - earliestPrice) / earliestPrice) * 100;
}
```
Returns `null` when there's no meaningful baseline (e.g. earliest price missing/zero) — callers render nothing in that case.

**Where it's computed:**
- **Detail page** (`ListingClient`): already fetches all `snapshots` for the listing sorted by `scraped_at`. Sort ascending, take `snapshots[0].price` as the earliest, `listing.current_price` as current. No new query.
- **Homepage recent-listings grid**: after fetching a page of listings, fetch `listing_snapshots` (`listing_id, price, scraped_at`) for just those listing IDs in one query, group client-side, take the min-`scraped_at` row per `listing_id` as the earliest price. Same pattern this codebase already uses for computing average ratings from an embedded `reviews` array.
- **Not added to** `components/recent-reviews.tsx` or `app/profile/page.tsx`'s `ListingCard` usages — those call sites don't currently fetch snapshot data and adding it there is out of scope for this pass. `ListingCard`'s new `priceChangePercent` prop is optional; when omitted, the badge simply doesn't render, so those call sites keep working unchanged.

## `ListingCard` redesign

Layout: horizontal/compact (the site owner's chosen option from the mockup comparison) — square photo on the left, details on the right, replacing the current vertical photo-on-top card.

- Photo: `aspect-square`, fixed width (e.g. `w-28 sm:w-36`), `object-cover`, rounded corners — no longer stretches to a wide flat strip.
- Source badge (`otomoto`/`otodom`) and star rating move to a small row above the title (not overlaid on the photo — simpler, avoids text-over-photo contrast issues with arbitrary listing photos).
- Title, location, price, and the new price-change badge next to the price.
- Replace every hardcoded blue class (`hover:border-blue-200`, `group-hover:text-blue-600`, `text-blue-600`) with the rebrand's tokens (`hover:border-primary/30`, `group-hover:text-primary`, `text-primary`).
- `userReview` block (shown only in the profile page's "your reviews" list) keeps its current content, just re-flows under the new horizontal layout instead of the old vertical one.

Grid usage: `grid md:grid-cols-2 lg:grid-cols-3 gap-6` stays sensible with the new compact card — a horizontal card doesn't need a wide column to look right.

## Homepage pagination

`components/recent-listings.tsx` is rewritten to own real pagination instead of the current dead-code `showMoreButton`/`showAll` client-side slice (not used from any call site today, since `app/page.tsx` calls `<RecentListings limit={50} />` with no `showMoreButton`).

- New props: `RecentListings({ pageSize = 9 }: { pageSize?: number })` — drops `limit` and `showMoreButton`.
- Initial fetch: `.range(0, pageSize - 1)`.
- "Załaduj więcej" button: fetches the next range (`.range(offset, offset + pageSize - 1)`) and appends to existing state; button hides once a fetch returns fewer than `pageSize` rows (no more pages).
- `app/page.tsx` usage changes from `<RecentListings limit={50} />` to `<RecentListings />` (uses the new default `pageSize=9`).
- Loading skeleton, error, and empty states keep their current look, just adapted to the new prop shape.

## Detail page (`ListingClient`) token cleanup + price-change display

- Replace `bg-gray-50` page background with `bg-background`.
- Replace `ring-blue-500` (selected photo thumbnail) with `ring-primary`.
- Replace `hover:border-blue-500` (similar listings links) with `hover:border-primary`.
- Add the price-change badge next to the large current-price display, using the same helper and same visual treatment (color-coded) as the card.
- No other structural changes — gallery, description, price history chart, similar listings, and reviews sections stay as they are, just inherit correct token colors already used elsewhere on the rebranded site.

## Non-goals

- No scraper/edge-function changes, no new scraped fields (mileage, equipment, etc.).
- No changes to `recent-reviews.tsx` or `app/profile/page.tsx` beyond what `ListingCard`'s redesign gives them for free (they don't get the price-change badge in this pass).
- No changes to RLS, auth, or business logic.
