# obczajone.pl Rebranding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace obczajone.pl's generic-AI-template look (orange/blue gradients, mismatched colors, dead footer links) with a cohesive "trust and authority" brand: a navy/green monogram identity, Space Grotesk/Manrope typography, and a fuller homepage structure that builds credibility.

**Architecture:** Re-point the existing shadcn CSS-variable design tokens (`app/globals.css`, `tailwind.config.ts`) to the new palette so every page that already themes itself through those tokens (listing detail, profile, admin) updates for free. Layer targeted fixes on top for the few places that bypass the tokens with hardcoded Tailwind color classes, replace the logo/favicon/OG-image assets, and rebuild the homepage (`app/page.tsx`) and footer as the two places that need real structural changes.

**Tech Stack:** Next.js 13.5.1 (App Router), Tailwind CSS 3.3, shadcn/radix-ui components, `next/font/google`, `next/server`'s `ImageResponse` (bundled with Next, no new dependency) for favicon/apple-icon/OG-image/manifest-icon generation, lucide-react icons.

## Global Constraints

- Primary brand color: `#0F2A4A` navy — HSL `213 66% 17%`.
- Verification/trust accent color: `#16A34A` green — HSL `142 76% 36%`. This is a **new dedicated token** (`--verified` / Tailwind `verified`), not a repurposing of shadcn's existing `--accent` variable — `--accent` drives generic hover/highlight states across many primitives (ghost/outline button hover, dropdown item hover) and must stay a neutral tint so green doesn't appear on every hover everywhere.
- Headings font: Space Grotesk. Body/UI font: Manrope. Both via `next/font/google`, subsets `['latin', 'latin-ext']` (Polish diacritics require `latin-ext`).
- Homepage trust-stat copy is fixed and verbatim, supplied by the site owner — do not invent a different number: "Ponad 10 000 sprawdzonych ogłoszeń".
- Contact email, verbatim: `kontakt@obczajone.pl`.
- `/regulamin` and `/polityka-prywatnosci` are placeholder skeletons only — no invented legal text, each section body is a literal `[Do uzupełnienia: ...]` note, and both pages carry `robots: { index: false, follow: false }`.
- No changes to RLS, auth flow, admin capabilities, or the promotional partner's content/link (`components/promotional-banner.tsx` keeps the same partner, photo, and Instagram link — only its colors change).
- No changes to `--destructive`, `--chart-*`, `--border`, `--input`, `--secondary`, `--muted` CSS variables — out of scope.
- Existing security/SEO fixes from commits `ed409e5` and `eecccff` on this branch must not be reverted or altered by this work.

---

### Task 1: Design tokens and typography foundation

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: Tailwind color utilities `bg-primary`/`text-primary`/`border-primary` (now navy), `bg-verified`/`text-verified`/`border-verified` (new, green), `font-heading` (Space Grotesk) and `font-sans` (Manrope) utilities. Every later task uses these class names — do not rename them.

- [ ] **Step 1: Update the CSS variables in `app/globals.css`**

In the `:root` block, replace these three lines:

```css
    --primary: 215 25% 9%;
    --primary-foreground: 0 0% 100%;
```

with:

```css
    --primary: 213 66% 17%;
    --primary-foreground: 0 0% 100%;
```

Replace:

```css
    --accent: 20 91% 55%;
    --accent-foreground: 0 0% 100%;
```

with:

```css
    --accent: 213 30% 94%;
    --accent-foreground: 213 66% 17%;
    --verified: 142 76% 36%;
    --verified-foreground: 0 0% 100%;
```

Replace:

```css
    --ring: 217 91% 60%;
```

with:

```css
    --ring: 213 66% 30%;
```

- [ ] **Step 2: Add `font-sans`/`font-heading` to the base typography rules in `app/globals.css`**

Replace:

```css
  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-bold tracking-tight;
  }
```

with:

```css
  body {
    @apply bg-background text-foreground antialiased font-sans;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }

  h1, h2, h3, h4, h5, h6 {
    @apply font-bold tracking-tight font-heading;
  }
```

- [ ] **Step 3: Add the `verified` color and font families to `tailwind.config.ts`**

In the `colors` object, right after the `accent` entry (`accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },`), add:

```ts
        verified: {
          DEFAULT: 'hsl(var(--verified))',
          foreground: 'hsl(var(--verified-foreground))',
        },
```

In `theme.extend`, add a `fontFamily` key alongside `backgroundImage`/`borderRadius`/`colors`:

