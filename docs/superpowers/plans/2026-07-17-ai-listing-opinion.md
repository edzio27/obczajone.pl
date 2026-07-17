# AI Listing Opinion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate an AI-authored "first opinion" (1–5 rating, price note, watch-out-for suggestions) for every new listing at scrape time, and display it as a clearly-badged card at the top of the listing's reviews list.

**Architecture:** Extend the `scrape-listing` Supabase Edge Function to also extract `description` and structured `specs` from Otomoto/Otodom, call the Anthropic API once with that data to get a structured opinion, and store the result on new `listings` columns. `ReviewList` renders that data as a pinned card when present; nothing changes for listings where it's absent (old listings, or generation failures).

**Tech Stack:** Supabase Postgres migrations, Deno Edge Functions (TypeScript), `@anthropic-ai/sdk` (via `npm:` specifier), React/Next.js (`components/review-list.tsx`, `app/listing/[id]/listing-client.tsx`).

## Global Constraints

- No automated test framework exists in this repo (no Jest/Vitest, no `test` script) — verification in every task is manual (code review, `npx tsc --noEmit`, and where noted, running a small standalone script) rather than an automated test suite. This matches the precedent set by the trust-score feature.
- AI opinion generation happens exactly once, synchronously, inside `scrape-listing`'s existing request handling — never in `daily-price-scraper`, never on-demand, never batched.
- Only new listings going forward get an AI opinion. No backfill of existing rows.
- Model: `claude-haiku-4-5` (explicitly chosen by the site owner for cost, per the design spec — do not substitute a different model).
- The AI's "watch out for" content must always be phrased as hedged questions/suggestions, never as definitive negative claims about the listing or seller — this is enforced via the system/user prompt in Task 4, not left to chance.
- Full end-to-end functional verification (does the real Anthropic call work, does the real Otomoto/Otodom JSON actually have the fields this code expects) requires deploying to Supabase and submitting a real listing URL — this plan cannot execute that step locally (no `deno`, no `supabase` CLI available in this environment), so each task's verification is scoped to what's checkable statically, and the final manual E2E check is called out explicitly as a deployment-time step.

---

### Task 1: Database migration for AI opinion + specs columns

**Files:**
- Create: `supabase/migrations/20260717130000_add_ai_listing_opinion.sql`

**Interfaces:**
- Produces: `listings.description` (text), `listings.specs` (jsonb), `listings.ai_opinion_rating` (smallint, 1–5 or null), `listings.ai_opinion_summary` (text), `listings.ai_opinion_price_note` (text), `listings.ai_opinion_watch_out` (text[]), `listings.ai_opinion_model` (text), `listings.ai_opinion_generated_at` (timestamptz) — all consumed by Task 4 (writer) and Task 6 (reader).

- [ ] **Step 1: Write the migration file**

```sql
-- Full listing description and structured specs, used as AI-opinion input.
-- Not currently captured anywhere (listing_snapshots.description is always '').
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS specs jsonb DEFAULT '{}';

-- AI-generated first opinion. Populated once at scrape time for new
-- listings only; null for every listing scraped before this migration,
-- and for any listing where AI generation failed.
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_rating smallint;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_summary text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_price_note text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_watch_out text[];
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_model text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS ai_opinion_generated_at timestamptz;

ALTER TABLE listings ADD CONSTRAINT ai_opinion_rating_range
  CHECK (ai_opinion_rating IS NULL OR (ai_opinion_rating >= 1 AND ai_opinion_rating <= 5));
```

- [ ] **Step 2: Review against the existing schema**

