# Profile page "watchlist digest"

## Context

Inspired by the same external redesign proposal as the trust score — item 9, "Dashboard użytkownika": a short summary shown after login ("2 auta staniały, 1 zostało sprzedane...") meant to encourage users to keep coming back. `/profile` (`app/profile/page.tsx`) already exists with three tabs (Moje Ogłoszenia / Moje Komentarze / Polubione) — this spec adds a small summary strip above those tabs, scoped to the "Polubione" (favorites) data, since that's the existing concept closest to "obserwowane auta" (watched cars).

The original proposal's third metric ("1 nowe ogłoszenie") doesn't map to anything in our data model for the favorites list and was dropped after confirming with the site owner — this digest has exactly two metrics.

## Metrics

Computed from the already-fetched `favorites` array in `app/profile/page.tsx` (the `Listing[]` produced by `fetchUserData`'s favorites branch):

1. **Cena spadła**: count of favorites where `price_change !== null && price_change < 0`. `price_change` is already computed today as `latestPrice - previousPrice` from the two most recent `listing_snapshots` rows.
2. **Zdjęte z rynku**: count of favorites where `is_active === false`. **New**: the favorites Supabase query does not currently select `is_active` — it needs to, and the `Listing` type needs the field added.

## Display

Two stat tiles, side by side, above the `<Tabs>` block:

```
📉 2          🔴 1
auta staniały   zostało zdjętych z rynku
```

- Only rendered when `favorites.length > 0` — no tiles (and no empty/zero placeholder) when the user has no favorites yet, since there's nothing to summarize.
- Counts always shown even when 0 — no gamified rounding or hiding zero states.
- Visual style matches existing stat-card patterns already in the app (rounded-2xl, border, `bg-white`, `shadow-sm`) — not a new visual language.

## Non-goals

- No "nowe ogłoszenie" metric (dropped, no clear data mapping).
- No digest for the "Moje Ogłoszenia" or "Moje Komentarze" tabs — favorites only.
- No push notifications, email digests, or "since your last visit" time-windowing — this is a live snapshot computed on every page load from current data, not a delta since a stored last-seen timestamp.
- No changes to the scraper, database schema (beyond selecting an already-existing column), or other pages.

## Verification

- Visual check with a test account that has: at least one favorite with a price drop, at least one inactive favorite, and (separately) an account with zero favorites — confirm the strip appears/hides and counts correctly in each case.
- `npx tsc --noEmit` / `npx next lint` clean.
