# Listings Title Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a debounced title search box to `components/recent-listings.tsx`, per `docs/superpowers/specs/2026-07-14-listings-title-search.md`.

**Architecture:** Single-file change. Two new pieces of state — `searchQuery` (bound to the input, updates every keystroke) and `debouncedQuery` (updates 400ms after typing stops, via a `useEffect` + `setTimeout`). The existing fetch effect keys off `debouncedQuery` instead of running once, adding a conditional `.ilike('title', ...)` clause. The search input itself is always rendered (even during loading/error/empty states) so the user can clear or adjust it.

**Tech Stack:** No new dependencies.

## Global Constraints

- Title search only — no source or price-range filters.
- No URL query-param syncing.
- Search input always visible, independent of loading/error/empty state below it.

---

### Task 1: Add debounced search state and wire it into both fetch queries

**Files:**
- Modify: `components/recent-listings.tsx`

- [ ] **Step 1: Add search state**

Replace:

```tsx
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
        .gt('current_price', 0)
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
      .gt('current_price', 0)
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
```

with:

```tsx
export function RecentListings({ pageSize = 9 }: { pageSize?: number }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    async function fetchFirstPage() {
      setError(false);
      setLoading(true);
      let query = supabase
        .from('listings')
        .select('*, reviews(rating)')
        .gt('current_price', 0);

      if (debouncedQuery) {
        query = query.ilike('title', `%${debouncedQuery}%`);
      }

      const { data, error } = await query
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
  }, [pageSize, debouncedQuery]);

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('listings')
      .select('*, reviews(rating)')
      .gt('current_price', 0);

    if (debouncedQuery) {
      query = query.ilike('title', `%${debouncedQuery}%`);
    }

    const { data, error } = await query
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
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/recent-listings.tsx
git commit -m "Add debounced title search state to RecentListings"
```

---

### Task 2: Render the search input and adapt the empty state

**Files:**
- Modify: `components/recent-listings.tsx`

- [ ] **Step 1: Add the `Search` icon import**

Replace:

```tsx
import { ChevronRight } from 'lucide-react';
```

with:

```tsx
import { ChevronRight, Search } from 'lucide-react';
```

Also add the `Input` import:

Replace:

```tsx
import { Button } from '@/components/ui/button';
```

with:

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
```

- [ ] **Step 2: Restructure the return to always show the search box, wrapping the existing conditional states**

Replace the entire block from the `if (loading)` check through the end of the function:

```tsx
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

with:

```tsx
  const searchBox = (
    <div className="relative mb-6 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Szukaj po tytule..."
        className="pl-9"
      />
    </div>
  );

  if (loading) {
    return (
      <div>
        {searchBox}
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
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {searchBox}
        <Card className="border-dashed border-2 border-red-200">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-2xl">Nie udało się wczytać ogłoszeń</CardTitle>
            <CardDescription className="text-base mt-2">
              Wystąpił błąd podczas pobierania danych. Spróbuj odświeżyć stronę.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div>
        {searchBox}
        <Card className="border-dashed border-2">
          <CardHeader className="text-center py-12">
            <CardTitle className="text-2xl">Brak ogłoszeń</CardTitle>
            <CardDescription className="text-base mt-2">
              {debouncedQuery
                ? `Brak ogłoszeń pasujących do „${debouncedQuery}"`
                : 'Dodaj pierwsze ogłoszenie używając formularza powyżej'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div>
      {searchBox}
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

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/recent-listings.tsx
git commit -m "Render always-visible title search box in RecentListings"
```

---

### Task 3: Verification and push

- [ ] **Step 1: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 2: Visual check — search narrows results**

Using this project's preview tooling: reload the homepage, scroll to "Wszystkie sprawdzone ogłoszenia", type a keyword known to match some listings already seen this session (e.g. a brand name). Confirm the grid narrows to matching titles after ~400ms, and pagination resets (the "Załaduj więcej" button's presence reflects the filtered count).

- [ ] **Step 3: Visual check — no matches and clearing**

Type a nonsense string with zero matches, confirm the "Brak ogłoszeń pasujących do ..." empty state appears (search box still visible/editable). Clear the input and confirm the full list returns.

- [ ] **Step 4: Push**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 5: Final report**

Confirm to the user: title search live on "Wszystkie sprawdzone ogłoszenia", screenshots showing filtered vs unfiltered state, commit pushed. Note this was the last item from today's punch list.