Read `supabase/migrations/20260322073221_create_obczajone_schema.sql` (the `listings` table definition, lines 66–91) side by side with the new file and confirm: no column name collides with an existing one, and the `ADD COLUMN IF NOT EXISTS` style matches this repo's established migration pattern (e.g. `supabase/migrations/20260329162612_add_photos_to_reviews.sql`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260717130000_add_ai_listing_opinion.sql
git commit -m "Add AI listing opinion and specs columns to listings"
```

**Note:** This migration cannot be applied locally in this environment (no `supabase` CLI available). It will run against the real database the next time migrations are deployed (`supabase db push` or the project's normal migration deploy step) — confirm with whoever runs deploys that this migration is included before Task 4's code goes live, since Task 4 writes to these columns.

---

### Task 2: Extend Otomoto scraping with description and specs

**Files:**
- Modify: `supabase/functions/scrape-listing/index.ts:82-183` (`scrapeOtomoto`)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `scrapeOtomoto()`'s return type gains two fields — `description: string` and `specs: { brand: string | null; model: string | null; year: string | null; mileage: string | null; fuel_type: string | null }` — consumed by Task 4 (AI prompt input) and Task 5 (writing `listings.description` / `listings.specs`).

- [ ] **Step 1: Confirm the real field names against a live listing**

Before writing extraction code, fetch one real, currently-active Otomoto listing URL (same way the existing code does, `curl` with the same `User-Agent` header used at `index.ts:85-87`) and inspect its `__NEXT_DATA__` JSON (`grep -o '<script id="__NEXT_DATA__"[^>]*>.*</script>'` then pretty-print with `python3 -m json.tool` or `jq`). Locate:
- Where the full description text lives (expected: `ad.description`, likely HTML).
- Where car parameters live (expected: an array under `ad.parameters` or `ad.details`, with entries shaped like `{key, value}` or `{key, name, value}` — confirm the actual shape and the exact key strings used for brand, model, year, mileage, fuel type).

If the real shape differs from the code in Step 2 below, adjust the `keys` arrays passed to `extractOtomotoParam` (not the function itself) to match what you found. This mirrors the precedent already in this file — see the comment at `index.ts:57-60` documenting a similar field verified against a real fetched listing.

- [ ] **Step 2: Add the extraction helper and wire it into `scrapeOtomoto`**

Add this helper above `scrapeOtomoto` (after the `extractSeller` function, before line 82):

```typescript
type OtomotoSpecs = {
  brand: string | null;
  model: string | null;
  year: string | null;
  mileage: string | null;
  fuel_type: string | null;
};

// Car parameters can appear under either `ad.parameters` or `ad.details`
// depending on the Otomoto page variant — check both. Each entry may key
// off `key` or `name`; confirm the exact key strings against a real
// fetched listing (see Task 2, Step 1) and adjust the `keys` arrays below
// if they differ from what's observed.
function extractOtomotoParam(ad: any, keys: string[]): string | null {
  const params = ad?.parameters ?? ad?.details ?? [];
  if (!Array.isArray(params)) return null;
  for (const key of keys) {
    const found = params.find((p: any) => p?.key === key || p?.name === key);
    if (found) return found.value ?? found.displayValue ?? found.normalizedValue ?? null;
  }
  return null;
}

function extractOtomotoSpecs(ad: any): OtomotoSpecs {
  return {
    brand: extractOtomotoParam(ad, ['make', 'brand']),
    model: extractOtomotoParam(ad, ['model']),
    year: extractOtomotoParam(ad, ['year']),
    mileage: extractOtomotoParam(ad, ['mileage']),
    fuel_type: extractOtomotoParam(ad, ['fuel_type', 'fuel']),
  };
}
```

Inside `scrapeOtomoto`, add `description` and `specs` to the locals declared at `index.ts:91-95`:

```typescript
    let title = '';
    let price = 0;
    let location = '';
    let photoUrl = '';
    let seller: ScrapedSeller | null = null;
    let description = '';
    let specs: OtomotoSpecs = { brand: null, model: null, year: null, mileage: null, fuel_type: null };
```

Inside the `if (ad) { ... }` block (`index.ts:105-135`), after the existing `seller = extractSeller(ad);` line, add:

```typescript
          if (ad.description) {
            description = String(ad.description).replace(/<[^>]*>/g, '').trim();
          }
          specs = extractOtomotoSpecs(ad);
```

Finally, add both fields to the function's return statement (`index.ts:172-178`):

```typescript
    return {
      title: title || 'Ogłoszenie Otomoto',
      price,
      location,
      photoUrl,
      seller,
      description,
      specs,
    };
```

- [ ] **Step 3: Verify with `tsc`**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this change. (Pre-existing errors elsewhere, if any, are not this task's concern — confirm the error count/set is unchanged from before this edit.)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/scrape-listing/index.ts
git commit -m "Extract description and car specs when scraping Otomoto listings"
```

---

### Task 3: Extend Otodom scraping with description and specs

