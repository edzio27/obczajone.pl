# Profile Watchlist Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-tile "cena spadła / zdjęte z rynku" summary above the tabs on `/profile`, computed from the user's favorites, per `docs/superpowers/specs/2026-07-14-profile-dashboard-digest.md`.

**Architecture:** `app/profile/page.tsx` already fetches and processes a `favorites: Listing[]` array with a `price_change` field. This plan adds the missing `is_active` column to that same query/type/mapping, then renders two derived counts above the existing `<Tabs>` block — no new files, no new state beyond what's computed inline at render time from the existing `favorites` state.

**Tech Stack:** No new dependencies.

## Global Constraints

- Favorites only — no digest for "Moje Ogłoszenia" or "Moje Komentarze".
- Exactly two metrics: price-dropped count, inactive/removed count. No third metric.
- Hide the whole strip when `favorites.length === 0`; show counts (including 0) otherwise.

---

### Task 1: Add `is_active` to the favorites data

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Add `is_active` to the `Listing` type**

Replace:

```tsx
type Listing = {
  id: string;
  url: string;
  title: string | null;
  location: string;
  source: string;
  created_at: string;
  current_price: number;
  latest_price: number | null;
  price_change: number | null;
  has_reviews: boolean;
  review_count: number;
  image_url: string | null;
  average_rating?: number;
};
```

with:

```tsx
type Listing = {
  id: string;
  url: string;
  title: string | null;
  location: string;
  source: string;
  created_at: string;
  current_price: number;
  latest_price: number | null;
  price_change: number | null;
  has_reviews: boolean;
  review_count: number;
  image_url: string | null;
  average_rating?: number;
  is_active: boolean;
};
```

- [ ] **Step 2: Select `is_active` in the favorites query**

Replace:

```tsx
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('favorites')
        .select(`
          listing_id,
          created_at,
          listings (
            id,
            url,
            title,
            location,
            source,
            created_at,
            current_price,
            image_url,
            listing_snapshots (
              price,
              scraped_at
            ),
            reviews (
              id,
              rating
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
```

with:

```tsx
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('favorites')
        .select(`
          listing_id,
          created_at,
          listings (
            id,
            url,
            title,
            location,
            source,
            created_at,
            current_price,
            image_url,
            is_active,
            listing_snapshots (
              price,
              scraped_at
            ),
            reviews (
              id,
              rating
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
```

- [ ] **Step 3: Carry `is_active` through into `processedFavorites`**

Replace:

```tsx
          return {
            id: listing.id,
            url: listing.url,
            title: listing.title,
            location: listing.location || '',
            source: listing.source,
            created_at: listing.created_at,
            current_price: listing.current_price || latestPrice || 0,
            latest_price: latestPrice,
            price_change: priceChange,
            has_reviews: reviews.length > 0,
            review_count: reviews.length,
            image_url: listing.image_url,
            average_rating: avgRating,
          };
        });

      setFavorites(processedFavorites);
```

with:

```tsx
          return {
            id: listing.id,
            url: listing.url,
            title: listing.title,
            location: listing.location || '',
            source: listing.source,
            created_at: listing.created_at,
            current_price: listing.current_price || latestPrice || 0,
            latest_price: latestPrice,
            price_change: priceChange,
            has_reviews: reviews.length > 0,
            review_count: reviews.length,
            image_url: listing.image_url,
            average_rating: avgRating,
            is_active: listing.is_active,
          };
        });

      setFavorites(processedFavorites);
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/profile/page.tsx
git commit -m "Fetch is_active for favorited listings"
```

---

### Task 2: Render the digest strip

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Add an icon import**

Replace:

```tsx
import { MessageSquare, TrendingDown, TrendingUp, Minus, Loader as Loader2, Chrome as Home } from 'lucide-react';
```

with:

```tsx
import { MessageSquare, TrendingDown, TrendingUp, Minus, Loader as Loader2, Chrome as Home, XCircle } from 'lucide-react';
```

- [ ] **Step 2: Compute the two counts and render the strip above the tabs**

Replace:

```tsx
      <Tabs defaultValue="listings" className="space-y-6">
```

with:

```tsx
      {favorites.length > 0 && (() => {
        const droppedCount = favorites.filter(
          (f) => f.price_change !== null && f.price_change < 0
        ).length;
        const removedCount = favorites.filter((f) => !f.is_active).length;

        return (
          <div className="grid grid-cols-2 gap-4 mb-8 max-w-xl">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-success flex-shrink-0" />
              <div>
                <div className="text-2xl font-bold text-foreground">{droppedCount}</div>
                <div className="text-sm text-muted-foreground">
                  {droppedCount === 1 ? 'auto staniało' : 'auta staniały'}
                </div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <XCircle className="h-8 w-8 text-destructive flex-shrink-0" />
              <div>
                <div className="text-2xl font-bold text-foreground">{removedCount}</div>
                <div className="text-sm text-muted-foreground">
                  {removedCount === 1 ? 'zostało zdjęte z rynku' : 'zostało zdjętych z rynku'}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <Tabs defaultValue="listings" className="space-y-6">
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "Show price-drop/removed digest above profile tabs"
```

---

### Task 3: Verification and push

- [ ] **Step 1: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 2: Visual check**

This page requires an authenticated session. Using this project's preview tooling: log in with a test account (or use an already-authenticated session if available in the preview browser), navigate to `/profile`, confirm:
- If the account has favorites: the two-tile strip appears above the tabs with correct counts (cross-check against the "Polubione" tab's actual listing data).
- If the account has zero favorites: no strip is rendered at all (not even showing "0 / 0").

If no authenticated test session is available in the preview environment, inspect the rendered DOM/state via the browser tooling instead of skipping verification, and note in the final report that full interactive login wasn't exercised.

- [ ] **Step 3: Push**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 4: Final report**

Confirm to the user: digest strip live on `/profile`, verified counts logic, commits pushed.
