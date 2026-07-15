# Seller Profiles and Branch Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `sellers` table (one row per dealer branch), auto-create/match seller rows from Otomoto scrapes, and ship a seller profile page plus a dealer-search map, per `docs/superpowers/specs/2026-07-15-seller-profiles-and-map-design.md`.

**Architecture:** `scrape-listing` (Deno edge function) gains seller extraction + a dedup/matching function that finds-or-creates a `sellers` row and links it via `listings.seller_id`. A pure `lib/seller-name.ts` module provides name normalization used by the frontend to group branches of the same network. A shared `components/leaflet-map.tsx` client component renders OpenStreetMap tiles + pins, reused by both the seller profile page (one pin) and a new `/komisy` search page (many pins).

**Tech Stack:** Adds `leaflet` + `@types/leaflet` (no API key, OSM tiles). Geocoding fallback via the public Nominatim API (no API key). No changes to the existing stack otherwise.

## Global Constraints

- Matching key priority: `external_seller_id` + `city` first, normalized `name` + `city` fallback. Never phone — Otomoto ships the phone number obfuscated server-side (confirmed via a real fetched listing), so it cannot be used.
- Only Otomoto listings where `ad.seller.type === 'PROFESSIONAL'` create/match a `sellers` row. Private-seller listings and all Otodom listings leave `listings.seller_id` null in this plan (Otodom seller extraction is out of scope — its `__NEXT_DATA__` owner/agency shape hasn't been inspected).
- `lat`/`lng` come from Otomoto's own `ad.seller.location.map.latitude/longitude` when present (confirmed present on a real dealer listing). Nominatim geocoding is only a fallback when Otomoto doesn't provide coordinates.
- Seller rating is derived — the average of `reviews.rating` across the seller's `listings`. No new rating field, no review-form changes.
- No dealer claim/verification flow, no manual pin-correction UI, no homepage/nav links to `/komisy` or seller profiles in this plan.
- This repo has no test runner (`package.json` has no `test` script, no jest/vitest anywhere). Verification is `npx tsc --noEmit` + `npx next lint` (both scoped to the Next.js app only — `supabase/functions` is excluded from `tsconfig.json` and has no local Deno CLI available, so the edge function task is verified by code review + deploying and testing against a real pasted listing, matching how this repo already ships edge function changes).
- `sellers` RLS: SELECT open to `anon, authenticated`; no INSERT/UPDATE policy — only the edge function's service-role client (which bypasses RLS) writes to it.

---

### Task 1: Database migration for `sellers`

**Files:**
- Create: `supabase/migrations/20260715120000_add_sellers_table.sql`

**Interfaces:**
- Produces: table `sellers(id, source, external_seller_id, name, phone, city, address, lat, lng, created_at)` and column `listings.seller_id` — consumed by Task 2 (edge function writes), Task 5 (seller page reads), Task 6 (listing page reads), Task 7 (map page reads).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260715120000_add_sellers_table.sql`:

```sql
/*
  # Add seller/branch profiles

  1. New tables
    - `sellers`
      - `id` (uuid, primary key)
      - `source` (text, 'otomoto' or 'otodom')
      - `external_seller_id` (text, nullable — dealer account id from the source site, e.g. Otomoto's ad.seller.id)
      - `name` (text)
      - `phone` (text, nullable — display only, not used for matching)
      - `city` (text)
      - `address` (text, nullable)
      - `lat` (double precision, nullable)
      - `lng` (double precision, nullable)
      - `created_at` (timestamptz)

  2. Changes to existing tables
    - `listings.seller_id` (uuid, nullable, references sellers) — set by the scraper when
      the listing belongs to a dealer with a matched/created seller row

  3. Security
    - Enable RLS on `sellers`
    - Anyone (anon + authenticated) can read sellers
    - No INSERT/UPDATE/DELETE policy for anon/authenticated — only the edge function's
      service-role client (which bypasses RLS) writes sellers, matching the
      "system writes, everyone reads" pattern already used for listing_snapshots
*/

CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('otomoto', 'otodom')),
  external_seller_id text,
  name text NOT NULL,
  phone text,
  city text NOT NULL DEFAULT '',
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read sellers"
  ON sellers FOR SELECT
  TO anon, authenticated
  USING (true);

