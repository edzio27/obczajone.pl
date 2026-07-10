# Listing Cards & Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `ListingCard` into a compact horizontal layout with a derived price-change indicator, replace the homepage's fetch-all-50 listings grid with real server-side pagination, and clean up leftover pre-rebrand blue colors on the listing detail page.

**Architecture:** A new pure helper (`lib/price-change.ts`) computes a percentage change from two prices; both `RecentListings` (homepage grid) and `ListingClient` (detail page) already have or can cheaply fetch the two data points it needs (current price + earliest snapshot price) and pass the result into `ListingCard` / render it inline. `RecentListings` is rewritten to own real `.range()`-based pagination instead of the currently-unused client-side slice logic.

**Tech Stack:** Next.js 13.5.1 (App Router), `@supabase/supabase-js` (`.range()` for pagination), Tailwind CSS with the navy/green design tokens from the July 10 rebrand (`bg-primary`, `text-primary`, `text-verified`, `hover:border-primary/30`).

## Global Constraints

- No scraper/edge-function changes; no new scraped fields. Only `title`, `current_price`, `location`, `photo_urls`, `source`, `first_seen_at`/`last_checked_at`, ratings, and `listing_snapshots.price`/`scraped_at` are used.
- `ListingCard`'s new `priceChangePercent` prop is optional — `components/recent-reviews.tsx` and `app/profile/page.tsx` keep calling it exactly as they do today and simply won't pass the new prop (badge doesn't render for them). Do not add snapshot-fetching to those two files in this plan.
- Replace hardcoded blue classes (`text-blue-600`, `hover:border-blue-200`, `hover:text-blue-600`, `ring-blue-500`, `hover:border-blue-500`, `bg-gray-50`) with the rebrand's tokens (`text-primary`, `hover:border-primary/30`, `group-hover:text-primary`, `ring-primary`, `hover:border-primary`, `bg-background`) everywhere touched by this plan.
- No changes to RLS, auth, or business logic.
- This project has no automated test suite (confirmed during the July 10 rebrand work) — verification is `npx tsc --noEmit`, `npx next lint`, and visual checks via this project's preview tooling (a dev server is already configured under the name `obczajone-dev`).

---

### Task 1: Price-change helper

**Files:**
- Create: `lib/price-change.ts`

**Interfaces:**
- Produces: `computePriceChangePercent(currentPrice: number, earliestPrice: number): number | null` — later tasks import this exact name/signature from `@/lib/price-change`.

- [ ] **Step 1: Write the helper**

Create `lib/price-change.ts`:

```ts
export function computePriceChangePercent(
  currentPrice: number,
  earliestPrice: number
): number | null {
  if (!earliestPrice || earliestPrice <= 0) return null;
  if (currentPrice === earliestPrice) return 0;
  return ((currentPrice - earliestPrice) / earliestPrice) * 100;
}
```

- [ ] **Step 2: Sanity-check the math manually**

There's no test runner in this project. Verify by reasoning through 3 cases (write these as a comment nowhere — just confirm mentally/on scratch paper before moving on):
- `computePriceChangePercent(55900, 60000)` → `((55900-60000)/60000)*100` = `-6.833...` (price dropped ~6.8%)
- `computePriceChangePercent(60000, 60000)` → `0` (no change)
- `computePriceChangePercent(60000, 0)` → `null` (no baseline)

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/price-change.ts
git commit -m "Add computePriceChangePercent helper for price-history badges"
```

---

### Task 2: Redesign `ListingCard`

**Files:**
- Modify: `components/listing-card.tsx`

**Interfaces:**
- Consumes: `computePriceChangePercent` is NOT called inside `ListingCard` itself — callers compute the percent and pass it in as a plain number, so this component stays a pure presentational card.
- Produces: `ListingCard` now accepts an additional optional prop `priceChangePercent?: number | null`. All existing props (`id`, `title`, `location`, `current_price`, `source`, `created_at`, `image_url`, `average_rating`, `review_count`, `userReview`) are unchanged — existing call sites (`components/recent-reviews.tsx`, `app/profile/page.tsx`) keep working without modification.

- [ ] **Step 1: Replace the component with the horizontal layout**

Replace the full contents of `components/listing-card.tsx`:

```tsx
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Star, TrendingDown, TrendingUp } from 'lucide-react';

