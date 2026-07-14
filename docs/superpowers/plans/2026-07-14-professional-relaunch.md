# Professional Relaunch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the site's logo/color identity with the new document+magnifying-glass mark, tighten homepage spacing, add the missing SEO structured data, and add a cookie notice — per `docs/superpowers/specs/2026-07-14-professional-relaunch.md`.

**Architecture:** One shared `LogoMark` component (icon-only, single flat blue, no gradient/hook) reused by the header, footer, and all five `ImageResponse`-based favicon/OG/manifest routes. New CSS custom-property values for `--primary`/`--navy`/`--accent`/`--ring`/`--chart-*`. A new `--font-logo` (Baloo 2) CSS variable used only for the literal wordmark. Static JSON-LD blocks added to existing server components (no new data fetching). A small client component for the cookie notice, gated on `localStorage`.

**Tech Stack:** No new dependencies — Baloo 2 loads via the already-installed `next/font/google`.

## Global Constraints

- Source logo asset: `grafika/image.png`. Sampled colors: navy `hsl(215 85% 11%)` / `rgb(4,23,50)`, vivid blue `hsl(219 81% 48%)` / `rgb(23,92,224)` — used verbatim as `#041732` and `#175CE0` in raw-hex contexts (SVG, `ImageResponse`) and as HSL triples in `app/globals.css` tokens.
- `--success` / `--warning` / `--destructive` are semantic tokens (price-drop/price-rise/error) and must NOT be touched.
- No changes to the scraper, database schema, or listing data.
- No changes to `polityka-prywatnosci` / `regulamin` page text, `sitemap.ts`, or `public/robots.txt`.
- No analytics/tracking script is being added.

---

### Task 1: Rebuild the logo icon and reuse it everywhere

**Files:**
- Modify: `components/brand/logo-mark.tsx`
- Modify: `app/icon.tsx`
- Modify: `app/apple-icon.tsx`
- Modify: `app/opengraph-image.tsx`
- Modify: `app/manifest-icon/192/route.tsx`
- Modify: `app/manifest-icon/512/route.tsx`
- Modify: `public/manifest.json`

**Interfaces:**
- Produces: `LogoMark({ size?: number; className?: string })` from `components/brand/logo-mark.tsx` — a pure SVG component (no hooks, no gradient defs), safe to import from both regular DOM contexts (pass `className`, e.g. Tailwind `h-9 w-9`) and `ImageResponse`/Satori contexts (pass explicit numeric `size`, since Satori does not read Tailwind classes or external stylesheets).

- [ ] **Step 1: Rebuild `LogoMark` as the document+magnifying-glass icon**

Replace the entire contents of `components/brand/logo-mark.tsx`:

```tsx
type LogoMarkProps = {
  size?: number;
  className?: string;
};

const BRAND_BLUE = '#175CE0';

export function LogoMark({ size, className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      {...(size ? { width: size, height: size } : {})}
      className={className}
      role="img"
      aria-label="obczajone.pl"
      fill="none"
      stroke={BRAND_BLUE}
      strokeWidth={6.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="10" y="6" width="48" height="74" rx="10" />
      <circle cx="21" cy="27" r="4" fill={BRAND_BLUE} stroke="none" />
      <line x1="33" y1="27" x2="49" y2="27" />
      <circle cx="21" cy="43" r="4" fill={BRAND_BLUE} stroke="none" />
      <line x1="33" y1="43" x2="49" y2="43" />
      <circle cx="21" cy="59" r="4" fill={BRAND_BLUE} stroke="none" />
      <line x1="33" y1="59" x2="45" y2="59" />
      <circle cx="66" cy="62" r="16" />
      <line x1="77" y1="73" x2="91" y2="87" strokeWidth={8} />
    </svg>
  );
}
```

This drops the old `useId()`-based linear gradient entirely (the new mark is a single flat color, matching the source asset), so `components/header.tsx`'s existing `<LogoMark className="h-9 w-9 transition-transform group-hover:scale-105" />` call keeps working unchanged — only the internals changed.

- [ ] **Step 2: Swap the favicon (`app/icon.tsx`) to use the shared component**

Replace the full file:

```tsx
import { ImageResponse } from 'next/server';
import { LogoMark } from '@/components/brand/logo-mark';

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
        <LogoMark size={26} />
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 3: Swap the Apple touch icon (`app/apple-icon.tsx`)**

Replace the full file:

```tsx
import { ImageResponse } from 'next/server';
import { LogoMark } from '@/components/brand/logo-mark';

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
        <LogoMark size={120} />
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 4: Swap the manifest icons (`app/manifest-icon/192/route.tsx` and `.../512/route.tsx`)**