```ts
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-space-grotesk)', 'var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

- [ ] **Step 4: Swap the font loader in `app/layout.tsx`**

Replace:

```tsx
import { Inter } from 'next/font/google';
```

with:

```tsx
import { Manrope, Space_Grotesk } from 'next/font/google';
```

Replace:

```tsx
const inter = Inter({ subsets: ['latin', 'latin-ext'] });
```

with:

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

Replace:

```tsx
      <body className={inter.className}>
```

with:

```tsx
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
```

- [ ] **Step 5: Verify types and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors (pre-existing warnings unrelated to this change are fine).

- [ ] **Step 6: Visually verify the token change took effect**

Ensure the dev server is running (`obczajone-dev` preview config), then reload the page and use `preview_inspect` on the "Zaloguj się" button (`header button` with the login label) to confirm its computed `background-color` is `rgb(15, 42, 74)` (i.e. `#0F2A4A`) — note it may still show the old hardcoded orange gradient at this point, since that hardcode is fixed in Task 3, not here. Instead verify the token change on an element that has no hardcoded override: use `preview_inspect` on the outlined "Zobacz ogłoszenie"-style default-variant button rendered by `ListingUrlForm`'s submit button (the search button), confirming computed `background-color` resolves to `rgb(15, 42, 74)`. Also use `preview_inspect` on an `h1` element and confirm `font-family` includes `Space Grotesk`.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css tailwind.config.ts app/layout.tsx
git commit -m "Rebrand: switch design tokens to navy/green palette and Space Grotesk/Manrope"
```

---

### Task 2: New logo, favicon, apple icon, OG image, and manifest icons

**Files:**
- Create: `components/brand/logo-mark.tsx`
- Create: `app/icon.tsx`
- Create: `app/apple-icon.tsx`
- Create: `app/opengraph-image.tsx`
- Create: `app/manifest-icon/192/route.tsx`
- Create: `app/manifest-icon/512/route.tsx`
- Modify: `public/manifest.json`
- Modify: `app/layout.tsx`
- Delete: `public/apple-touch-icon.png`, `public/favicon-16x16.png`, `public/favicon-32x32.png`, `public/favicon.ico`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-square.png`, `public/icon.png`, `public/icon.svg`, `public/logo_no_bg.png`, `public/logo_smooth.png`, `public/obczajone_bg_removed.png`, `public/obczajone_full_transparent.png`, `public/obczajone_logo_cropped copy copy copy.png`, `public/obczajone_logo_cropped copy copy.png`, `public/obczajone_logo_cropped copy.png`, `public/obczajone_logo_cropped.png`, `public/obczajone_logo_cropped_v4.png`, `public/obczajone_logo_transparent_cropped copy copy.png`, `public/obczajone_logo_transparent_cropped copy.png`, `public/obczajone_logo_transparent_cropped.png`, `public/obczajone_transparent_clean.png`, `public/og-image.png`, `public/og-image.svg`, `public/u2343413712_modern_minimal_logo_magnifying_glass_with_speech__ec574e13-7363-4b15-a225-db62ef07f04e_2 copy.png`, `public/u2343413712_modern_minimal_logo_magnifying_glass_with_speech__ec574e13-7363-4b15-a225-db62ef07f04e_2.png`

