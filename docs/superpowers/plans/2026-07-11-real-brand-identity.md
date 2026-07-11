# Real Brand Identity Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the July 10 invented navy/green rebrand (colors, fonts, logo) with the site owner's real designer-made brand: an indigo/cyan/navy/success/warning palette, Manrope+Inter typography, and a chat-bubble+checkmark logo, sourced from the Brand Guide assets in `/Users/eugeniusz.keptia/Downloads/Rebranding cesly.pl i logo (1)/`.

**Architecture:** Same technique as the July 10 rebrand — re-point the shadcn CSS-variable tokens in `app/globals.css`/`tailwind.config.ts` so every page that themes itself through those tokens updates automatically, swap the `next/font/google` loaders in `app/layout.tsx`, and replace the `LogoMark` component plus its duplicated inline copies in the `next/server` `ImageResponse` icon/OG-image generators. Two small call-site changes (header wordmark/tagline, price-badge color names) follow from the token rename.

**Tech Stack:** Next.js 13.5.1, Tailwind CSS, `next/font/google`, `next/server`'s `ImageResponse` (unchanged from July 10 — no new dependencies).

## Global Constraints

- Logo mark: chat-bubble silhouette (rounded rect + small tail at bottom-left) with a white checkmark, fill is a linear gradient from Primary `#4F46E5` (indigo) to Accent `#06B6D4` (cyan). This is the *only* logo mark — the Facebook Cover's magnifying-glass-and-stars icon is not used anywhere.
- Exact hex → HSL token values (verbatim, do not recompute or approximate):
  - Primary `#4F46E5` → `243 75% 59%`
  - Navy `#1E1B4B` → `244 47% 20%`
  - Accent `#06B6D4` → `189 94% 43%`
  - Background `#F8F9FA` → `209 17% 98%`
  - Success `#16A34A` → `142 76% 36%` (unchanged value, renamed token)
  - Warning `#F59E0B` → `38 92% 50%`
  - Foreground/Text `#1F2937` → `215 28% 17%`
  - Muted-foreground `#6B7280` → `220 9% 46%`
  - Radius: `10px` = `0.625rem`
- Typography: Manrope for headings, Inter for body — the reverse of the July 10 pairing.
- Tagline, verbatim, correct spelling: "Ogłoszenia i opinie" (the source graphic has a typo — do not copy the typo).
- `--destructive` (red) is untouched and stays reserved for real errors (toast error variants) — do not rename or repurpose it.
- No changes to homepage structure, listing card layout, pagination, or the price-change feature's logic — only the badge colors change.
- No changes to RLS, auth, or business logic.

---

### Task 1: Design tokens (colors + radius)

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

**Interfaces:**
- Produces: Tailwind color utilities `bg-primary`/`text-primary` (now indigo), `bg-navy`/`text-navy` (new), `bg-accent`/`text-accent` (now cyan), `bg-success`/`text-success` (renamed from `verified`), `bg-warning`/`text-warning` (new). Every later task uses these exact class names.

- [ ] **Step 1: Replace the CSS variables in `app/globals.css`**

Replace the entire `:root` block. Note `--verified`/`--verified-foreground` are deliberately kept here (set to the same value as the new `--success`) as a temporary alias — `text-verified` is used in 5 places across the codebase (`app/page.tsx` x2, `components/listing-card.tsx`, `app/listing/[id]/listing-client.tsx`, `components/header.tsx`) that aren't migrated to `text-success`/`text-warning`/`text-navy` until Tasks 4 and 5. Removing the variable now would leave those elements uncolored (Tailwind silently drops classes referencing an undefined color) until Task 5 lands. Task 5 removes this alias once every consumer is migrated.

```css
  :root {
    --background: 209 17% 98%;
    --foreground: 215 28% 17%;
    --card: 0 0% 100%;
    --card-foreground: 215 28% 17%;
    --popover: 0 0% 100%;
    --popover-foreground: 215 28% 17%;
    --primary: 243 75% 59%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 215 28% 17%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 220 9% 46%;
    --accent: 189 94% 43%;
    --accent-foreground: 0 0% 100%;
    --navy: 244 47% 20%;
    --navy-foreground: 0 0% 100%;
    --success: 142 76% 36%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --verified: 142 76% 36%;
    --verified-foreground: 0 0% 100%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 100%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 243 75% 59%;
    --radius: 0.625rem;
    --chart-1: 217 91% 60%;
    --chart-2: 217 91% 70%;
    --chart-3: 217 91% 50%;
    --chart-4: 217 91% 80%;
    --chart-5: 217 91% 40%;
  }
```