-- Speeds up the matching lookups the scraper runs on every scrape
CREATE INDEX IF NOT EXISTS idx_sellers_external_id_city ON sellers (external_seller_id, city);
CREATE INDEX IF NOT EXISTS idx_sellers_name_city ON sellers (name, city);

ALTER TABLE listings ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES sellers(id);
CREATE INDEX IF NOT EXISTS idx_listings_seller_id ON listings (seller_id);
```

- [ ] **Step 2: Apply the migration**

This repo has no Supabase CLI installed/linked locally (confirmed: `which supabase` → not found, no `supabase/config.toml`). Apply it the same way prior migrations in this repo were applied: paste the SQL above into the Supabase Dashboard → SQL Editor for the obczajone.pl project, and run it.

Expected: no errors. Then run `select * from sellers limit 1;` in the SQL Editor — expect an empty result set (0 rows), not an error, confirming the table exists and RLS didn't block the dashboard's own query.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260715120000_add_sellers_table.sql
git commit -m "Add sellers table and listings.seller_id column"
```

---

### Task 2: Extend `scrape-listing` to extract, match, and geocode sellers

**Files:**
- Modify: `supabase/functions/scrape-listing/index.ts`

**Interfaces:**
- Consumes: `sellers` table from Task 1.
- Produces: `listings.seller_id` gets populated on scrape for Otomoto dealer listings — consumed by Task 5 and Task 6 (both query `listings.seller_id` / the `sellers` table).

- [ ] **Step 1: Add the seller type and extraction helper**

In `supabase/functions/scrape-listing/index.ts`, right after the `isAllowedUrl` function (before `async function scrapeOtomoto`), add:

```ts
type ScrapedSeller = {
  externalId: string;
  name: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
};

// Only dealers ("PROFESSIONAL") get a seller profile. Confirmed via a real
// fetched Otomoto listing that this field exists with this exact value for
// a dealer account; the private-individual value hasn't been observed yet —
// if private listings start creating seller rows, check the real value here.
function extractSeller(ad: any): ScrapedSeller | null {
  if (ad?.seller?.type !== 'PROFESSIONAL') return null;
  if (!ad.seller.id || !ad.seller.name) return null;

  const cityRaw = ad.seller.location?.city;
  const city = typeof cityRaw === 'string' ? cityRaw : cityRaw?.name || '';

  const mapCoords = ad.seller.location?.map;
  const lat = typeof mapCoords?.latitude === 'number' ? mapCoords.latitude : null;
  const lng = typeof mapCoords?.longitude === 'number' ? mapCoords.longitude : null;

  return {
    externalId: String(ad.seller.id),
    name: ad.seller.name,
    city,
    address: ad.seller.location?.address || '',
    lat,
    lng,
  };
}
```

- [ ] **Step 2: Wire seller extraction into `scrapeOtomoto`**

Replace:

```ts
    let title = '';
    let price = 0;
    let location = '';
    let photoUrl = '';

    // Szukaj danych w __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps;
        const ad = pageProps?.advert;

        if (ad) {
          title = ad.title || '';

          if (ad.price?.amount?.units) {
            price = parseInt(ad.price.amount.units);
          }

          if (ad.seller?.location?.city) {
```

with:

```ts
    let title = '';
    let price = 0;
    let location = '';
    let photoUrl = '';
    let seller: ScrapedSeller | null = null;

    // Szukaj danych w __NEXT_DATA__
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const pageProps = nextData?.props?.pageProps;
        const ad = pageProps?.advert;

        if (ad) {
          title = ad.title || '';

          if (ad.price?.amount?.units) {
            price = parseInt(ad.price.amount.units);
          }

          seller = extractSeller(ad);

          if (ad.seller?.location?.city) {
```

- [ ] **Step 3: Return `seller` from `scrapeOtomoto`**

Replace:

```ts
    return {
      title: title || 'Ogłoszenie Otomoto',
      price,
      location,
      photoUrl,
    };
  } catch (error) {
    console.error('Error scraping Otomoto:', error);
    return null;
  }
}
```

with:

```ts
    return {
      title: title || 'Ogłoszenie Otomoto',
      price,
      location,
      photoUrl,
      seller,
    };
  } catch (error) {
    console.error('Error scraping Otomoto:', error);
    return null;
  }
}
```

