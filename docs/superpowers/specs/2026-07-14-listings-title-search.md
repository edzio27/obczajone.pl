# Title search for "Wszystkie sprawdzone ogłoszenia"

## Context

Last item from today's punch list of site polish items. The user picked title/keyword search only — no source filter, no price range — for the paginated "Wszystkie sprawdzone ogłoszenia" grid (`components/recent-listings.tsx`).

## Behavior

- A search input rendered above the listing grid, inside `RecentListings` itself (self-contained, no prop drilling from `app/page.tsx`).
- Debounced (~400ms) — typing doesn't refetch on every keystroke.
- On a (debounced) query change: reset to page 0 and refetch from scratch with the query applied, replacing the current listings rather than appending.
- Filter implementation: Supabase `.ilike('title', '%query%')` (case-insensitive substring match) added to both the first-page and "Załaduj więcej" queries.
- Empty query: behaves exactly as today (no filter, full paginated list).
- No results for a query: reuse the existing "Brak ogłoszeń" empty-state card, with the message adjusted to reflect that this is a search result (not literally zero listings in the database).

## Non-goals

- No source (Otomoto/Otodom) filter, no price range filter — explicitly out of scope per the site owner.
- No search-as-you-type result count or autocomplete — just the debounced filtered grid.
- No changes to `BiggestPriceDrops`, `RecentlyChecked`, or any other section — title search applies only to this one paginated grid.
- No URL query-param syncing (search state resets on page reload) — this is a client-side, in-page filter, not a shareable search URL.

## Verification

- Type a keyword that matches some existing listings (e.g. a brand name already seen in the data, like "BMW") and confirm the grid narrows to matching titles only, pagination resets.
- Clear the search and confirm the full list returns.
- Type something with zero matches and confirm the empty-state card appears instead of a blank grid.
- `npx tsc --noEmit` / `npx next lint` clean.