**Files:**
- Modify: `supabase/functions/scrape-listing/index.ts:185-260` (`scrapeOtodom`)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `scrapeOtodom()`'s return type gains `description: string` and `specs: { area: string | null; rooms: string | null; floor: string | null; build_year: string | null }` — same consumers as Task 2's output (Task 4, Task 5), just for the `otodom` source.

- [ ] **Step 1: Confirm the real field names against a live listing**

Same process as Task 2 Step 1, but against a real Otodom listing URL. Otodom's `__NEXT_DATA__` typically exposes a `target` object on the ad (used for analytics) with PascalCase-ish keys — confirm whether the real page uses `ad.target.Area` / `ad.target.Rooms_num` / `ad.target.Floor_no` / `ad.target.Build_year`, or instead exposes these under a `characteristics` array (seen elsewhere in this same file's JSON-LD fallback at `index.ts:229-247`). Adjust Step 2's field paths to match what you actually observe.

- [ ] **Step 2: Add the extraction helper and wire it into `scrapeOtodom`**

Add this helper above `scrapeOtodom` (after `extractOtomotoSpecs` from Task 2):

```typescript
type OtodomSpecs = {
  area: string | null;
  rooms: string | null;
  floor: string | null;
  build_year: string | null;
};

// Otodom exposes property parameters either on `ad.target` (PascalCase
// analytics fields) or in an `ad.characteristics` array — confirm which
// against a real fetched listing (see Task 3, Step 1) and adjust the
// field names below if they differ from what's observed.
function extractOtodomSpecs(ad: any): OtodomSpecs {
  const target = ad?.target ?? {};
  const characteristics = Array.isArray(ad?.characteristics) ? ad.characteristics : [];

  function fromCharacteristics(key: string): string | null {
    const found = characteristics.find((c: any) => c?.key === key);
    return found?.value ?? found?.localizedValue ?? null;
  }

  return {
    area: target.Area ?? fromCharacteristics('area') ?? null,
    rooms: target.Rooms_num ?? fromCharacteristics('rooms_num') ?? null,
    floor: target.Floor_no ?? fromCharacteristics('floor_no') ?? null,
    build_year: target.Build_year ?? fromCharacteristics('build_year') ?? null,
  };
}
```

Inside `scrapeOtodom`, add `description` and `specs` to the locals declared at `index.ts:194-197`:

```typescript
    let title = '';
    let price = 0;
    let location = '';
    let photoUrl = '';
    let description = '';
    let specs: OtodomSpecs = { area: null, rooms: null, floor: null, build_year: null };
```

Inside the `if (ad) { ... }` block (`index.ts:206-222`), after the existing photo-extraction lines, add:

```typescript
          if (ad.description) {
            description = String(ad.description).replace(/<[^>]*>/g, '').trim();
          }
          specs = extractOtodomSpecs(ad);
```

Finally, add both fields to the function's return statement (`index.ts:249-255`):

```typescript
    return {
      title: title || 'Ogłoszenie Otodom',
      price,
      location,
      photoUrl,
      seller: null,
      description,
      specs,
    };
```

- [ ] **Step 3: Verify with `tsc`**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this change.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/scrape-listing/index.ts
git commit -m "Extract description and property specs when scraping Otodom listings"
```

---

### Task 4: AI opinion generation and wiring into the scrape handler

**Files:**
- Modify: `supabase/functions/scrape-listing/index.ts` (add a new section after `extractOtomotoSpecs`/`extractOtodomSpecs`, before `Deno.serve`; modify the `Deno.serve` handler body)

**Interfaces:**
- Consumes: `scrapedData.description` and `scrapedData.specs` from Task 2/Task 3's return shape; `listing.source` (`'otomoto' | 'otodom'`, already available in the handler at `index.ts:400`).
- Produces: `generateAiOpinion(source, data): Promise<AiOpinion | null>` where `AiOpinion = { rating: number; summary: string; priceNote: string; watchOutFor: string[]; model: string }` — consumed by the `listings` update at the end of this same task (no other task reads this function directly).

- [ ] **Step 1: Add the prompt builder and the AI call**

Add this block above `Deno.serve` (after the extraction helpers from Tasks 2–3):

```typescript
type AiOpinion = {
  rating: number;
  summary: string;
  priceNote: string;
  watchOutFor: string[];
  model: string;
};

const AI_OPINION_MODEL = 'claude-haiku-4-5';

