# Listing trust score (0-100)

## Context

Inspired by an external redesign proposal (`Propozycje_rozwoju_Obczajone.txt`) suggesting a "0-100 score with colored indicators" for each listing. The original suggestion referenced signals we don't have (VIN check, market-price comparison) — this spec scopes the score to what obczajone.pl actually collects today: price history, user reviews, and listing activity status. Confirmed with the site owner: no market-price comparison in this iteration.

## Scope

Detail page only (`app/listing/[id]/listing-client.tsx`) for this iteration. Homepage `ListingCard` tiles are a possible follow-up (would require computing the same score per card in a list query) but are explicitly out of scope here.

## Score formula

Total score = `priceScore + reviewScore + activityScore`, rounded to the nearest integer. Range: roughly 15–100.

### 1. Price score (0–40)

Reuses the existing `computePriceChangePercent(currentPrice, earliestPrice)` from `lib/price-change.ts` (percent change from the earliest snapshot to the current price; `null` if there's no usable earliest price).

```
priceScore = percent == null ? 25 : clamp(30 - percent * 1.5, 5, 40)
```

- No price history → 25 (neutral — not enough data)
- Price unchanged (`percent === 0`) → 30
- Price dropped (`percent < 0`) → above 30, up to 40 (a 10%+ drop already hits the 40 cap)
- Price increased (`percent > 0`) → below 30, down to 5 (a ~17%+ increase hits the 5 floor)

### 2. Review score (0–40)

```
reviewScore = reviewCount === 0
  ? 20
  : hasReportedReview
    ? max(0, (averageRating / 5) * 40 - 10)
    : (averageRating / 5) * 40
```

- No reviews yet → 20 (neutral — unknown)
- `hasReportedReview` is true if any review counted in `averageRating` has `is_reported = true` — a 10-point penalty reflects that at least one visitor flagged something as suspicious, independent of the star average.

### 3. Activity score (0–20)

```
activityScore = listing.is_active ? 20 : 10
```

Not a penalty for being inactive (a sold-out listing isn't necessarily a bad sign) — just a smaller contribution since the "is this still a live opportunity" signal is weaker.

## Colored indicator rows

Three rows displayed under the overall score, each independently colored (green/yellow/red) using the existing `--success` / `--warning` / `--destructive` tokens — not tied to the point values above, but to the same underlying signal so the row color and the row text always agree:

| Row | Green | Yellow | Red |
|---|---|---|---|
| Cena | `percent < 0`: "Cena spadła o X%" | `percent === 0` or no history: "Cena bez zmian" / "Za mało danych o cenie" | `percent > 0`: "Cena wzrosła o X%" |
| Opinie | `reviewCount > 0 && averageRating >= 4`: "Ocena X/5 z Y opinii" | `reviewCount === 0`: "Brak opinii" · or `2.5 <= averageRating < 4` | `averageRating < 2.5` · or `hasReportedReview` (forces red regardless of rating): "Jedna z opinii została zgłoszona" |
| Ogłoszenie | `is_active`: "Aktywne od X dni" (X = days since `first_seen_at`) | — | `!is_active`: "Zdjęte z rynku" (yellow, not red — this is informational, not a warning) |

(The "Ogłoszenie" row only ever renders green or yellow, never red — being inactive isn't a trust problem.)

## Overall badge color

```
score >= 70 → green ("Wysoka wiarygodność")
score >= 40 → yellow ("Przeciętna wiarygodność")
else        → red ("Niska wiarygodność")
```

## Placement

A new card, "Ocena wiarygodności", shown on the listing detail page right after the main listing-info card (title/price/CTA) and before the "Historia cen" card — this is the first thing a visitor should see after the raw listing facts.

## Data needed

- `computePriceChangePercent` — already exists (`lib/price-change.ts`), already computed in `listing-client.tsx` as `priceChangePercent`.
- `averageRating`, `reviewCount` — already fetched and computed in `listing-client.tsx`.
- `hasReportedReview` — **new**: the existing reviews query only selects `rating`; it needs to also select `is_reported` so this can be derived client-side.
- `listing.is_active`, `listing.first_seen_at` — already present on the `Listing` type/fetch.

## Non-goals

- No market-price comparison (no "cena atrakcyjna względem rynku") — no data source for it yet.
- No VIN-based checks.
- No score on `ListingCard` / homepage list view in this iteration.
- No changes to the scraper or database schema — this is a pure derived/computed value, calculated client-side from data already being fetched.

## Verification

- Visual check on a listing with: a price drop, a price increase, no history, reviews present, no reviews, an inactive listing — confirm each combination renders the expected row colors and score.
- `npx tsc --noEmit` / `npx next lint` clean.