**Interfaces:**
- Consumes: `verified`/`primary` colors from Task 1 (used as literal hex strings here since `ImageResponse`/inline-SVG rendering happens outside Tailwind's CSS pipeline).
- Produces: `LogoMark` React component (`{ className?: string }` props) — Task 3 imports this into `components/header.tsx`.

- [ ] **Step 1: Create the reusable logo icon component**

Create `components/brand/logo-mark.tsx`:

```tsx
type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="obczajone.pl"
    >
      <circle cx="50" cy="50" r="38" stroke="#0F2A4A" strokeWidth="10" fill="none" />
      <path
        d="M32 52L46 66L70 34"
        stroke="#16A34A"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Generate the browser favicon**

Create `app/icon.tsx`:

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
          background: 'white',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" stroke="#0F2A4A" strokeWidth="12" fill="none" />
          <path
            d="M32 52L46 66L70 34"
            stroke="#16A34A"
            strokeWidth="12"
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

- [ ] **Step 3: Generate the Apple touch icon**

Create `app/apple-icon.tsx`:

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
          background: '#0F2A4A',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" stroke="#FFFFFF" strokeWidth="10" fill="none" />
          <path
            d="M32 52L46 66L70 34"
            stroke="#16A34A"
            strokeWidth="10"
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

- [ ] **Step 4: Generate the Open Graph share image**

Create `app/opengraph-image.tsx`:

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
          background: '#0F2A4A',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <svg width="90" height="90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" stroke="#FFFFFF" strokeWidth="9" fill="none" />
            <path
              d="M32 52L46 66L70 34"
              stroke="#16A34A"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 700, color: 'white', display: 'flex' }}>
            obczajone
            <span style={{ color: '#16A34A' }}>.pl</span>
          </span>
        </div>
        <span style={{ fontSize: 32, color: '#CBD5E1', textAlign: 'center', display: 'flex' }}>
          Sprawdz historie cen i opinie o ogloszeniach z Otomoto i Otodom
        </span>
      </div>
    ),
    { ...size }
  );
}
```

Note: the tagline in the OG image is written without Polish diacritics on purpose — Satori (the renderer behind `ImageResponse`) does not have access to the Space Grotesk/Manrope font files here (no `fonts` option is passed, so it falls back to its built-in font, which may not cover `ą/ć/ę/ł/ń/ó/ś/ź/ż`). Plain ASCII avoids missing-glyph boxes in the generated share image.

- [ ] **Step 5: Generate the two PWA manifest icon sizes**

Create `app/manifest-icon/192/route.tsx`:

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
          background: '#0F2A4A',
        }}
      >
        <svg width="130" height="130" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" stroke="#FFFFFF" strokeWidth="10" fill="none" />
          <path
            d="M32 52L46 66L70 34"
            stroke="#16A34A"
            strokeWidth="10"
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

Create `app/manifest-icon/512/route.tsx`:

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
          background: '#0F2A4A',
        }}
      >
        <svg width="340" height="340" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" stroke="#FFFFFF" strokeWidth="10" fill="none" />
          <path
            d="M32 52L46 66L70 34"
            stroke="#16A34A"
            strokeWidth="10"
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

- [ ] **Step 6: Point the manifest at the new icon routes and navy theme color**

In `public/manifest.json`, replace:

```json
  "theme_color": "#2563eb",
```

with:

```json
  "theme_color": "#0F2A4A",
```

Replace the `icons` array:

```json
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
```

with:

```json
  "icons": [
    {
      "src": "/manifest-icon/192",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/manifest-icon/512",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
```

- [ ] **Step 7: Remove the now-redundant manual icon/OG metadata from `app/layout.tsx`**

Delete this whole block (the file-convention icons from Steps 2–3 replace it automatically):

```tsx
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
```

with just:

```tsx
  manifest: '/manifest.json',
```

Then, in the `openGraph` object, delete the `images` array:

```tsx
    images: [
      {
        url: 'https://obczajone.pl/og-image.png',
        width: 1200,
        height: 630,
        alt: 'obczajone.pl - Historia i opinie o ogłoszeniach',
      },
    ],
```

(remove the whole `images: [...]` key from `openGraph` — the `opengraph-image.tsx` file convention from Step 4 supplies it automatically). Similarly in the `twitter` object, delete:

```tsx
    images: ['https://obczajone.pl/og-image.png'],
```

- [ ] **Step 8: Delete the old logo/icon/OG asset files**

```bash
git rm "public/apple-touch-icon.png" "public/favicon-16x16.png" "public/favicon-32x32.png" "public/favicon.ico" "public/icon-192.png" "public/icon-512.png" "public/icon-square.png" "public/icon.png" "public/icon.svg" "public/logo_no_bg.png" "public/logo_smooth.png" "public/obczajone_bg_removed.png" "public/obczajone_full_transparent.png" "public/obczajone_logo_cropped copy copy copy.png" "public/obczajone_logo_cropped copy copy.png" "public/obczajone_logo_cropped copy.png" "public/obczajone_logo_cropped.png" "public/obczajone_logo_cropped_v4.png" "public/obczajone_logo_transparent_cropped copy copy.png" "public/obczajone_logo_transparent_cropped copy.png" "public/obczajone_logo_transparent_cropped.png" "public/obczajone_transparent_clean.png" "public/og-image.png" "public/og-image.svg" "public/u2343413712_modern_minimal_logo_magnifying_glass_with_speech__ec574e13-7363-4b15-a225-db62ef07f04e_2 copy.png" "public/u2343413712_modern_minimal_logo_magnifying_glass_with_speech__ec574e13-7363-4b15-a225-db62ef07f04e_2.png"
```