const AI_OPINION_SCHEMA = {
  type: 'object',
  properties: {
    rating: { type: 'integer' },
    summary: { type: 'string' },
    price_note: { type: 'string' },
    watch_out_for: { type: 'array', items: { type: 'string' } },
  },
  required: ['rating', 'summary', 'price_note', 'watch_out_for'],
  additionalProperties: false,
};

type AiOpinionInput = {
  title: string;
  price: number;
  location: string;
  description: string;
  specs: Record<string, unknown>;
};

function buildAiOpinionPrompt(source: 'otomoto' | 'otodom', data: AiOpinionInput): string {
  const specsLines = Object.entries(data.specs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');

  const kindLabel = source === 'otomoto' ? 'ogłoszenia samochodowego' : 'ogłoszenia nieruchomości';
  const sourceLabel = source === 'otomoto' ? 'Otomoto' : 'Otodom';

  return `Poniżej dane ${kindLabel} ze strony ${sourceLabel}:

Tytuł: ${data.title}
Cena: ${data.price} PLN
Lokalizacja: ${data.location}
Parametry:
${specsLines || '(brak dodatkowych parametrów)'}

Opis:
${data.description || '(brak opisu)'}

Napisz krótką, pierwszą opinię o tym ogłoszeniu po polsku, na podstawie wyłącznie powyższego opisu i parametrów (nie masz dostępu do zdjęć ani do innych ofert w bazie, więc oceniaj cenę w sposób przybliżony).

WAŻNE: nigdy nie formułuj stanowczych zarzutów wobec sprzedającego ani ogłoszenia. Punkty "na co zwrócić uwagę" pisz wyłącznie jako ostrożne pytania lub sugestie do zweryfikowania osobiście (np. "może warto dopytać o historię serwisową"), nigdy jako twierdzenia (np. nie pisz "przebieg wygląda podejrzanie").

Zwróć:
- rating: ocena 1-5 (liczba całkowita)
- summary: 2-3 zdania podsumowania
- price_note: jedno zdanie o cenie
- watch_out_for: lista 1-4 ostrożnych sugestii/pytań`;
}

async function generateAiOpinion(
  source: 'otomoto' | 'otodom',
  data: AiOpinionInput
): Promise<AiOpinion | null> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set; skipping AI opinion generation');
    return null;
  }

  try {
    const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@0.71.0');
    const client = new Anthropic({ apiKey });

    const response = await client.messages.parse({
      model: AI_OPINION_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildAiOpinionPrompt(source, data) }],
      output_config: { format: { type: 'json_schema', schema: AI_OPINION_SCHEMA } },
    });

    const parsed = response.parsed_output as {
      rating: number;
      summary: string;
      price_note: string;
      watch_out_for: string[];
    } | null;

    if (!parsed) {
      console.error('AI opinion response did not parse against the schema');
      return null;
    }

    return {
      rating: Math.min(5, Math.max(1, Math.round(parsed.rating))),
      summary: parsed.summary,
      priceNote: parsed.price_note,
      watchOutFor: parsed.watch_out_for,
      model: AI_OPINION_MODEL,
    };
  } catch (error) {
    console.error('Error generating AI opinion:', error);
    return null;
  }
}
```

- [ ] **Step 2: Wire it into the request handler**

In the `Deno.serve` handler, after the existing `listing_snapshots` insert (`index.ts:443-450`) and before the success `return new Response(...)` (`index.ts:452`), add:

```typescript
    await supabase.from('listings').update({
      description: scrapedData.description,
      specs: scrapedData.specs,
    }).eq('id', listingId);

    const aiOpinion = await generateAiOpinion(listing.source, {
      title: scrapedData.title,
      price: scrapedData.price,
      location: scrapedData.location,
      description: scrapedData.description,
      specs: scrapedData.specs,
    });

    if (aiOpinion) {
      await supabase.from('listings').update({
        ai_opinion_rating: aiOpinion.rating,
        ai_opinion_summary: aiOpinion.summary,
        ai_opinion_price_note: aiOpinion.priceNote,
        ai_opinion_watch_out: aiOpinion.watchOutFor,
        ai_opinion_model: aiOpinion.model,
        ai_opinion_generated_at: new Date().toISOString(),
      }).eq('id', listingId);
    }