- [ ] **Step 4: Give `scrapeOtodom` the same return shape**

Replace:

```ts
    return {
      title: title || 'Ogłoszenie Otodom',
      price,
      location,
      photoUrl,
    };
  } catch (error) {
    console.error('Error scraping Otodom:', error);
    return null;
  }
}
```

with:

```ts
    return {
      title: title || 'Ogłoszenie Otodom',
      price,
      location,
      photoUrl,
      seller: null,
    };
  } catch (error) {
    console.error('Error scraping Otodom:', error);
    return null;
  }
}
```

- [ ] **Step 5: Add the matching/geocoding function**

Right after the `scrapeOtodom` function (before `Deno.serve`), add:

```ts
function normalizeSellerName(name: string, city: string): string {
  let normalized = name.trim().toLowerCase();
  const cityLower = city.trim().toLowerCase();
  if (cityLower && normalized.endsWith(cityLower)) {
    normalized = normalized.slice(0, normalized.length - cityLower.length).trim();
  }
  return normalized.replace(/\s+/g, ' ');
}

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!query) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'obczajone.pl seller geocoder (https://obczajone.pl)' },
    });
    const results = await response.json();
    if (Array.isArray(results) && results.length > 0) {
      return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding seller address:', error);
    return null;
  }
}

// Finds an existing sellers row for this (source, seller) pair, or creates one.
// Returns null only on an unexpected insert failure — callers must not treat
// null as "no seller" when `seller` was non-null going in.
async function resolveSellerId(
  supabase: ReturnType<typeof createClient>,
  source: 'otomoto' | 'otodom',
  seller: ScrapedSeller
): Promise<string | null> {
  const { data: byExternalId } = await supabase
    .from('sellers')
    .select('id')
    .eq('source', source)
    .eq('external_seller_id', seller.externalId)
    .eq('city', seller.city)
    .maybeSingle();

  if (byExternalId) return byExternalId.id;

  const normalizedName = normalizeSellerName(seller.name, seller.city);
  const { data: sameCitySellers } = await supabase
    .from('sellers')
    .select('id, name, city')
    .eq('source', source)
    .eq('city', seller.city);

  const nameMatch = sameCitySellers?.find(
    (candidate: { name: string; city: string }) =>
      normalizeSellerName(candidate.name, candidate.city) === normalizedName
  );

  if (nameMatch) return nameMatch.id;

  let lat = seller.lat;
  let lng = seller.lng;
  if (lat == null || lng == null) {
    const geocoded = await geocodeAddress(seller.address || seller.city);
    lat = geocoded?.lat ?? null;
    lng = geocoded?.lng ?? null;
  }

  const { data: newSeller, error: insertError } = await supabase
    .from('sellers')
    .insert({
      source,
      external_seller_id: seller.externalId,
      name: seller.name,
      city: seller.city,
      address: seller.address || null,
      lat,
      lng,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Error creating seller:', insertError);
    return null;
  }

  return newSeller?.id ?? null;
}
```

- [ ] **Step 6: Resolve and store `seller_id` in the request handler**

Replace:

```ts
    if (!scrapedData) {
      throw new Error('Failed to scrape listing');
    }

    await supabase
      .from('listings')
      .update({
        title: scrapedData.title,
        location: scrapedData.location,
        current_price: scrapedData.price,
        image_url: scrapedData.photoUrl || '',
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', listingId);
```

with:

```ts
    if (!scrapedData) {
      throw new Error('Failed to scrape listing');
    }

    let sellerId: string | null = null;
    if (scrapedData.seller) {
      sellerId = await resolveSellerId(supabase, listing.source, scrapedData.seller);
    }

    // Only set seller_id when this scrape resolved one — never null out a
    // previously-linked seller because a later re-scrape (e.g. the daily
    // cron re-check) transiently failed to extract seller data.
    const listingUpdate: Record<string, unknown> = {
      title: scrapedData.title,
      location: scrapedData.location,
      current_price: scrapedData.price,
      image_url: scrapedData.photoUrl || '',
      last_checked_at: new Date().toISOString(),
    };
    if (sellerId) {
      listingUpdate.seller_id = sellerId;
    }

    await supabase.from('listings').update(listingUpdate).eq('id', listingId);
```