type ListingCardProps = {
  id: string;
  title: string | null;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string | null;
  average_rating?: number;
  review_count?: number;
  priceChangePercent?: number | null;
  userReview?: {
    rating: number;
    comment: string;
    created_at: string;
  };
};

function PriceChangeBadge({ percent }: { percent: number }) {
  if (percent === 0) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        Cena bez zmian
      </span>
    );
  }
  const dropped = percent < 0;
  const Icon = dropped ? TrendingDown : TrendingUp;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold ${
        dropped ? 'text-verified' : 'text-destructive'
      }`}
    >
      <Icon className="h-3 w-3" />
      {dropped ? '' : '+'}
      {percent.toFixed(0)}%
    </span>
  );
}

export function ListingCard({
  id,
  title,
  location,
  current_price,
  source,
  created_at,
  image_url,
  average_rating,
  review_count = 0,
  priceChangePercent,
  userReview,
}: ListingCardProps) {
  const getStarRating = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  return (
    <Link href={`/listing/${id}`}>
      <Card className="group hover:shadow-xl hover:border-primary/30 transition-all duration-300 cursor-pointer h-full border-gray-200 hover:-translate-y-1 overflow-hidden">
        <div className="flex gap-4 p-4">
          <div className="w-28 sm:w-36 aspect-square flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
            {image_url && (
              <img
                src={image_url}
                alt={title || 'Zdjęcie ogłoszenia'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1.5">
              <Badge
                variant={source === 'otomoto' ? 'default' : 'secondary'}
                className="font-semibold"
              >
                {source}
              </Badge>
              {average_rating && review_count > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{average_rating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({review_count})</span>
                </div>
              )}
            </div>

            <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {title || 'Brak tytułu'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {location || 'Brak lokalizacji'}
            </p>

            <div className="mt-auto pt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-xl font-bold text-primary">
                  {current_price.toLocaleString('pl-PL')} zł
                </p>
                {priceChangePercent != null && (
                  <PriceChangeBadge percent={priceChangePercent} />
                )}
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(created_at), {
                  addSuffix: true,
                  locale: pl,
                })}
              </p>
            </div>

            {userReview && (
              <div className="pt-3 border-t mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Twoja ocena:</span>
                  <span className="text-lg">{getStarRating(userReview.rating)}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 italic">
                  &quot;{userReview.comment}&quot;
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(userReview.created_at), {
                    addSuffix: true,
                    locale: pl,
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 3: Visual check on an existing call site**

The dev server (`obczajone-dev`) is already configured against this project directory via this project's preview tooling. Reload `/` (the homepage still calls the old `<RecentListings limit={50} />` at this point in the plan — that's fine, Task 3 rewrites it) and confirm the listing cards now render horizontally (photo on the left, square, details on the right) instead of the old vertical photo-on-top layout. Take a screenshot.

- [ ] **Step 4: Commit**

```bash
git add components/listing-card.tsx
git commit -m "Redesign ListingCard: horizontal layout, price-change badge, brand tokens"
```

---

### Task 3: Real pagination + price-change data for the homepage grid

**Files:**
- Modify: `components/recent-listings.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `computePriceChangePercent` from `@/lib/price-change` (Task 1); `ListingCard`'s new `priceChangePercent` prop (Task 2).
- Produces: `RecentListings({ pageSize = 9 }: { pageSize?: number })` — the `limit`/`showMoreButton` props are removed; `app/page.tsx` is updated to match.

- [ ] **Step 1: Replace `components/recent-listings.tsx`**

Replace the full contents:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { computePriceChangePercent } from '@/lib/price-change';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  url: string;
  image_url: string;
  average_rating?: number;
  review_count?: number;
  priceChangePercent?: number | null;
};

async function attachPriceChanges(listings: any[]): Promise<Listing[]> {
  if (listings.length === 0) return [];

  const ids = listings.map((l) => l.id);
  const { data: snapshotsData } = await supabase
    .from('listing_snapshots')
    .select('listing_id, price, scraped_at')
    .in('listing_id', ids)
    .order('scraped_at', { ascending: true });

  const earliestPriceByListing = new Map<string, number>();
  for (const snap of snapshotsData || []) {
    if (!earliestPriceByListing.has(snap.listing_id)) {
      earliestPriceByListing.set(snap.listing_id, snap.price);
    }
  }

  return listings.map((listing) => {
    const reviews = listing.reviews || [];
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : undefined;
    const earliestPrice = earliestPriceByListing.get(listing.id);

    return {
      ...listing,
      average_rating: avgRating,
      review_count: reviews.length,
      priceChangePercent: earliestPrice != null
        ? computePriceChangePercent(listing.current_price, earliestPrice)
        : null,
    };
  });
}

