# Listing Trust Score Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 0-100 "trust score" with three colored indicator rows (price / reviews / activity) to the listing detail page, per `docs/superpowers/specs/2026-07-14-listing-trust-score.md`.

**Architecture:** A pure scoring function (`lib/listing-score.ts`) takes already-available data (price-change percent, review stats, activity status) and returns a total + three colored rows. A presentational component (`components/listing-score-card.tsx`) renders that result. `listing-client.tsx` fetches one extra column (`is_reported` on reviews) it wasn't already selecting, computes the score, and renders the card in the new spot.

**Tech Stack:** No new dependencies. Uses `date-fns` (already installed) for day-count math.

## Global Constraints

- No changes to the scraper, database schema, or `ListingCard` (homepage tiles) — detail page only, per spec.
- Score inputs are exactly: `computePriceChangePercent` (existing), `averageRating`/`reviewCount` (existing), a new `hasReportedReview` boolean, `listing.is_active`, and days since `listing.first_seen_at`.

---

### Task 1: Scoring function

**Files:**
- Create: `lib/listing-score.ts`

**Interfaces:**
- Produces: `computeListingScore(input: ListingScoreInput): ListingScore`, `ListingScoreInput`, `ListingScore`, `ScoreLevel` — consumed by Task 3 (`listing-client.tsx`) and Task 2 (`ListingScoreCard`'s prop type).

- [ ] **Step 1: Write the scoring module**

Create `lib/listing-score.ts`:

```ts
export type ScoreLevel = 'green' | 'yellow' | 'red';

export type ListingScoreRow = {
  level: ScoreLevel;
  label: string;
};

export type ListingScoreInput = {
  priceChangePercent: number | null;
  averageRating: number | null;
  reviewCount: number;
  hasReportedReview: boolean;
  isActive: boolean;
  daysSinceFirstSeen: number;
};

export type ListingScore = {
  total: number;
  level: ScoreLevel;
  rows: {
    price: ListingScoreRow;
    reviews: ListingScoreRow;
    activity: ListingScoreRow;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function reviewCountLabel(count: number): string {
  const noun = count === 1 ? 'opinia' : count < 5 ? 'opinie' : 'opinii';
  return `${count} ${noun}`;
}

export function computeListingScore(input: ListingScoreInput): ListingScore {
  const {
    priceChangePercent,
    averageRating,
    reviewCount,
    hasReportedReview,
    isActive,
    daysSinceFirstSeen,
  } = input;

  const priceScore =
    priceChangePercent == null ? 25 : clamp(30 - priceChangePercent * 1.5, 5, 40);

  const reviewScore =
    reviewCount === 0
      ? 20
      : hasReportedReview
        ? Math.max(0, ((averageRating ?? 0) / 5) * 40 - 10)
        : ((averageRating ?? 0) / 5) * 40;

  const activityScore = isActive ? 20 : 10;

  const total = Math.round(priceScore + reviewScore + activityScore);

  const priceRow: ListingScoreRow =
    priceChangePercent == null || priceChangePercent === 0
      ? {
          level: 'yellow',
          label: priceChangePercent === 0 ? 'Cena bez zmian' : 'Za mało danych o cenie',
        }
      : priceChangePercent < 0
        ? { level: 'green', label: `Cena spadła o ${Math.abs(priceChangePercent).toFixed(0)}%` }
        : { level: 'red', label: `Cena wzrosła o ${priceChangePercent.toFixed(0)}%` };

  const reviewsRow: ListingScoreRow =
    reviewCount === 0
      ? { level: 'yellow', label: 'Brak opinii' }
      : hasReportedReview
        ? { level: 'red', label: 'Jedna z opinii została zgłoszona' }
        : (averageRating ?? 0) >= 4
          ? { level: 'green', label: `Ocena ${averageRating!.toFixed(1)}/5 z ${reviewCountLabel(reviewCount)}` }
          : (averageRating ?? 0) >= 2.5
            ? { level: 'yellow', label: `Ocena ${averageRating!.toFixed(1)}/5 z ${reviewCountLabel(reviewCount)}` }
            : { level: 'red', label: `Ocena ${averageRating!.toFixed(1)}/5 z ${reviewCountLabel(reviewCount)}` };

  const activityRow: ListingScoreRow = isActive
    ? { level: 'green', label: `Aktywne od ${daysSinceFirstSeen} dni` }
    : { level: 'yellow', label: 'Zdjęte z rynku' };

  const level: ScoreLevel = total >= 70 ? 'green' : total >= 40 ? 'yellow' : 'red';

  return {
    total,
    level,
    rows: { price: priceRow, reviews: reviewsRow, activity: activityRow },
  };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/listing-score.ts
git commit -m "Add listing trust score calculation"
```

---

### Task 2: Score display component

**Files:**
- Create: `components/listing-score-card.tsx`

**Interfaces:**
- Consumes: `ListingScore` type from `lib/listing-score.ts` (Task 1).
- Produces: `ListingScoreCard({ score: ListingScore })` — consumed by Task 3.

- [ ] **Step 1: Write the component**

Create `components/listing-score-card.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ListingScore, ScoreLevel } from '@/lib/listing-score';

const DOT_CLASS: Record<ScoreLevel, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-destructive',
};

const TEXT_CLASS: Record<ScoreLevel, string> = {
  green: 'text-success',
  yellow: 'text-warning',
  red: 'text-destructive',
};

const HEADLINE: Record<ScoreLevel, string> = {
  green: 'Wysoka wiarygodność',
  yellow: 'Przeciętna wiarygodność',
  red: 'Niska wiarygodność',
};

export function ListingScoreCard({ score }: { score: ListingScore }) {
  const rows = [score.rows.price, score.rows.reviews, score.rows.activity];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Ocena wiarygodności</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-4">
          <span className={`text-4xl font-bold ${TEXT_CLASS[score.level]}`}>{score.total}</span>
          <span className="text-gray-400 text-lg">/100</span>
          <span className={`text-sm font-medium ${TEXT_CLASS[score.level]}`}>
            {HEADLINE[score.level]}
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_CLASS[row.level]}`} />
              {row.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/listing-score-card.tsx
git commit -m "Add ListingScoreCard component"
```

---

### Task 3: Wire the score into the listing detail page

**Files:**
- Modify: `app/listing/[id]/listing-client.tsx`

- [ ] **Step 1: Fetch `is_reported` alongside `rating`, track it in state**

Replace:

```tsx
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
```

with:

```tsx
  const [reviewCount, setReviewCount] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [hasReportedReview, setHasReportedReview] = useState(false);
```

Replace:

```tsx
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating')
        .eq('listing_id', listingId);

      if (reviewsData && reviewsData.length > 0) {
        setReviewCount(reviewsData.length);
        const avg = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
        setAverageRating(avg);
      }
```

with:

```tsx
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating, is_reported')
        .eq('listing_id', listingId);

      if (reviewsData && reviewsData.length > 0) {
        setReviewCount(reviewsData.length);
        const avg = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
        setAverageRating(avg);
        setHasReportedReview(reviewsData.some((r) => r.is_reported));
      }
```

- [ ] **Step 2: Import the scoring pieces**

Replace:

```tsx
import { computePriceChangePercent } from '@/lib/price-change';
```

with:

```tsx
import { computePriceChangePercent } from '@/lib/price-change';
import { computeListingScore } from '@/lib/listing-score';
import { ListingScoreCard } from '@/components/listing-score-card';
```

Add `differenceInDays` to the existing `date-fns` import:

Replace:

```tsx
import { formatDistanceToNow } from 'date-fns';
```

with:

```tsx
import { formatDistanceToNow, differenceInDays } from 'date-fns';
```

- [ ] **Step 3: Compute the score after `priceChangePercent`**

Replace:

```tsx
  const priceChangePercent = earliestSnapshot
    ? computePriceChangePercent(listing.current_price, earliestSnapshot.price)
    : null;
```

with:

```tsx
  const priceChangePercent = earliestSnapshot
    ? computePriceChangePercent(listing.current_price, earliestSnapshot.price)
    : null;

  const listingScore = computeListingScore({
    priceChangePercent,
    averageRating,
    reviewCount,
    hasReportedReview,
    isActive: listing.is_active,
    daysSinceFirstSeen: differenceInDays(new Date(), new Date(listing.first_seen_at)),
  });
```

- [ ] **Step 4: Render the card right after the photo+info grid, before the description card**

Replace:

```tsx
          </div>

          {latestSnapshot?.description && (
```

with:

```tsx
          </div>

          <ListingScoreCard score={listingScore} />

          {latestSnapshot?.description && (
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors (same pre-existing warnings as before this plan are fine).

- [ ] **Step 6: Commit**

```bash
git add app/listing/\[id\]/listing-client.tsx
git commit -m "Show listing trust score on the detail page"
```

---

### Task 4: Full verification sweep and push

- [ ] **Step 1: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 2: Visual check — price drop scenario**

Navigate to a listing whose price has dropped since the earliest snapshot (e.g. the Renault TRAFIC listing used earlier this session, or any listing with `priceChangePercent < 0`). Confirm: score card appears right after the title/price/CTA card and before "Opis"/"Historia cen", price row is green with "Cena spadła o X%", total score is visibly above the price-increase case.

- [ ] **Step 3: Visual check — no price history / no reviews scenario**

Navigate to a listing with only one snapshot and no reviews. Confirm: price row is yellow "Za mało danych o cenie", reviews row is yellow "Brak opinii", total score around 25+20+20=65 (or 25+20+10=55 if inactive).

- [ ] **Step 4: Visual check — inactive listing**

Find or temporarily note a listing with `is_active = false` (or reason about the "Nieaktywne" badge already shown elsewhere on the page to locate one). Confirm the activity row renders yellow "Zdjęte z rynku", not red.

- [ ] **Step 5: Push**

```bash
git push origin main
```

Expected: push succeeds (this work lands directly on `main` per the site owner's established preference this session).

- [ ] **Step 6: Final report**

Confirm to the user: trust score card live on the listing detail page, screenshots of at least one real listing showing the score and colored rows, commits pushed.