- [ ] **Step 7: Review the diff**

Run: `git diff supabase/functions/scrape-listing/index.ts`
Expected: the changes above and nothing else — `scrapeOtodom`'s existing logic is untouched apart from the `seller: null` addition.

There is no local type-checker for this file (`supabase` is excluded from `tsconfig.json`, and Deno isn't installed locally) — read through the diff carefully for typos instead.

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/scrape-listing/index.ts
git commit -m "Extract, match, and geocode dealer sellers when scraping Otomoto listings"
```

- [ ] **Step 9: Deploy and verify against a real listing**

Deploy the updated function to the linked Supabase project (via the Supabase Dashboard's Edge Functions editor, pasting the new file contents, since there's no CLI linked locally).

On the live/staging site, paste the URL of a real Otomoto dealer listing (e.g. search https://www.otomoto.pl/osobowe for any listing with a "Firma" badge). Expected: a new row appears in `sellers` (check via Supabase Dashboard → Table Editor) with a non-empty `external_seller_id`, `name`, `city`, and (usually) non-null `lat`/`lng`; the pasted listing's row in `listings` has `seller_id` set to that row's id.

Paste a second listing from the same dealer (another listing on the same dealer's page). Expected: no second `sellers` row is created — the second listing's `seller_id` matches the first.

---

### Task 3: Seller name normalization and branch grouping

**Files:**
- Create: `lib/seller-name.ts`

**Interfaces:**
- Produces: `normalizeSellerName(name: string, city: string): string`, `findOtherBranches<T extends SellerBranch>(current: T, candidates: T[]): T[]`, `SellerBranch` type — consumed by Task 5 (`seller-client.tsx`).

- [ ] **Step 1: Write the module**

Create `lib/seller-name.ts`:

```ts
export function normalizeSellerName(name: string, city: string): string {
  let normalized = name.trim().toLowerCase();
  const cityLower = city.trim().toLowerCase();
  if (cityLower && normalized.endsWith(cityLower)) {
    normalized = normalized.slice(0, normalized.length - cityLower.length).trim();
  }
  return normalized.replace(/\s+/g, ' ');
}

export type SellerBranch = {
  id: string;
  name: string;
  city: string;
};

export function findOtherBranches<T extends SellerBranch>(current: T, candidates: T[]): T[] {
  const currentNormalized = normalizeSellerName(current.name, current.city);
  return candidates.filter(
    (candidate) =>
      candidate.id !== current.id &&
      candidate.city !== current.city &&
      normalizeSellerName(candidate.name, candidate.city) === currentNormalized
  );
}
```

This duplicates `normalizeSellerName` from the edge function (Task 2) rather than sharing a module — the edge function runs on Deno with its own import graph, separate from this Next.js app's `lib/`, and this repo has no existing pattern for sharing code across that boundary. Both copies are five lines; keep them in sync manually if the normalization rule ever changes.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/seller-name.ts
git commit -m "Add seller name normalization for branch grouping"
```

---

### Task 4: Shared Leaflet map component

**Files:**
- Create: `components/leaflet-map.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `LeafletMapView({ markers: MapMarker[], center: [number, number], zoom: number, heightClassName?: string })`, `MapMarker` type — consumed by Task 5 (seller profile mini-map) and Task 7 (`/komisy` search map).

- [ ] **Step 1: Add dependencies**

Run: `npm install leaflet && npm install --save-dev @types/leaflet`
Expected: `package.json` gains `"leaflet"` under `dependencies` and `"@types/leaflet"` under `devDependencies`.

- [ ] **Step 2: Write the component**

Create `components/leaflet-map.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMapInstance, LayerGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  popupHtml: string;
};

type LeafletMapViewProps = {
  markers: MapMarker[];
  center: [number, number];
  zoom: number;
  heightClassName?: string;
};