export function RecentListings({ pageSize = 9 }: { pageSize?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function fetchFirstPage() {
      setError(false);
      setLoading(true);
      const { data, error } = await supabase
        .from('listings')
        .select('*, reviews(rating)')
        .order('created_at', { ascending: false })
        .range(0, pageSize - 1);

      if (!error && data) {
        const withPriceChanges = await attachPriceChanges(data);
        setListings(withPriceChanges);
        setHasMore(data.length === pageSize);
        setPage(0);
      } else if (error) {
        console.error('Error fetching listings:', error);
        setError(true);
      }
      setLoading(false);
    }

    fetchFirstPage();
  }, [pageSize]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from('listings')
      .select('*, reviews(rating)')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      const withPriceChanges = await attachPriceChanges(data);
      setListings((prev) => [...prev, ...withPriceChanges]);
      setHasMore(data.length === pageSize);
      setPage(nextPage);
    } else if (error) {
      console.error('Error fetching more listings:', error);
    }
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="border-gray-200">
            <CardHeader>
              <div className="space-y-3">
                <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-dashed border-2 border-red-200">
        <CardHeader className="text-center py-12">
          <CardTitle className="text-2xl">Nie udało się wczytać ogłoszeń</CardTitle>
          <CardDescription className="text-base mt-2">
            Wystąpił błąd podczas pobierania danych. Spróbuj odświeżyć stronę.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (listings.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center py-12">
          <CardTitle className="text-2xl">Brak ogłoszeń</CardTitle>
          <CardDescription className="text-base mt-2">
            Dodaj pierwsze ogłoszenie używając formularza powyżej
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={loadMore}
            disabled={loadingMore}
            variant="outline"
            size="lg"
            className="flex items-center gap-2"
          >
            {loadingMore ? 'Ładowanie...' : 'Załaduj więcej'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update the homepage call site**

In `app/page.tsx`, replace:

```tsx
            <RecentListings limit={50} />
```

with:

```tsx
            <RecentListings />
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 4: Visual check**

Reload `/` in the dev preview. Confirm:
- The "Wszystkie sprawdzone ogłoszenia" section now shows 9 cards initially (not 50), each with the new horizontal layout from Task 2.
- Cards with more than one price snapshot show a price-change badge (green with a down arrow for a drop, red with an up arrow for an increase, or "Cena bez zmian" for no change).
- Clicking "Załaduj więcej" appends 9 more real listings (check the network tab or this project's preview network inspector — confirm a new `.range()` request fires, not a re-fetch of the same range).
- Once fewer than 9 rows come back from a fetch, the button disappears.

- [ ] **Step 5: Commit**

```bash
git add components/recent-listings.tsx app/page.tsx
git commit -m "Add real pagination and price-change data to the homepage listings grid"
```

---

### Task 4: Detail page token cleanup + price-change badge

**Files:**
- Modify: `app/listing/[id]/listing-client.tsx`

**Interfaces:**
- Consumes: `computePriceChangePercent` from `@/lib/price-change` (Task 1). Uses the `snapshots` state this component already fetches — no new query.

- [ ] **Step 1: Replace leftover blue/gray classes with brand tokens**

In `app/listing/[id]/listing-client.tsx`, there are 3 occurrences to fix. Replace:

```tsx
    <div className="min-h-screen bg-gray-50">
```

with (this exact string appears 3 times in the file — in the loading state, the not-found state, and the main render — replace all 3 occurrences):

```tsx
    <div className="min-h-screen bg-background">
```

Replace:

```tsx
                              selectedPhoto === idx
                                ? 'ring-2 ring-blue-500 opacity-100'
```

with:

```tsx
                              selectedPhoto === idx
                                ? 'ring-2 ring-primary opacity-100'
```

Replace:

```tsx
                      className="block border rounded-lg p-4 hover:border-blue-500 transition-colors"
```

with:

```tsx
                      className="block border rounded-lg p-4 hover:border-primary transition-colors"
```

- [ ] **Step 2: Add the price-change badge next to the current price**

Add the import at the top of the file, alongside the other imports:

```tsx
import { computePriceChangePercent } from '@/lib/price-change';
import { TrendingDown, TrendingUp } from 'lucide-react';
```

(Add `TrendingDown, TrendingUp` to the existing `lucide-react` import line — the file already has `import { ExternalLink, MapPin, Calendar, Heart } from 'lucide-react';`, so change that line to:)

```tsx
import { ExternalLink, MapPin, Calendar, Heart, TrendingDown, TrendingUp } from 'lucide-react';
```

Just above the `const latestSnapshot = snapshots[0];` line, add:

```tsx
  const earliestSnapshot = snapshots.length > 0
    ? [...snapshots].sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime())[0]
    : null;
  const priceChangePercent = earliestSnapshot
    ? computePriceChangePercent(listing.current_price, earliestSnapshot.price)
    : null;
```

Replace the current price display block:

```tsx
                  {listing.current_price > 0 && (
                    <div className="text-4xl font-bold text-gray-900 mb-4">
                      {listing.current_price.toLocaleString('pl-PL')} zł
                    </div>
                  )}
```

with:

```tsx
                  {listing.current_price > 0 && (
                    <div className="mb-4">
                      <div className="text-4xl font-bold text-gray-900">
                        {listing.current_price.toLocaleString('pl-PL')} zł
                      </div>
                      {priceChangePercent != null && priceChangePercent !== 0 && (
                        <div
                          className={`inline-flex items-center gap-1 text-sm font-semibold mt-1 ${
                            priceChangePercent < 0 ? 'text-verified' : 'text-destructive'
                          }`}
                        >
                          {priceChangePercent < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4" />
                          )}
                          {priceChangePercent < 0 ? '' : '+'}
                          {priceChangePercent.toFixed(0)}% od pierwszego wykrycia
                        </div>
                      )}
                      {priceChangePercent === 0 && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Cena bez zmian od pierwszego wykrycia
                        </div>
                      )}
                    </div>
                  )}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 4: Visual check**