Note: this does **not** yet remove `header.tsx`'s reference to `/obczajone_logo_transparent_cropped copy copy.png` — that reference is replaced in Task 3, in the same branch, before this is pushed. Do not push between these two tasks in a way that leaves the header pointing at a deleted file.

- [ ] **Step 9: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: build succeeds (requires `.env.local` with placeholder `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` values to exist locally — already present in this working copy from the earlier design session; if missing, create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key` before running).

- [ ] **Step 10: Visually verify the favicon and OG image**

With the dev server running, reload the page and check the browser tab icon renders (navy ring + green check on a small scale). Use `preview_network` to fetch `/apple-icon` and `/opengraph-image` directly and confirm both return `200` with `content-type: image/png`.

- [ ] **Step 11: Commit**

```bash
git add components/brand/logo-mark.tsx app/icon.tsx app/apple-icon.tsx app/opengraph-image.tsx app/manifest-icon public/manifest.json app/layout.tsx
git commit -m "Rebrand: replace logo/favicon/OG-image assets with generated navy/green monogram"
```

---

### Task 3: Fix hardcoded orange in the header and listing detail page

**Files:**
- Modify: `components/header.tsx`
- Modify: `app/listing/[id]/listing-client.tsx`

**Interfaces:**
- Consumes: `LogoMark` from `components/brand/logo-mark.tsx` (Task 2).

- [ ] **Step 1: Replace the header logo image with the new `LogoMark` + wordmark**

In `components/header.tsx`, replace the import block:

```tsx
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
```

with:

```tsx
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/brand/logo-mark';
```

Replace:

```tsx
          <Link href="/" className="flex items-center group">
            <Image
              src="/obczajone_logo_transparent_cropped copy copy.png"
              alt="obczajone.pl"
              width={280}
              height={70}
              className="h-16 w-auto transition-all group-hover:scale-105"
              priority
            />
          </Link>
```

with:

```tsx
          <Link href="/" className="flex items-center gap-2 group">
            <LogoMark className="h-9 w-9 transition-transform group-hover:scale-105" />
            <span className="font-heading text-xl font-bold text-primary">
              obczajone<span className="text-verified">.pl</span>
            </span>
          </Link>
```

- [ ] **Step 2: Remove the hardcoded orange gradient from both "Zaloguj się" buttons**

There are two identical occurrences of this className in `components/header.tsx` (desktop nav and mobile sheet fallback). Replace both:

```
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg transition-all font-medium"
```

with:

```
                className="shadow-md hover:shadow-lg transition-all font-medium"
```

(use a find-and-replace-all across the file for this exact string — it must change in both places).

- [ ] **Step 3: Fix the hardcoded orange "Zobacz oryginalne ogłoszenie" button**

In `app/listing/[id]/listing-client.tsx`, replace:

```
                    className="inline-flex items-center justify-center gap-2 w-full text-white font-medium py-3 px-4 rounded-lg transition-colors bg-orange-500 hover:bg-orange-600"
```

with:

```
                    className="inline-flex items-center justify-center gap-2 w-full text-white font-medium py-3 px-4 rounded-lg transition-colors bg-primary hover:bg-primary/90"
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (confirms `Image`'s removed import isn't referenced elsewhere in the file — if `tsc`/lint flags an unused-import or missing-reference error, re-check Step 1 was applied fully).

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 5: Visually verify**

Reload the homepage in the preview; take a screenshot and confirm: the header shows the ring+check icon and "obczajone.pl" wordmark (green `.pl`), and the "Zaloguj się" button is navy, not orange. Navigate to any listing detail URL (e.g. `/listing/test`) and use `preview_inspect` on the "Zobacz oryginalne ogłoszenie" link to confirm its `background-color` is `rgb(15, 42, 74)` if the listing renders (if no listing exists with that id and the page 404s/redirects, this specific check can be deferred to Task 8's full-site sweep — do not block this task on seeded data that doesn't exist yet).

- [ ] **Step 6: Commit**

```bash
git add components/header.tsx "app/listing/[id]/listing-client.tsx"
git commit -m "Rebrand: replace header logo and remove hardcoded orange buttons"
```

---

### Task 4: Footer component

**Files:**
- Create: `components/footer.tsx`

**Interfaces:**
- Produces: `Footer` component (no props) — Task 7 (`app/page.tsx` rewrite) and Task 5 (legal pages) both import and render it.

- [ ] **Step 1: Create the footer**

Create `components/footer.tsx`:

```tsx
import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-foreground mb-4 text-lg">obczajone.pl</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Portal do weryfikacji ogłoszeń z Otomoto i Otodom.
                Pomagamy kupującym podejmować świadome decyzje.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Dla użytkowników</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/#jak-to-dziala" className="hover:text-primary transition-colors">
                    Jak to działa?
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" className="hover:text-primary transition-colors">
                    Najczęstsze pytania
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Bezpieczeństwo</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/polityka-prywatnosci" className="hover:text-primary transition-colors">
                    Polityka prywatności
                  </Link>
                </li>
                <li>
                  <Link href="/regulamin" className="hover:text-primary transition-colors">
                    Regulamin serwisu
                  </Link>
                </li>
                <li>
                  <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
                    Zgłoś nadużycie
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 text-center text-gray-600 text-sm">
            <p>&copy; {year} obczajone.pl — wszystkie prawa zastrzeżone</p>
            <p className="mt-2">
              Kontakt:{' '}
              <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
                kontakt@obczajone.pl
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (the component isn't imported anywhere yet, so this only checks the file itself is syntactically/type valid).

- [ ] **Step 3: Commit**

```bash
git add components/footer.tsx
git commit -m "Rebrand: add new footer component (not yet wired into any page)"
```

---

### Task 5: Legal placeholder pages

**Files:**
- Create: `app/regulamin/page.tsx`
- Create: `app/polityka-prywatnosci/page.tsx`

**Interfaces:**
- Consumes: `Header` (existing, `components/header.tsx`), `Footer` (Task 4, `components/footer.tsx`).

- [ ] **Step 1: Create the terms-of-service placeholder page**

Create `app/regulamin/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Regulamin serwisu — obczajone.pl',
  description: 'Regulamin korzystania z serwisu obczajone.pl.',
  robots: { index: false, follow: false },
};