Replace the full contents of `app/manifest-icon/192/route.tsx`:

```tsx
import { ImageResponse } from 'next/server';
import { LogoMark } from '@/components/brand/logo-mark';

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
        <LogoMark size={130} />
      </div>
    ),
    { width: 192, height: 192 }
  );
}
```

Replace the full contents of `app/manifest-icon/512/route.tsx`:

```tsx
import { ImageResponse } from 'next/server';
import { LogoMark } from '@/components/brand/logo-mark';

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
        <LogoMark size={340} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
```

- [ ] **Step 5: Update the Open Graph image (`app/opengraph-image.tsx`) — new icon, navy background, two-tone wordmark**

Replace the full file:

```tsx
import { ImageResponse } from 'next/server';
import { LogoMark } from '@/components/brand/logo-mark';

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
          background: '#041732',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          <LogoMark size={90} />
          <span style={{ fontSize: 64, fontWeight: 800, display: 'flex' }}>
            <span style={{ color: 'white' }}>obczajone</span>
            <span style={{ color: '#175CE0' }}>.pl</span>
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

- [ ] **Step 6: Update `public/manifest.json` theme color**

In `public/manifest.json`, change:

```json
  "theme_color": "#4F46E5",
```

to:

```json
  "theme_color": "#175CE0",
```

(`background_color` stays `"#ffffff"` — unrelated to the brand hue.)

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/brand/logo-mark.tsx app/icon.tsx app/apple-icon.tsx app/opengraph-image.tsx app/manifest-icon/192/route.tsx app/manifest-icon/512/route.tsx public/manifest.json
git commit -m "Replace logo mark with document+magnifying-glass icon across favicon/OG/manifest"
```

---

### Task 2: New color tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the brand color tokens**

In the `:root` block of `app/globals.css`, replace:

```css
    --primary: 243 75% 59%;
    --primary-foreground: 0 0% 100%;
```

with:

```css
    --primary: 219 81% 48%;
    --primary-foreground: 0 0% 100%;
```

Replace:

```css
    --accent: 189 94% 43%;
    --accent-foreground: 0 0% 100%;
    --navy: 244 47% 20%;
    --navy-foreground: 0 0% 100%;
```

with:

```css
    --accent: 217 85% 55%;
    --accent-foreground: 0 0% 100%;
    --navy: 215 85% 11%;
    --navy-foreground: 0 0% 100%;
```

(`--accent` is a lighter tint of the same blue hue as `--primary`, `217 85% 55%` rather than a higher lightness, so `--accent-foreground: 0 0% 100%` white text — already used throughout `components/ui/*` for hover/selected states — keeps a ≥4.5:1 contrast ratio.)

Replace:

```css
    --ring: 243 75% 59%;
```

with:

```css
    --ring: 219 81% 48%;
```

Replace:

```css
    --chart-1: 217 91% 60%;
    --chart-2: 217 91% 70%;
    --chart-3: 217 91% 50%;
    --chart-4: 217 91% 80%;
    --chart-5: 217 91% 40%;
```

with:

```css
    --chart-1: 219 91% 60%;
    --chart-2: 219 91% 70%;
    --chart-3: 219 91% 50%;
    --chart-4: 219 91% 80%;
    --chart-5: 219 91% 40%;
```

Do NOT touch `--success`, `--warning`, `--destructive`, `--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors (CSS isn't type-checked, this just confirms nothing else broke).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Recolor design tokens to navy/blue matching the new logo"
```

---

### Task 3: Baloo 2 logo font + two-tone wordmark in header and footer

**Files:**
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`
- Modify: `components/header.tsx`
- Modify: `components/footer.tsx`

- [ ] **Step 1: Load Baloo 2 in `app/layout.tsx`**

Replace:

```tsx
import { Inter, Manrope } from 'next/font/google';
```

with:

```tsx
import { Baloo_2, Inter, Manrope } from 'next/font/google';
```

After the existing `manrope` font declaration, add:

```tsx
const baloo2 = Baloo_2({
  subsets: ['latin', 'latin-ext'],
  weight: ['700', '800'],
  variable: '--font-logo',
});
```

Replace:

```tsx
      <body className={`${inter.variable} ${manrope.variable}`}>
```

with:

```tsx
      <body className={`${inter.variable} ${manrope.variable} ${baloo2.variable}`}>
```

- [ ] **Step 2: Register the `font-logo` Tailwind family**

In `tailwind.config.ts`, replace:

```ts
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-manrope)', 'var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

with:

```ts
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-manrope)', 'var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        logo: ['var(--font-logo)', 'var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
```

- [ ] **Step 3: Two-tone wordmark + new tagline in the header**