Navigate to a real listing detail page in the dev preview (use one of the listing IDs visible in the homepage grid after Task 3 — click into a card). Confirm:
- Page background, thumbnail selection ring, and "podobne ogłoszenia" hover border all use navy (`primary`), not blue.
- If the listing has more than one price snapshot, the price-change badge appears under the price with the correct color/direction.
- If the listing has only one snapshot, no badge (and no "brak zmian" text either, since `earliestSnapshot` price equals current price is the only-one-snapshot case — that's the `=== 0` branch, which does show "Cena bez zmian od pierwszego wykrycia"; confirm this reads sensibly rather than confusingly for a listing with just one data point).

- [ ] **Step 5: Commit**

```bash
git add "app/listing/[id]/listing-client.tsx"
git commit -m "Clean up leftover blue classes and add price-change badge to listing detail page"
```

---

### Task 5: Full sweep, cross-surface check, and push

**Files:** none (verification only; fix anything found).

- [ ] **Step 1: Full type/lint check**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors beyond the pre-existing unrelated warnings already present before this plan.

- [ ] **Step 2: Check the other `ListingCard` call sites still work**

`components/recent-reviews.tsx` and `app/profile/page.tsx` were not modified by this plan, but they render the same `ListingCard`. In the dev preview:
- Reload `/` and confirm the "Zobacz co inni znaleźli" section (rendered by `RecentReviews`, untouched) still renders correctly with the new horizontal card layout and no console errors — it simply won't show a price-change badge (expected, per this plan's Global Constraints).
- If logged in (or if there's a way to view `/profile` in this environment), confirm the favorites/reviews cards there also render correctly with the new layout and no console errors.

- [ ] **Step 3: Screenshot the full set of changed surfaces**

Desktop and mobile viewports (this project's preview tooling supports `preview_resize`):
- `/` — hero through footer, paying attention to the listings grid and the "Załaduj więcej" button.
- A listing detail page — confirm the price-change badge and token colors.

- [ ] **Step 4: Fix anything the sweep finds**

If any leftover hardcoded blue class or a broken call site turns up, fix it following the same token-replacement pattern as Task 4, then re-run Step 1 and re-screenshot the affected page.

- [ ] **Step 5: Push**

```bash
git push origin feature/rebranding
```

Expected: push succeeds (fast-forward, this branch has been pushed after every task in this plan).

- [ ] **Step 6: Final report**

Summarize to the user: commits pushed (`git log --oneline -8`), which pages were verified, and confirm the price-change badge behavior was checked against at least one real listing with multiple snapshots and one with a single snapshot.