const sections = [
  {
    title: '1. Postanowienia ogólne',
    note: 'Do uzupełnienia: definicje, przedmiot regulaminu, dane operatora serwisu.',
  },
  {
    title: '2. Zakres usług',
    note: 'Do uzupełnienia: opis funkcji serwisu (sprawdzanie ogłoszeń, dodawanie opinii).',
  },
  {
    title: '3. Obowiązki użytkownika',
    note: 'Do uzupełnienia: zasady dodawania opinii, zakaz treści bezprawnych.',
  },
  {
    title: '4. Odpowiedzialność',
    note: 'Do uzupełnienia: zakres odpowiedzialności serwisu za treści użytkowników i dane z ogłoszeń.',
  },
  {
    title: '5. Reklamacje i kontakt',
    note: 'Do uzupełnienia: tryb składania reklamacji.',
  },
];

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Regulamin serwisu</h1>
        <p className="text-gray-600 mb-8">
          Ta strona jest szkieletem regulaminu i wymaga uzupełnienia o docelowe zapisy prawne przed publikacją.
        </p>
        <div className="space-y-6">
          {sections.map(({ title, note }) => (
            <section key={title}>
              <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
              <p className="text-gray-500 text-sm italic">[{note}]</p>
            </section>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-8">
          Kontakt:{' '}
          <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
            kontakt@obczajone.pl
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Create the privacy-policy placeholder page**

Create `app/polityka-prywatnosci/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Polityka prywatności — obczajone.pl',
  description: 'Polityka prywatności serwisu obczajone.pl.',
  robots: { index: false, follow: false },
};

const sections = [
  {
    title: '1. Administrator danych',
    note: 'Do uzupełnienia: dane administratora danych osobowych.',
  },
  {
    title: '2. Jakie dane przetwarzamy',
    note: 'Do uzupełnienia: konto użytkownika, treść opinii, zdjęcia, adresy e-mail.',
  },
  {
    title: '3. Cel i podstawa przetwarzania',
    note: 'Do uzupełnienia: świadczenie usługi, moderacja treści, zapobieganie nadużyciom.',
  },
  {
    title: '4. Prawa użytkownika',
    note: 'Do uzupełnienia: prawo dostępu, sprostowania, usunięcia danych (RODO).',
  },
  {
    title: '5. Pliki cookies',
    note: 'Do uzupełnienia: rodzaje wykorzystywanych plików cookies i cel ich użycia.',
  },
  {
    title: '6. Kontakt w sprawie danych',
    note: 'Do uzupełnienia: sposób kontaktu w sprawach ochrony danych osobowych.',
  },
];

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16 max-w-3xl">
        <h1 className="text-3xl font-bold text-foreground mb-8">Polityka prywatności</h1>
        <p className="text-gray-600 mb-8">
          Ta strona jest szkieletem polityki prywatności i wymaga uzupełnienia o docelowe zapisy przed publikacją.
        </p>
        <div className="space-y-6">
          {sections.map(({ title, note }) => (
            <section key={title}>
              <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
              <p className="text-gray-500 text-sm italic">[{note}]</p>
            </section>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-8">
          Kontakt:{' '}
          <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
            kontakt@obczajone.pl
          </a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Visually verify**

With the dev server running, navigate to `/regulamin` and `/polityka-prywatnosci` in the preview; screenshot both and confirm the header/footer render and each of the 5–6 placeholder sections is visible.

- [ ] **Step 5: Commit**

```bash
git add app/regulamin app/polityka-prywatnosci
git commit -m "Rebrand: add placeholder /regulamin and /polityka-prywatnosci pages"
```

---

### Task 6: Restyle the promotional partner banner

**Files:**
- Modify: `components/promotional-banner.tsx`

- [ ] **Step 1: Replace the blue/pink-purple gradient styling with the navy/green palette**

Replace the full contents of `components/promotional-banner.tsx` with:

```tsx
"use client";

import { ExternalLink, Instagram, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import Image from "next/image";

export function PromotionalBanner() {
  return (
    <Card className="bg-primary/5 border-primary/20 overflow-hidden">
      <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-lg bg-white">
            <Image
              src="https://scontent.fktw1-1.fna.fbcdn.net/v/t39.30808-6/633197112_25780169918311194_3295348389581314951_n.jpg?_nc_cat=104&ccb=1-7&_nc_sid=1d70fc&_nc_ohc=zHeOuX3uZw0Q7kNvwFZ4fXV&_nc_oc=AdoElYekMeJ_WPakz8EI7k0N5xOaW5U6iKi37l9xYZIZznJ9UvcF3xzG1ZaJRMQuiQM&_nc_zt=23&_nc_ht=scontent.fktw1-1.fna&_nc_gid=5D6AmzY7gd-il62bIsQQKQ&_nc_ss=7a32e&oh=00_AfzgK4X1aKLzYBWFnMfd4n_V2YDfM63CfG8At9AQtWciAw&oe=69CE1B9F"
              alt="DriveCheck Performance Logo"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              DriveCheck Performance
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Ekspert techniczny – sprawdzanie auta przed zakupem | Wrocław
            </p>
          </div>
        </div>
        <a
          href="https://www.instagram.com/drivecheckperformance"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-all font-medium shadow-md hover:shadow-lg"
        >
          Zobacz na Instagram
          <Instagram className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}
```

(Only the colors changed — same partner name, photo URL, description, and link as before.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Visually verify**

The current homepage (`app/page.tsx`, not yet rewritten by Task 7) already renders `PromotionalBanner`. Reload it in the preview and screenshot the banner: confirm the card background/border and the "Zobacz na Instagram" button are navy, not blue-card/pink-purple-gradient.

- [ ] **Step 4: Commit**

```bash
git add components/promotional-banner.tsx
git commit -m "Rebrand: restyle promotional banner to navy palette"
```

---

### Task 7: Homepage restructure

**Files:**
- Create: `components/home/how-it-works.tsx`
- Create: `components/home/why-us.tsx`
- Create: `components/home/faq.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `Footer` (Task 4), `PromotionalBanner` (Task 6, already restyled), `LogoMark`-free header via existing `Header` component (Task 3 already updated it).
- Produces: `HowItWorks`, `WhyUs`, `Faq` components (no props) — only consumed by `app/page.tsx` in this task.

- [ ] **Step 1: Create the "how it works" section**

Create `components/home/how-it-works.tsx`:

```tsx
import { Link2, LineChart, MessagesSquare } from 'lucide-react';

const steps = [
  {
    icon: Link2,
    title: '1. Wklej link',
    description: 'Skopiuj adres ogłoszenia z Otomoto lub Otodom i wklej go w pole wyszukiwania.',
  },
  {
    icon: LineChart,
    title: '2. Zobacz historię cen',
    description: 'Sprawdzamy, czy cena była zmieniana i czy ogłoszenie pojawiało się wcześniej.',
  },
  {
    icon: MessagesSquare,
    title: '3. Przeczytaj opinie',
    description: 'Zobacz, co napisali inni użytkownicy, którzy już obejrzeli tę ofertę.',
  },
];

export function HowItWorks() {
  return (
    <section className="mt-20" aria-labelledby="jak-to-dziala">
      <h2 id="jak-to-dziala" className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
        Jak to działa
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map(({ icon: Icon, title, description }) => (
          <div key={title} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the "why us" section**

Create `components/home/why-us.tsx`:

```tsx
import { TrendingDown, Users, Shield } from 'lucide-react';

const reasons = [
  {
    icon: TrendingDown,
    title: 'Historia cen',
    description: 'Śledź zmiany cen w czasie i wykrywaj podejrzane manipulacje wartością oferty.',
  },
  {
    icon: Users,
    title: 'Opinie kupujących',
    description: 'Przeczytaj prawdziwe doświadczenia osób, które już obejrzały ofertę na żywo.',
  },
  {
    icon: Shield,
    title: 'Bezpieczeństwo',
    description: 'Weryfikowane opinie i moderacja treści przez nasz zespół.',
  },
];

export function WhyUs() {
  return (
    <section className="mt-20" aria-labelledby="dlaczego-warto">
      <h2 id="dlaczego-warto" className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
        Dlaczego warto
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {reasons.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl mb-4">
              <Icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create the FAQ section**

Create `components/home/faq.tsx`:

```tsx
const faqs = [
  {
    question: 'Czy korzystanie z obczajone.pl jest płatne?',
    answer: 'Nie, sprawdzanie ogłoszeń i przeglądanie opinii jest całkowicie darmowe.',
  },
  {
    question: 'Czy muszę zakładać konto, żeby sprawdzić ogłoszenie?',
    answer:
      'Nie, wklejenie linku i sprawdzenie historii ogłoszenia nie wymaga konta. Konto jest potrzebne tylko do dodawania opinii i zarządzania ulubionymi ogłoszeniami.',
  },
  {
    question: 'Skąd bierzecie historię cen?',
    answer:
      'Automatycznie śledzimy zmiany w dodanych ogłoszeniach z Otomoto i Otodom i zapisujemy historię cen oraz treści oferty.',
  },
  {
    question: 'Kto moderuje opinie?',
    answer: 'Każda opinia przechodzi przez panel moderacji zespołu obczajone.pl, zanim pojawi się publicznie na stronie.',
  },
  {
    question: 'Co zrobić, jeśli opinia wygląda na nieprawdziwą?',
    answer:
      'Przy każdej opinii znajduje się opcja zgłoszenia — nasz zespół sprawdzi zgłoszenie i usunie treść, jeśli narusza zasady.',
  },
];

export function Faq() {
  return (
    <section className="mt-20" aria-labelledby="faq">
      <h2 id="faq" className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
        Najczęstsze pytania
      </h2>
      <div className="max-w-3xl mx-auto space-y-4">
        {faqs.map(({ question, answer }) => (
          <div key={question} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-foreground mb-2">{question}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Rewrite the homepage**

Replace the full contents of `app/page.tsx` with:

```tsx
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ListingUrlForm } from '@/components/listing-url-form';
import { RecentListings } from '@/components/recent-listings';
import { RecentReviews } from '@/components/recent-reviews';
import { PromotionalBanner } from '@/components/promotional-banner';
import { HowItWorks } from '@/components/home/how-it-works';
import { WhyUs } from '@/components/home/why-us';
import { Faq } from '@/components/home/faq';
import { ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-balance">
              Sprawdź ogłoszenie przed zakupem
            </h1>
            <p className="text-gray-600 max-w-xl mx-auto mb-8">
              Zobacz, czy cena była manipulowana i czy inni użytkownicy zgłaszali problem
            </p>

            <div className="flex justify-center mb-4">
              <ListingUrlForm />
            </div>

            <div className="flex justify-center mt-6">
              <div className="inline-flex items-center gap-2 bg-primary/5 border border-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
                <ShieldCheck className="w-4 h-4 text-verified" />
                Ponad 10 000 sprawdzonych ogłoszeń
              </div>
            </div>

            <div className="mb-8 mt-16">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-left">Zobacz co inni znaleźli:</h3>
              <RecentReviews limit={10} showMoreButton={true} />
            </div>
          </div>

          <HowItWorks />
          <WhyUs />

          <div className="mt-20">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left">
                Wszystkie sprawdzone ogłoszenia
              </h2>
              <p className="text-gray-600 text-left">
                Zobacz co inni użytkownicy weryfikowali
              </p>
            </div>
            <RecentListings limit={50} />
          </div>

          <div className="mt-20">
            <PromotionalBanner />
          </div>

          <Faq />

          <div className="mt-20 bg-primary rounded-3xl p-10 md:p-12 text-center text-white shadow-xl">
            <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-verified" />
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Gotowy na bezpieczne zakupy?
            </h2>
            <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto">
              Dołącz do tysięcy użytkowników, którzy chronią się przed oszustwami korzystając z obczajone.pl
            </p>
            <div className="flex justify-center">
              <ListingUrlForm />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
```

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 6: Visually verify the full homepage**

With the dev server running, reload `/` and:
- Take a desktop screenshot (default viewport) — confirm the order top-to-bottom: header, hero + search + trust-stat pill, "Zobacz co inni znaleźli", "Jak to działa" (3 steps), "Dlaczego warto" (3 cards, all navy icon backgrounds — no per-card orange/blue/green mismatch), "Wszystkie sprawdzone ogłoszenia", promotional banner, FAQ, navy CTA band, footer.
- Use `preview_resize` with `preset: "mobile"` and screenshot again — confirm sections stack cleanly with no horizontal overflow.
- Use `preview_console_logs` with `level: "error"` — confirm no new console errors were introduced.
- Click the footer's "Jak to działa?" and "Najczęstsze pytania" links (`preview_click` on the corresponding link text) and confirm the page scrolls to the matching section (anchor targets `#jak-to-dziala` / `#faq` exist).

- [ ] **Step 7: Commit**

```bash
git add components/home app/page.tsx
git commit -m "Rebrand: restructure homepage with trust-building sections and new footer"
```

---

### Task 8: Full-site QA sweep and push

**Files:** none (verification only, plus fixing anything Steps 1–3 turn up).

- [ ] **Step 1: Full type/lint/build check**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors (pre-existing warnings unrelated to this branch's rebrand work are acceptable — do not silently suppress them, just don't treat them as blocking this task).

Run: `npm run build`
Expected: build completes successfully, all routes (including the new `/regulamin`, `/polityka-prywatnosci`, `/icon`, `/apple-icon`, `/opengraph-image`, `/manifest-icon/192`, `/manifest-icon/512`) compile.

- [ ] **Step 2: Screenshot every page at desktop and mobile widths**

With the dev server running:
- `preview_resize` to `preset: "desktop"`, then screenshot `/`, `/regulamin`, `/polityka-prywatnosci`, `/profile`, `/admin`, and any existing `/listing/[id]` route.
- `preview_resize` to `preset: "mobile"`, then repeat the same screenshots.
- For each, confirm: the header shows the new logo/wordmark, no leftover `orange-` classes are visible anywhere (scan each screenshot), no layout overflow on mobile, and `preview_console_logs` shows no new errors (existing errors caused only by the placeholder Supabase credentials returning no data are expected and fine — e.g. `/profile` and `/admin` may redirect to `/` or show an empty/error state since there's no authenticated user in this environment; confirm the page they land on at least still renders the new header/footer correctly rather than crashing).

- [ ] **Step 3: Fix anything the sweep finds**

If Step 2 surfaces any remaining hardcoded `orange-`/mismatched-gradient class outside the files already touched in Tasks 1–7, fix it the same way as Task 3 (swap to `bg-primary`/`text-primary`/`border-primary` or the `verified` equivalent for trust-signal usages), then re-run Step 1 and re-screenshot the affected page.

- [ ] **Step 4: Clean up the local-only preview env file if it was created solely for this work**

If `.env.local` was created purely to run `npm run build`/the dev server locally during this plan and contains only placeholder values (no real credentials), leave it in place (it's already git-ignored via `.gitignore`'s `.env.local` entry) — do not commit it.

- [ ] **Step 5: Push the branch**

```bash
git push origin feature/rebranding
```

Expected: push succeeds, no conflicts (this branch has been pushed to after each prior task's commits in this same plan, so this should be a fast-forward).

- [ ] **Step 6: Final report**

Summarize to the user: which pages were verified, the exact commits pushed (via `git log --oneline -12`), and explicitly call out the two follow-ups that are still open and need the site owner's input before they can be finished: (1) `/regulamin` and `/polityka-prywatnosci` contain placeholder legal text only and need real legal copy before the site should stop `noindex`-ing them; (2) the `>10 000 sprawdzonych ogłoszeń` homepage stat is static text as instructed, not a live count — flag that if it stops being true, it needs to be updated or replaced with a live DB-backed count.