In `components/header.tsx`, replace:

```tsx
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-xl font-bold text-navy">
                obczajone.pl
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground">
                Ogłoszenia i opinie
              </span>
            </div>
```

with:

```tsx
            <div className="flex flex-col leading-tight">
              <span className="font-logo font-extrabold text-xl uppercase tracking-tight">
                <span className="text-navy">Obczajone</span>
                <span className="text-primary">.pl</span>
              </span>
              <span className="hidden sm:block text-xs text-muted-foreground">
                Obczaj zanim kupisz.
              </span>
            </div>
```

- [ ] **Step 4: Two-tone wordmark + tagline in the footer**

In `components/footer.tsx`, replace:

```tsx
            <div>
              <h3 className="font-bold text-foreground mb-4 text-lg">obczajone.pl</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Portal do weryfikacji ogłoszeń z Otomoto i Otodom.
                Pomagamy kupującym podejmować świadome decyzje.
              </p>
            </div>
```

with:

```tsx
            <div>
              <h3 className="font-logo font-extrabold text-lg uppercase tracking-tight">
                <span className="text-navy">Obczajone</span>
                <span className="text-primary">.pl</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">Obczaj zanim kupisz.</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Portal do weryfikacji ogłoszeń z Otomoto i Otodom.
                Pomagamy kupującym podejmować świadome decyzje.
              </p>
            </div>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx tailwind.config.ts components/header.tsx components/footer.tsx
git commit -m "Add Baloo 2 logo font and two-tone wordmark to header/footer"
```

---

### Task 4: Tighten section spacing

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/home/how-it-works.tsx`
- Modify: `components/home/why-us.tsx`
- Modify: `components/home/faq.tsx`
- Modify: `components/footer.tsx`

- [ ] **Step 1: Homepage section gaps**

In `app/page.tsx`, replace:

```tsx
          <div className="mt-20">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left">
                Wszystkie sprawdzone ogłoszenia
              </h2>
```

with:

```tsx
          <div className="mt-12">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3 text-left">
                Wszystkie sprawdzone ogłoszenia
              </h2>
```

Replace:

```tsx
          <div className="mt-20">
            <PromotionalBanner />
          </div>
```

with:

```tsx
          <div className="mt-12">
            <PromotionalBanner />
          </div>
```

Replace:

```tsx
          <div className="mt-20 bg-primary rounded-3xl p-10 md:p-12 text-center text-white shadow-xl">
```

with:

```tsx
          <div className="mt-14 bg-primary rounded-3xl p-10 md:p-12 text-center text-white shadow-xl">
```

Leave the hero's own `<div className="mb-8 mt-16">` (wrapping `RecentReviews`) unchanged — that's spacing *within* the hero section, not a gap *between* top-level sections.

- [ ] **Step 2: `HowItWorks` and `WhyUs` section gap**

In `components/home/how-it-works.tsx`, replace:

```tsx
    <section className="mt-20" aria-labelledby="jak-to-dziala">
```

with:

```tsx
    <section className="mt-12" aria-labelledby="jak-to-dziala">
```

In `components/home/why-us.tsx`, replace:

```tsx
    <section className="mt-20" aria-labelledby="dlaczego-warto">
```

with:

```tsx
    <section className="mt-12" aria-labelledby="dlaczego-warto">
```

- [ ] **Step 3: FAQ section gap**

In `components/home/faq.tsx`, replace:

```tsx
    <section className="mt-20" aria-labelledby="faq">
```

with:

```tsx
    <section className="mt-12" aria-labelledby="faq">
```

- [ ] **Step 4: Footer top margin**

In `components/footer.tsx`, replace:

```tsx
    <footer className="border-t bg-white mt-20">
```

with:

```tsx
    <footer className="border-t bg-white mt-14">
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/home/how-it-works.tsx components/home/why-us.tsx components/home/faq.tsx components/footer.tsx
git commit -m "Tighten spacing between homepage sections"
```

---

### Task 5: SEO — Organization + FAQPage JSON-LD, drop the fake verification code

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/home/faq.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `components/home/faq.tsx` currently defines a private `faqs` array — this task exports it so `app/page.tsx` can reuse the same question/answer pairs for `FAQPage` JSON-LD (avoids duplicating the copy).

- [ ] **Step 1: Remove the fake Google Search Console verification code**

In `app/layout.tsx`, remove these lines from the `metadata` object entirely:

```tsx

  // Verification and analytics
  verification: {
    google: 'google-site-verification-code', // Dodaj swój kod weryfikacji Google
  },