```

This runs after `scrapedData` is already validated non-null (`index.ts:418-420`) and after `listing.source` is validated to be `'otomoto' | 'otodom'` (`index.ts:400-402`), so both are safe to use here without re-checking.

- [ ] **Step 3: Verify with `tsc`**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manually sanity-check the prompt builder's output**

`buildAiOpinionPrompt` is a pure function with no Deno-specific APIs, so it can be checked outside the edge function runtime. Create a throwaway script (do not commit it):

```bash
cat > /tmp/check-prompt.mjs << 'EOF'
function buildAiOpinionPrompt(source, data) {
  const specsLines = Object.entries(data.specs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n');
  const kindLabel = source === 'otomoto' ? 'ogłoszenia samochodowego' : 'ogłoszenia nieruchomości';
  const sourceLabel = source === 'otomoto' ? 'Otomoto' : 'Otodom';
  return `Tytuł: ${data.title}\nCena: ${data.price} PLN\nLokalizacja: ${data.location}\nParametry:\n${specsLines}\nOpis:\n${data.description}`;
}

console.log(buildAiOpinionPrompt('otomoto', {
  title: 'Volkswagen Golf 2018',
  price: 45000,
  location: 'Warszawa',
  description: 'Auto w bardzo dobrym stanie, serwisowane w ASO.',
  specs: { brand: 'Volkswagen', model: 'Golf', year: '2018', mileage: '95000', fuel_type: 'diesel' },
}));
EOF
node /tmp/check-prompt.mjs
```

Expected: readable Polish text with the title, price, location, all five specs, and the description interpolated correctly, with no `undefined` or `[object Object]` artifacts. Delete `/tmp/check-prompt.mjs` afterward.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/scrape-listing/index.ts
git commit -m "Generate AI listing opinion via Claude Haiku 4.5 at scrape time"
```

**Deployment note (not part of this task's code):** whoever deploys this needs to run `supabase secrets set ANTHROPIC_API_KEY=<key>` for the `scrape-listing` function's project before this code goes live — without it, `generateAiOpinion` logs an error and returns `null` for every listing (by design, per the Global Constraints — this must never fail the scrape itself).

---

### Task 5: Add AI opinion columns to the `Listing` type and pass them down

**Files:**
- Modify: `app/listing/[id]/listing-client.tsx:24-38` (`Listing` type), `app/listing/[id]/listing-client.tsx:505-510` (`ReviewList` usage)

**Interfaces:**
- Consumes: `listings.ai_opinion_rating` / `ai_opinion_summary` / `ai_opinion_price_note` / `ai_opinion_watch_out` columns from Task 1 (already included in the existing `.select('*, ...)` at `listing-client.tsx:71`, no query change needed).
- Produces: an `aiOpinion` prop passed to `<ReviewList>`, of the shape Task 6 expects: `{ rating: number; summary: string; priceNote: string; watchOutFor: string[] } | null`.

- [ ] **Step 1: Extend the `Listing` type**

In `app/listing/[id]/listing-client.tsx`, add the four new fields to the `Listing` type (after `seller` at line 37):

```typescript
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
  ai_opinion_rating: number | null;
  ai_opinion_summary: string | null;
  ai_opinion_price_note: string | null;
  ai_opinion_watch_out: string[] | null;
};
```

- [ ] **Step 2: Pass the AI opinion down to `ReviewList`**

Replace the `<ReviewList>` usage at lines 505-509 with:

```typescript
              <ReviewList
                listingId={listingId}
                refreshTrigger={reviewRefresh}
                onHasUserReview={(hasReview) => setHasUserReview(hasReview)}
                aiOpinion={
                  listing?.ai_opinion_rating != null
                    ? {
                        rating: listing.ai_opinion_rating,
                        summary: listing.ai_opinion_summary ?? '',
                        priceNote: listing.ai_opinion_price_note ?? '',
                        watchOutFor: listing.ai_opinion_watch_out ?? [],
                      }
                    : null
                }
              />
```

- [ ] **Step 3: Verify with `tsc`**

Run: `npx tsc --noEmit`
Expected: this will show a type error for the new `aiOpinion` prop until Task 6 adds it to `ReviewListProps` — that's expected; re-run after Task 6 to confirm it's clean. Note this in your progress rather than treating it as a regression.

- [ ] **Step 4: Commit**

```bash
git add app/listing/\[id\]/listing-client.tsx
git commit -m "Pass AI listing opinion from listing data down to ReviewList"
```

---

### Task 6: Render the AI opinion card in `ReviewList`

**Files:**
- Modify: `components/review-list.tsx`

**Interfaces:**
- Consumes: `aiOpinion` prop of shape `{ rating: number; summary: string; priceNote: string; watchOutFor: string[] } | null` from Task 5.
- Produces: nothing consumed elsewhere — this is the final rendering step.

- [ ] **Step 1: Add the `AiOpinion` type and extend `ReviewListProps`**

In `components/review-list.tsx`, after the existing `Review` type (line 35), add:

```typescript
type AiOpinion = {
  rating: number;
  summary: string;
  priceNote: string;
  watchOutFor: string[];
};
```

Update `ReviewListProps` (lines 37-41) to:

```typescript
type ReviewListProps = {
  listingId: string;
  refreshTrigger?: number;
  onHasUserReview?: (hasReview: boolean, review: Review | null) => void;
  aiOpinion?: AiOpinion | null;
};
```

Update the component signature (line 43) to destructure it:

```typescript
export function ReviewList({ listingId, refreshTrigger, onHasUserReview, aiOpinion }: ReviewListProps) {
```

- [ ] **Step 2: Include `aiOpinion` in the empty-state check**

Change the early-return condition at line 154 from:

```typescript
  if (reviews.length === 0 && pendingReviews.length === 0) {
```

to:

```typescript
  if (reviews.length === 0 && pendingReviews.length === 0 && !aiOpinion) {
```

This ensures a listing with only an AI opinion and no real reviews still renders the AI card instead of the "Brak opinii" empty state.

- [ ] **Step 3: Render the AI opinion card**

Inside the main `return (<div className="space-y-4">` block (line 168), add this as the very first child, before the `{pendingReviews.length > 0 && (...)}` block:

```typescript
      {aiOpinion && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-600 text-white hover:bg-blue-600">Opinia AI</Badge>
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-5 w-5 ${
                      i < aiOpinion.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-700">{aiOpinion.summary}</p>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-1">Cena</h4>
              <p className="text-gray-600">{aiOpinion.priceNote}</p>
            </div>
            {aiOpinion.watchOutFor.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-1">Na co zwrócić uwagę</h4>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {aiOpinion.watchOutFor.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-gray-500 pt-2 border-t">
              Opinia wygenerowana automatycznie przez AI na podstawie opisu ogłoszenia. Może się mylić — nie zastępuje oceny na żywo.
            </p>
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 4: Verify with `tsc` and `lint`**

Run: `npx tsc --noEmit`
Expected: clean — this also resolves the expected Task 5 Step 3 error, since `aiOpinion` now exists on `ReviewListProps`.

Run: `npx next lint`
Expected: no new warnings/errors on `components/review-list.tsx` or `app/listing/[id]/listing-client.tsx`.

- [ ] **Step 5: Manual UI check**

Start the dev server (`npm run dev`) and open a listing detail page. Since no listing in the local/dev database has `ai_opinion_rating` populated yet (Task 4's generation only runs for newly-scraped listings, and requires a deployed `ANTHROPIC_API_KEY`), temporarily set one row's AI columns directly for this check only:

```sql
update listings set
  ai_opinion_rating = 4,
  ai_opinion_summary = 'Testowe podsumowanie AI.',
  ai_opinion_price_note = 'Cena wygląda rynkowo dla tego rocznika.',
  ai_opinion_watch_out = array['Czy przebieg jest potwierdzony fakturami serwisowymi?', 'Czy auto miało jednego właściciela?']
where id = '<a real listing id from your dev database>';
```

Confirm on the listing page: the "Opinia AI" badge and card appear first in the list (above any real reviews and above the pending-review section if you're logged in with a pending review), the star rating shows 4 filled stars, both text sections render, and the "Zatwierdzone opinie (N)" heading count is unchanged (it should not include the AI card). Then revert the test row (`update listings set ai_opinion_rating = null, ai_opinion_summary = null, ai_opinion_price_note = null, ai_opinion_watch_out = null where id = '<same id>';`) so the dev database isn't left with fabricated data.

- [ ] **Step 6: Commit**

```bash
git add components/review-list.tsx
git commit -m "Render AI opinion as a badged card at the top of the reviews list"
```