export function LeafletMapView({
  markers,
  center,
  zoom,
  heightClassName = 'h-64',
}: LeafletMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Create the map once on mount.
  useEffect(() => {
    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current).setView(center, zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      mapRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers whenever the list changes, without recreating the map.
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current) return;

    import('leaflet').then((L) => {
      const layer = markersLayerRef.current;
      if (!layer) return;
      layer.clearLayers();
      markers.forEach((marker) => {
        L.marker([marker.lat, marker.lng]).addTo(layer).bindPopup(marker.popupHtml);
      });
    });
  }, [markers, mapReady]);

  return <div ref={containerRef} className={`${heightClassName} w-full rounded-lg overflow-hidden`} />;
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/leaflet-map.tsx
git commit -m "Add shared Leaflet map component (OSM tiles, no API key)"
```

---

### Task 5: Seller profile page

**Files:**
- Create: `app/seller/[id]/page.tsx`
- Create: `app/seller/[id]/seller-client.tsx`

**Interfaces:**
- Consumes: `sellers`/`listings` tables (Task 1/2), `LeafletMapView`/`MapMarker` (Task 4), `findOtherBranches`/`SellerBranch` (Task 3), `ListingCard` (existing, `components/listing-card.tsx`).
- Produces: route `/seller/[id]` — consumed by Task 6's link.

- [ ] **Step 1: Write the metadata wrapper**

Create `app/seller/[id]/page.tsx`:

```tsx
import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SellerClient } from './seller-client';

type Props = {
  params: { id: string };
};

async function getSellerName(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: seller } = await supabase
    .from('sellers')
    .select('name, city')
    .eq('id', id)
    .maybeSingle();

  return seller;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seller = await getSellerName(params.id);

  if (!seller) {
    return {
      title: 'Sprzedawca nie znaleziony | obczajone.pl',
      description: 'Profil sprzedawcy nie istnieje w bazie danych obczajone.pl',
    };
  }

  return {
    title: `${seller.name} - ${seller.city} | obczajone.pl`,
    description: `Zobacz oferty i opinie o sprzedawcy ${seller.name} w ${seller.city} na obczajone.pl.`,
  };
}

export default function SellerPage({ params }: Props) {
  return <SellerClient sellerId={params.id} />;
}
```

- [ ] **Step 2: Write the client component**

Create `app/seller/[id]/seller-client.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ListingCard } from '@/components/listing-card';
import { LeafletMapView } from '@/components/leaflet-map';
import { findOtherBranches, type SellerBranch } from '@/lib/seller-name';
import { MapPin, Star } from 'lucide-react';