```

- [ ] **Step 2: Add an Organization JSON-LD block alongside the existing WebSite one**

In `app/layout.tsx`, inside the `RootLayout` function, after the existing `jsonLd` constant, add:

```tsx
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'obczajone.pl',
    url: 'https://obczajone.pl',
    logo: 'https://obczajone.pl/manifest-icon/512',
  };
```

Then, right after the existing `<script type="application/ld+json" ...>` tag for `jsonLd` in the `<head>`, add a second script tag:

```tsx
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
```

- [ ] **Step 3: Export the FAQ list**

In `components/home/faq.tsx`, replace:

```tsx
const faqs = [
```

with:

```tsx
export const faqs = [
```

- [ ] **Step 4: Add FAQPage JSON-LD to the homepage**

In `app/page.tsx`, replace:

```tsx
import { Faq } from '@/components/home/faq';
```

with:

```tsx
import { Faq, faqs } from '@/components/home/faq';
```

Inside the `Home` function, before the `return`, add:

```tsx
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
```

Then, as the first child inside the returned `<div className="min-h-screen bg-background">`, add the script tag before `<Header />`:

```tsx
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/home/faq.tsx app/page.tsx
git commit -m "Add Organization/FAQPage JSON-LD, remove fake Search Console verification code"
```

---

### Task 6: Cookie consent notice

**Files:**
- Create: `components/cookie-consent.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the cookie consent component**

Create `components/cookie-consent.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'cookie-consent-ack';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t bg-white/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
      <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
        <p className="text-sm text-muted-foreground text-center sm:text-left">
          Używamy niezbędnych plików cookie do działania serwisu. Więcej informacji znajdziesz w{' '}
          <Link href="/polityka-prywatnosci" className="underline hover:text-primary transition-colors">
            polityce prywatności
          </Link>.
        </p>
        <Button size="sm" onClick={accept} className="shrink-0 whitespace-nowrap">
          Akceptuję
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it from the root layout**

In `app/layout.tsx`, replace:

```tsx
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';
```

with:

```tsx
import { AuthProvider } from '@/lib/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { CookieConsent } from '@/components/cookie-consent';
```

Replace:

```tsx
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
```

with:

```tsx
        <AuthProvider>
          {children}
          <Toaster />
          <CookieConsent />
        </AuthProvider>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add components/cookie-consent.tsx app/layout.tsx
git commit -m "Add cookie consent notice"
```

---

### Task 7: Full verification sweep and push

- [ ] **Step 1: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors (same pre-existing warnings as before this plan are fine).

- [ ] **Step 2: Visual check — homepage at 1280×900**

Using this project's preview tooling: start/reload the dev server, navigate to `/`, resize to `1280x900`, and screenshot. Confirm:
- Header shows the new document+magnifying-glass icon and the two-tone "OBCZAJONE.PL" wordmark with "Obczaj zanim kupisz." underneath.
- Section gaps read as tighter than before, not cramped or overlapping.
- Cookie bar appears at the bottom on first load.

- [ ] **Step 3: Visual check — homepage at 375×812 (mobile)**

Resize to `375x812`, screenshot. Confirm the header/footer/cookie bar all still look correct at mobile width (no overlap, no overflow).

- [ ] **Step 4: Cookie bar dismissal check**

Click "Akceptuję", then reload the page. Confirm the bar does not reappear (i.e. `localStorage.getItem('cookie-consent-ack')` persisted).

- [ ] **Step 5: Listing detail page check**

Navigate to any `/listing/[id]` page. Confirm the header/footer show the new logo/wordmark correctly (this page reuses the same `Header`/`Footer` components, so this is mainly confirming no page-specific override was missed).

- [ ] **Step 6: Favicon/OG/manifest routes check**

Using `javascript_tool` or `read_network_requests` in the preview browser, fetch `/icon`, `/apple-icon`, `/opengraph-image`, `/manifest-icon/192`, `/manifest-icon/512` and confirm each returns a `200` with `content-type: image/png` (visually spot-check at least `/opengraph-image` by navigating to it directly).

- [ ] **Step 7: JSON-LD sanity check**

In the browser console on `/`, run:

```js
[...document.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)['@type'])
```

Expected: `["WebSite", "Organization", "FAQPage"]` (order may vary slightly — confirm all three `@type` values are present with no parse errors).

- [ ] **Step 8: Push**

```bash
git push origin main
```

Expected: push succeeds. This work lands directly on `main` per the site owner's established preference this session.

- [ ] **Step 9: Final report**

Confirm to the user: new logo live across header/footer/favicon/OG/manifest, new navy/blue palette, tightened spacing, Organization+FAQPage JSON-LD added, fake GSC verification code removed, cookie notice live — with screenshots at both 1280px and 375px, and the commit(s) pushed.