- [ ] **Step 2: Update `tailwind.config.ts`'s color block**

Keep the existing `verified` entry as-is (still needed until Task 5) and add three new entries directly after it:

```ts
        verified: {
          DEFAULT: 'hsl(var(--verified))',
          foreground: 'hsl(var(--verified-foreground))',
        },
        navy: {
          DEFAULT: 'hsl(var(--navy))',
          foreground: 'hsl(var(--navy-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
```

(i.e. add the `navy`, `success`, and `warning` blocks right after the existing `verified` block — don't delete `verified` in this task.)

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors (pre-existing `<img>`/hook-dependency warnings are fine).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css tailwind.config.ts
git commit -m "Brand: replace design tokens with real Brand Guide palette (indigo/navy/cyan/success/warning)"
```

---

### Task 2: Typography swap (Manrope headings + Inter body)

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `font-sans`/`font-heading` Tailwind utilities (already wired in `app/globals.css`'s base layer from the July 10 rebrand — `body { @apply ... font-sans }` and `h1..h6 { @apply ... font-heading }` — this task does not touch those lines, only the font loader and the CSS variable names they resolve to).
- Produces: `var(--font-manrope)` now resolves to the Manrope font (used for `font-heading`), `var(--font-inter)` resolves to Inter (used for `font-sans`).

- [ ] **Step 1: Update the Tailwind font family mapping**

In `tailwind.config.ts`, replace:

```ts
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-space-grotesk)', 'var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

with:

```ts
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-manrope)', 'var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

- [ ] **Step 2: Swap the font loader in `app/layout.tsx`**

Replace:

```tsx
import { Manrope, Space_Grotesk } from 'next/font/google';
```

with:

```tsx
import { Inter, Manrope } from 'next/font/google';
```

Replace:

```tsx
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
});
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin', 'latin-ext'],
  weight: ['500', '600', '700'],
  variable: '--font-space-grotesk',
});
```

with:

```tsx
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
});
const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700'],
  variable: '--font-manrope',
});
```

Replace:

```tsx
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
```

with:

```tsx
      <body className={`${inter.variable} ${manrope.variable}`}>
```

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 4: Visual check**

With the dev server running (`obczajone-dev` preview config), reload the homepage and use the browser inspector (`javascript_tool`/`read_page` or equivalent in this project's preview tooling) to confirm an `h1` element's computed `font-family` includes "Manrope" and the `body` element's computed `font-family` includes "Inter".

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx tailwind.config.ts
git commit -m "Brand: swap typography to Manrope headings + Inter body"
```

---

### Task 3: New logo mark + favicon/apple-icon/OG-image/manifest-icon regeneration

**Files:**
- Modify: `components/brand/logo-mark.tsx`
- Modify: `app/icon.tsx`
- Modify: `app/apple-icon.tsx`
- Modify: `app/opengraph-image.tsx`
- Modify: `app/manifest-icon/192/route.tsx`
- Modify: `app/manifest-icon/512/route.tsx`
- Modify: `public/manifest.json`

**Interfaces:**
- Produces: `LogoMark` keeps its existing signature (`{ className?: string }`) — no consumer (`components/header.tsx`) needs to change how it's invoked, only what it renders.

- [ ] **Step 1: Replace the `LogoMark` component with the chat-bubble+checkmark shape**

Replace the full contents of `components/brand/logo-mark.tsx`:

```tsx
import { useId } from 'react';

type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="obczajone.pl"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      <path
        d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M32 52L46 66L70 34"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Regenerate the browser favicon**

Replace the full contents of `app/icon.tsx`:

```tsx
import { ImageResponse } from 'next/server';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F9FA',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <path
            d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
            fill="url(#g)"
          />
          <path
            d="M32 52L46 66L70 34"
            stroke="#FFFFFF"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 3: Regenerate the Apple touch icon**

Replace the full contents of `app/apple-icon.tsx`:

```tsx
import { ImageResponse } from 'next/server';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F9FA',
        }}
      >
        <svg width="130" height="130" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <path
            d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
            fill="url(#g)"
          />
          <path
            d="M32 52L46 66L70 34"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 4: Regenerate the Open Graph share image**

Replace the full contents of `app/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/server';

