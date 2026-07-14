# Homepage Discovery Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Największe obniżki" and "Ostatnio sprawdzane" sections to the homepage, per `docs/superpowers/specs/2026-07-14-homepage-discovery-sections.md`.

**Architecture:** Two new self-contained client components, each fetching its own data and rendering up to 3 `ListingCard`s (or nothing, if there's no qualifying data) — same pattern already used by `components/recent-listings.tsx`. Both render `null` while loading or empty, so there's no skeleton/placeholder flash for what are meant to be "highlight" sections, not primary content.

**Tech Stack:** No new dependencies. Reuses `lib/price-change.ts` and `components/listing-card.tsx`.

## Global Constraints

- No new database schema, columns, or scraper changes.
- No pagination on either section — fixed at 3 items.
- "Największe obniżki" pool is capped at the 100 most recently-checked active listings (not the whole catalog).

---

### Task 1: "Największe obniżki" component

**Files:**
- Create: `components/biggest-price-drops.tsx`

- [ ] **Step 1: Write the component**

Create `components/biggest-price-drops.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ListingCard } from '@/components/listing-card';
import { computePriceChangePercent } from '@/lib/price-change';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string;
  priceChangePercent: number;
};

export function BiggestPriceDrops() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDrops() {
      const { data: pool, error } = await supabase
        .from('listings')
        .select('id, title, location, current_price, source, created_at, image_url')
        .eq('is_active', true)
        .order('last_checked_at', { ascending: false })
        .limit(100);

      if (error || !pool || pool.length === 0) {
        setLoading(false);
        return;
      }

      const ids = pool.map((l) => l.id);
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

      const withDrops = pool
        .map((listing) => {
          const earliestPrice = earliestPriceByListing.get(listing.id);
          const percent =
            earliestPrice != null
              ? computePriceChangePercent(listing.current_price, earliestPrice)
              : null;
          return { ...listing, priceChangePercent: percent };
        })
        .filter(
          (l): l is Listing => l.priceChangePercent != null && l.priceChangePercent < 0
        )
        .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
        .slice(0, 3);

      setListings(withDrops);
      setLoading(false);
    }

    fetchDrops();
  }, []);

  if (loading || listings.length === 0) return null;

  return (
    <section aria-labelledby="najwieksze-obnizki">
      <h2
        id="najwieksze-obnizki"
        className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left"
      >
        Największe obniżki
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/biggest-price-drops.tsx
git commit -m "Add BiggestPriceDrops homepage section"
```

---

### Task 2: "Ostatnio sprawdzane" component

**Files:**
- Create: `components/recently-checked.tsx`

- [ ] **Step 1: Write the component**

Create `components/recently-checked.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ListingCard } from '@/components/listing-card';

type Listing = {
  id: string;
  title: string;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string;
};

export function RecentlyChecked() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentlyChecked() {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, location, current_price, source, created_at, image_url')
        .eq('is_active', true)
        .order('last_checked_at', { ascending: false })
        .limit(3);

      if (!error && data) {
        setListings(data);
      }
      setLoading(false);
    }

    fetchRecentlyChecked();
  }, []);

  if (loading || listings.length === 0) return null;

  return (
    <section aria-labelledby="ostatnio-sprawdzane">
      <h2
        id="ostatnio-sprawdzane"
        className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left"
      >
        Ostatnio sprawdzane
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/recently-checked.tsx
git commit -m "Add RecentlyChecked homepage section"
```

---

### Task 3: Wire both sections into the homepage

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Import both components**

Replace:

```tsx
import { HowItWorks } from '@/components/home/how-it-works';
import { WhyUs } from '@/components/home/why-us';
```

with:

```tsx
import { HowItWorks } from '@/components/home/how-it-works';
import { WhyUs } from '@/components/home/why-us';
import { BiggestPriceDrops } from '@/components/biggest-price-drops';
import { RecentlyChecked } from '@/components/recently-checked';
```

- [ ] **Step 2: Render them between WhyUs and the full listings grid**

Replace:

```tsx
          <HowItWorks />
          <WhyUs />

          <div className="mt-8">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left flex items-center gap-2">
                <Search className="h-6 w-6 text-primary" />
                Wszystkie sprawdzone ogłoszenia
              </h2>
            </div>
            <RecentListings />
          </div>
```

with:

```tsx
          <HowItWorks />
          <WhyUs />

          <div className="mt-8">
            <BiggestPriceDrops />
          </div>

          <div className="mt-8">
            <RecentlyChecked />
          </div>

          <div className="mt-8">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left flex items-center gap-2">
                <Search className="h-6 w-6 text-primary" />
                Wszystkie sprawdzone ogłoszenia
              </h2>
            </div>
            <RecentListings />
          </div>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "Add biggest-drops and recently-checked sections to homepage"
```

---

### Task 4: Verification and push

- [ ] **Step 1: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 2: Visual check at 1280px**

Using this project's preview tooling: reload the homepage, resize to `1280x900`, screenshot. Confirm "Największe obniżki" and "Ostatnio sprawdzane" render between "Dlaczego warto" and "Wszystkie sprawdzone ogłoszenia", each with up to 3 `ListingCard`s, and that the drops section's cards show a visible negative price-change badge.

- [ ] **Step 3: Visual check at 375px**

Resize to `375x812`, screenshot. Confirm both sections stack to a single column without overflow.

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 5: Final report**

Confirm to the user: both sections live on the homepage, screenshots at 1280px and 375px, commits pushed.