type Seller = {
  id: string;
  source: string;
  name: string;
  city: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

type SellerListing = {
  id: string;
  title: string | null;
  location: string;
  current_price: number;
  source: string;
  created_at: string;
  image_url: string | null;
};

export function SellerClient({ sellerId }: { sellerId: string }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [otherBranches, setOtherBranches] = useState<SellerBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: sellerData, error: sellerError } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (sellerError || !sellerData) {
        console.error('Error fetching seller:', sellerError);
        setLoading(false);
        return;
      }

      setSeller(sellerData);

      const { data: listingsData } = await supabase
        .from('listings')
        .select('id, title, location, current_price, source, created_at, image_url')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      setListings(listingsData || []);

      if (listingsData && listingsData.length > 0) {
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('rating')
          .in(
            'listing_id',
            listingsData.map((l) => l.id)
          )
          .eq('is_approved', true);

        if (reviewsData && reviewsData.length > 0) {
          setReviewCount(reviewsData.length);
          setAverageRating(
            reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length
          );
        }
      }

      const { data: sameNetworkCandidates } = await supabase
        .from('sellers')
        .select('id, name, city')
        .eq('source', sellerData.source)
        .neq('id', sellerId);

      if (sameNetworkCandidates) {
        setOtherBranches(findOtherBranches(sellerData, sameNetworkCandidates));
      }

      setLoading(false);
    }

    fetchData();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p>Sprzedawca nie został znaleziony.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{seller.name}</CardTitle>
            <CardDescription className="text-base space-y-2 mt-2">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {seller.address ? `${seller.address}, ${seller.city}` : seller.city}
              </div>
              {averageRating != null && (
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{averageRating.toFixed(1)}</span>
                  <span className="text-muted-foreground">({reviewCount} opinii)</span>
                </div>
              )}
            </CardDescription>
          </CardHeader>
          {seller.lat != null && seller.lng != null && (
            <CardContent>
              <LeafletMapView
                markers={[
                  {
                    id: seller.id,
                    lat: seller.lat,
                    lng: seller.lng,
                    popupHtml: seller.name,
                  },
                ]}
                center={[seller.lat, seller.lng]}
                zoom={14}
              />
            </CardContent>
          )}
        </Card>

        {otherBranches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Inne oddziały tej sieci</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {otherBranches.map((branch) => (
                <Link
                  key={branch.id}
                  href={`/seller/${branch.id}`}
                  className="text-primary hover:underline"
                >
                  {branch.name} — {branch.city}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Auta tego sprzedawcy ({listings.length})</h2>
          {listings.length === 0 ? (
            <p className="text-muted-foreground">Brak ogłoszeń.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <ListingCard key={listing.id} {...listing} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add app/seller
git commit -m "Add seller profile page with map, rating, listings, and branch links"
```

- [ ] **Step 5: Visual check**

Start the dev server (`npm run dev`), navigate to `/seller/<id>` for a seller row created in Task 2's verification. Confirm: name, address/city, map pin (if `lat`/`lng` set) render, the seller's cars show in the grid, and — if you created two branches sharing a name in different cities during earlier testing — the "Inne oddziały tej sieci" section links between them.

---

### Task 6: Link to the seller profile from the listing detail page

**Files:**
- Modify: `app/listing/[id]/listing-client.tsx`

- [ ] **Step 1: Add imports**

Replace:

```tsx
import { useEffect, useState } from 'react';
import { Header } from '@/components/header';
```

with:

```tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
```

Replace:

```tsx
import { ExternalLink, MapPin, Calendar, Heart, TrendingDown, TrendingUp, Share2 } from 'lucide-react';
```

with:

```tsx
import { ExternalLink, MapPin, Calendar, Heart, TrendingDown, TrendingUp, Share2, Store } from 'lucide-react';
```

- [ ] **Step 2: Add `seller` to the `Listing` type**

Replace:

```tsx
type Listing = {
  id: string;
  listing_id: string;
  source: string;
  url: string;
  title: string;
  location: string;
  current_price: number;
  is_active: boolean;
  first_seen_at: string;
  last_checked_at: string;
  image_url: string | null;
  created_at: string;
};
```

with:

```tsx
type Listing = {
  id: string;
  listing_id: string;
  source: string;
  url: string;
  title: string;
  location: string;
  current_price: number;
  is_active: boolean;
  first_seen_at: string;
  last_checked_at: string;
  image_url: string | null;
  created_at: string;
  seller: { id: string; name: string; city: string } | null;
};
```

- [ ] **Step 3: Fetch the embedded seller relation**

Replace:

```tsx
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single();
```

with:

```tsx
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*, seller:sellers(id, name, city)')
        .eq('id', listingId)
        .single();
```

- [ ] **Step 4: Render the link next to the location**

Replace:

```tsx
                    {listing.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {listing.location}
                      </div>
                    )}
```

with:

```tsx
                    {listing.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {listing.location}
                      </div>
                    )}
                    {listing.seller && (
                      <div className="flex items-center gap-1">
                        <Store className="h-4 w-4" />
                        <Link
                          href={`/seller/${listing.seller.id}`}
                          className="text-primary hover:underline"
                        >
                          {listing.seller.name} ({listing.seller.city})
                        </Link>
                      </div>
                    )}
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/listing/\[id\]/listing-client.tsx
git commit -m "Link to the seller profile from the listing detail page"
```

- [ ] **Step 7: Visual check**

Navigate to a listing whose `seller_id` was set during Task 2's verification. Confirm the "Store" row with the dealer's name and city appears under the location, and clicking it navigates to `/seller/<id>`.

---

### Task 7: Dealer search map (`/komisy`)

**Files:**
- Create: `app/komisy/page.tsx`

**Interfaces:**
- Consumes: `sellers` table (Task 1/2), `LeafletMapView`/`MapMarker` (Task 4).

- [ ] **Step 1: Write the page**

Create `app/komisy/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { LeafletMapView, type MapMarker } from '@/components/leaflet-map';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const POLAND_CENTER: [number, number] = [52.0, 19.0];
const MIN_RATING_OPTIONS = [0, 3, 4, 4.5];

type SellerWithRating = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  averageRating: number | null;
  reviewCount: number;
};

export default function KomisyPage() {
  const [sellers, setSellers] = useState<SellerWithRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [minRating, setMinRating] = useState(0);

  useEffect(() => {
    async function fetchSellers() {
      const { data: sellersData } = await supabase
        .from('sellers')
        .select('id, name, city, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (!sellersData || sellersData.length === 0) {
        setLoading(false);
        return;
      }

      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('rating, listing:listings!inner(seller_id)')
        .eq('is_approved', true)
        .in(
          'listing.seller_id',
          sellersData.map((s) => s.id)
        );

      const ratingsBySeller = new Map<string, number[]>();
      (reviewsData || []).forEach((review: any) => {
        const sellerId = review.listing?.seller_id;
        if (!sellerId) return;
        const existing = ratingsBySeller.get(sellerId) || [];
        existing.push(review.rating);
        ratingsBySeller.set(sellerId, existing);
      });

      setSellers(
        sellersData.map((s) => {
          const ratings = ratingsBySeller.get(s.id) || [];
          return {
            ...s,
            averageRating:
              ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
            reviewCount: ratings.length,
          };
        })
      );
      setLoading(false);
    }

    fetchSellers();
  }, []);

  const filteredSellers = sellers.filter((s) => {
    const matchesCity = cityFilter
      ? s.city.toLowerCase().includes(cityFilter.toLowerCase())
      : true;
    const matchesRating = minRating > 0 ? (s.averageRating ?? 0) >= minRating : true;
    return matchesCity && matchesRating;
  });

  const markers: MapMarker[] = filteredSellers.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    popupHtml: `<a href="/seller/${s.id}">${s.name}</a><br/>${s.city}${
      s.averageRating != null ? `<br/>⭐ ${s.averageRating.toFixed(1)} (${s.reviewCount})` : ''
    }`,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-semibold">Komisy na mapie</h1>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Filtruj po mieście"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="max-w-xs"
          />
          <Select value={String(minRating)} onValueChange={(v) => setMinRating(Number(v))}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Minimalna ocena" />
            </SelectTrigger>
            <SelectContent>
              {MIN_RATING_OPTIONS.map((rating) => (
                <SelectItem key={rating} value={String(rating)}>
                  {rating === 0 ? 'Dowolna ocena' : `${rating}+`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : filteredSellers.length === 0 ? (
          <p className="text-muted-foreground">Brak komisów spełniających kryteria.</p>
        ) : (
          <LeafletMapView markers={markers} center={POLAND_CENTER} zoom={6} heightClassName="h-[600px]" />
        )}

        <p className="text-sm text-muted-foreground">
          {filteredSellers.length} komis(ów) na mapie. Zobacz też{' '}
          <Link href="/" className="text-primary hover:underline">
            stronę główną
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no errors (`Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` and `Input` are confirmed exports of `components/ui/select.tsx` and `components/ui/input.tsx`).

- [ ] **Step 3: Commit**

```bash
git add app/komisy
git commit -m "Add dealer search map at /komisy"
```

- [ ] **Step 4: Visual check**

Navigate to `/komisy`. Confirm: sellers with coordinates appear as pins, the city filter narrows the list live, the rating filter hides sellers below the threshold, and clicking a pin's popup link navigates to that seller's profile.

---

### Task 8: Full verification sweep and push

- [ ] **Step 1: Type-check and lint the whole app**

Run: `npx tsc --noEmit && npx next lint`
Expected: no errors.

- [ ] **Step 2: End-to-end walkthrough with a real dealer listing**

Paste a real Otomoto dealer listing URL (different from the ones used in Task 2/5/6 testing, to catch anything environment-specific). Confirm, in order: the listing page shows the "Store" link to the seller; the seller profile page loads with a map pin, name, city, and (if reviews exist on any of that dealer's cars) an aggregate rating; `/komisy` shows that dealer as a pin and the city/rating filters work against it.

- [ ] **Step 3: Private-seller regression check**

Paste a private (non-dealer) Otomoto listing. Confirm: no "Store" link appears on its listing page, and no new row was created in `sellers` for it (check Table Editor).

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 5: Final report**

Confirm to the user: migration applied (Task 1, Step 2 must have been done manually in the Supabase Dashboard — remind them if unsure), edge function deployed (Task 2, Step 9 — remind them if unsure), seller profiles and `/komisy` map live, commits pushed.