export const alt = 'obczajone.pl — historia cen i opinie o ogłoszeniach';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1E1B4B',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <svg width="90" height="90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4F46E5" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
            <path
              d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
              fill="url(#g)"
            />
            <path
              d="M32 52L46 66L70 34"
              stroke="#FFFFFF"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 700, color: 'white', display: 'flex' }}>
            obczajone.pl
          </span>
        </div>
        {/* ASCII-only: Satori has no loaded font here that covers Polish diacritics */}
        <span style={{ fontSize: 32, color: '#CBD5E1', textAlign: 'center', display: 'flex' }}>
          Sprawdz historie cen i opinie o ogloszeniach z Otomoto i Otodom
        </span>
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 5: Regenerate the two PWA manifest icon sizes**

Replace the full contents of `app/manifest-icon/192/route.tsx`:

```tsx
import { ImageResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F9FA',
        }}
      >
        <svg width="140" height="140" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <path
            d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
            fill="url(#g)"
          />
          <path
            d="M32 52L46 66L70 34"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { width: 192, height: 192 }
  );
}
```

Replace the full contents of `app/manifest-icon/512/route.tsx`:

```tsx
import { ImageResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F8F9FA',
        }}
      >
        <svg width="370" height="370" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <path
            d="M30,10 L70,10 A20,20 0 0 1 90,30 L90,60 A20,20 0 0 1 70,80 L34,80 L20,96 L28,80 L30,80 A20,20 0 0 1 10,60 L10,30 A20,20 0 0 1 30,10 Z"
            fill="url(#g)"
          />
          <path
            d="M32 52L46 66L70 34"
            stroke="#FFFFFF"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
```

- [ ] **Step 6: Update the PWA manifest theme color**

In `public/manifest.json`, replace:

```json
  "theme_color": "#0F2A4A",
```

with:

```json
  "theme_color": "#4F46E5",
```

- [ ] **Step 7: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (requires `.env.local` with placeholder `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` — already present in this working copy from earlier sessions; if missing, create it with `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key` first).

- [ ] **Step 8: Visual check**

With the dev server running, reload the homepage; confirm the browser tab favicon shows the gradient chat-bubble+checkmark (small, but the indigo/cyan gradient should be visible). Fetch `/apple-icon` and `/opengraph-image` directly in the preview and confirm both return `200` with `content-type: image/png` and visibly show the new bubble mark (OG image on navy `#1E1B4B` background, apple-icon on light `#F8F9FA` background).

- [ ] **Step 9: Commit**

```bash
git add components/brand/logo-mark.tsx app/icon.tsx app/apple-icon.tsx app/opengraph-image.tsx app/manifest-icon public/manifest.json
git commit -m "Brand: replace logo mark with chat-bubble+checkmark and regenerate icon/OG assets"
```

---

### Task 4: Header wordmark color + tagline

**Files:**
- Modify: `components/header.tsx`

**Interfaces:**
- Consumes: `text-navy` Tailwind color (Task 1).

- [ ] **Step 1: Replace the split-color wordmark with a single navy wordmark plus a tagline**

The reference logo renders "obczajone.pl" as a single navy color (not split-colored) with a small tagline underneath. Replace:

```tsx
          <Link href="/" className="flex items-center gap-2 group">
            <LogoMark className="h-9 w-9 transition-transform group-hover:scale-105" />
            <span className="font-heading text-xl font-bold text-primary">
              obczajone<span className="text-verified">.pl</span>
            </span>
          </Link>
```

with:

```tsx
          <Link href="/" className="flex items-center gap-2 group">
            <LogoMark className="h-9 w-9 transition-transform group-hover:scale-105" />
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-xl font-bold text-navy">
                obczajone.pl
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground">
                Ogłoszenia i opinie
              </span>
            </div>
          </Link>
```

- [ ] **Step 2: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 3: Visual check**

Reload the homepage in the dev preview. Confirm: the wordmark "obczajone.pl" renders as one solid navy color (no color split), the tagline "Ogłoszenia i opinie" appears in small muted text beneath it on desktop widths, and the header row does not wrap or overflow. Resize to a mobile width (`preview_resize`/equivalent) and confirm the tagline is hidden (per the `hidden sm:block` class) and the header still fits on one line.

- [ ] **Step 4: Commit**

```bash
git add components/header.tsx
git commit -m "Brand: single-color navy wordmark and header tagline"
```

---

### Task 5: Price-change badge color rename (success/warning)

**Files:**
- Modify: `components/listing-card.tsx`
- Modify: `app/listing/[id]/listing-client.tsx`

**Interfaces:**
- Consumes: `text-success`/`text-warning` Tailwind colors (Task 1).

- [ ] **Step 1: Update `components/listing-card.tsx`**

Replace:

```tsx
        dropped ? 'text-verified' : 'text-destructive'
```

with:

```tsx
        dropped ? 'text-success' : 'text-warning'
```

- [ ] **Step 2: Update `app/listing/[id]/listing-client.tsx`**

Replace:

```tsx
                            priceChangePercent < 0 ? 'text-verified' : 'text-destructive'
```

with:

```tsx
                            priceChangePercent < 0 ? 'text-success' : 'text-warning'
```

- [ ] **Step 3: Update the two `ShieldCheck` trust-signal icons on the homepage**

In `app/page.tsx`, there are two occurrences of `text-verified` on `ShieldCheck` icons (the hero trust-stat pill and the CTA band). Replace both:

```tsx
                <ShieldCheck className="w-4 h-4 text-verified" />
```

with:

```tsx
                <ShieldCheck className="w-4 h-4 text-success" />
```

and:

```tsx
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-verified" />
```

with:

```tsx
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-success" />
```

- [ ] **Step 4: Remove the now-unused `verified` alias**

Every consumer of `text-verified` is now migrated (Task 4 removed the header's usage, Steps 1–3 above removed the rest). Confirm with:

```bash
grep -rn "text-verified\|bg-verified\|border-verified" app components
```

Expected: no output. If anything still appears, stop and fix that call site before continuing — do not remove the token definitions while a consumer still references them.

Once the grep is clean, remove the temporary alias. In `app/globals.css`, delete these two lines from the `:root` block:

```css
    --verified: 142 76% 36%;
    --verified-foreground: 0 0% 100%;
```

In `tailwind.config.ts`, delete the `verified` color entry:

```ts
        verified: {
          DEFAULT: 'hsl(var(--verified))',
          foreground: 'hsl(var(--verified-foreground))',
        },
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 6: Visual check**

In the dev preview, find a listing with a real price drop and one with a real price increase (query the production Supabase project's `listing_snapshots` table for a listing whose current price differs from its earliest snapshot price, in both directions, the same way this was verified during the July 11 price-change feature work). Confirm the drop badge is green (`success`) and the increase badge is now orange/amber (`warning`), not red. Confirm the homepage's trust-stat pill and CTA-band shield icons are also green (unchanged hex value, just confirm nothing broke from the token removal).

- [ ] **Step 7: Commit**

```bash
git add app/globals.css tailwind.config.ts components/listing-card.tsx "app/listing/[id]/listing-client.tsx" app/page.tsx
git commit -m "Brand: rename verified token to success, use warning color for price increases"
```

---

### Task 6: Full sweep and push

**Files:** none (verification only; fix anything found).

- [ ] **Step 1: Full type/lint/build check**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors beyond pre-existing unrelated warnings.

Run: `npm run build`
Expected: build succeeds, all routes compile including `/icon`, `/apple-icon`, `/opengraph-image`, `/manifest-icon/192`, `/manifest-icon/512`.

- [ ] **Step 2: Repo-wide grep for anything still referencing the July 10 palette**

```bash
grep -rn "0F2A4A\|space-grotesk\|Space_Grotesk\|text-verified\|bg-verified" app components lib
```

Expected: no output (the only legitimate historical reference, the design spec documents themselves under `docs/superpowers/specs/`, are not part of this grep's search paths).

- [ ] **Step 3: Screenshot sweep**

Desktop and mobile viewports, using this project's preview tooling:
- `/` — header (logo, wordmark, tagline), hero, listing cards (price-change badges), footer.
- A listing detail page — price-change badge, "zobacz oryginalne ogłoszenie" button color, photo-thumbnail selection ring color.
- `/regulamin` and `/polityka-prywatnosci` — confirm header/footer inherit the new colors correctly (no code changes expected here, just confirms token propagation).

For each, confirm: no leftover indigo-clashing colors, no `#0F2A4A`/navy-ring-and-check artifacts, tagline visible on desktop header, price badges show success/warning (not the old verified/destructive colors).

- [ ] **Step 4: Fix anything the sweep finds**

If any leftover reference to the old palette or a broken rendering turns up, fix it following the same token-rename pattern as the earlier tasks, then re-run Step 1 and re-screenshot the affected page.

- [ ] **Step 5: Push**

```bash
git push origin feature/rebranding
```

Expected: push succeeds (fast-forward; this branch has been pushed after every task in this plan).

- [ ] **Step 6: Final report**

Summarize to the user: commits pushed (`git log --oneline -10`), which pages were verified, and confirm the logo/color/font changes match the Brand Guide's exact hex values.
