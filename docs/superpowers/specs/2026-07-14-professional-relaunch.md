# Professional relaunch: new logo, color refresh, spacing, SEO, cookies

## Context

The user provided a new final logo (`grafika/image.png`): a document/checklist icon combined with a magnifying glass, rendered in a two-tone blue (dark navy for "OBCZAJONE", vivid blue for ".PL"), with tagline "OBCZAJ ZANIM KUPISZ." This replaces both the currently-implemented chat-bubble+checkmark mark (indigo/cyan gradient) and an earlier paw-print concept that was only ever a mockup screenshot.

Alongside the logo swap, the user asked for a general visual polish pass, reduced spacing between homepage sections, SEO completeness, and a cookie consent notice — framed as "make the site and subpages look professional."

## Source asset

`grafika/image.png` (2031×774 px, white background, no transparency layer confirmed but background is flat white so effectively usable as-is). Sampled colors:
- Navy (wordmark "OBCZAJONE"): `rgb(4, 23, 50)` → `hsl(215, 85%, 11%)`
- Vivid blue (".PL", tagline, icon linework): `rgb(23, 92, 224)` → `hsl(219, 81%, 48%)`

The icon is a single flat color (vivid blue), no gradient: a rounded-rectangle document containing 3 rows of bullet+line ("checklist"), overlapped at the bottom-right by a magnifying glass (circle + handle). This is being recreated as a clean SVG (matching the existing pattern in `components/brand/logo-mark.tsx`) rather than embedding the raster PNG, so it stays crisp at favicon/header/OG sizes.

## 1. Logo & header

- Rebuild `components/brand/logo-mark.tsx` as the document+magnifying-glass icon in flat vivid blue (`#175CE0` / `hsl(219 81% 48%)`), replacing the gradient chat-bubble+checkmark path.
- Header wordmark becomes upper-case two-tone: **OBCZAJONE** in navy + **.PL** in vivid blue (single text line, matching the source logo), replacing the current lower-case single-color "obczajone.pl".
- Header tagline changes from "Ogłoszenia i opinie" to "Obczaj zanim kupisz." (matches the logo file; also reads as a small call-to-action).
- Footer wordmark/tagline updated the same way.
- Regenerate `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`, `app/manifest-icon/192/route.tsx`, `app/manifest-icon/512/route.tsx` to use the new mark and navy/blue palette instead of the old gradient.
- `public/manifest.json` `theme_color`/`background_color` updated to match (`theme_color` → the new vivid blue).

## 2. Color palette (`app/globals.css` tokens)

Replace the indigo/cyan brand tokens with navy/blue derived from the new logo:

- `--primary`: `219 81% 48%` (vivid blue — was indigo `243 75% 59%`)
- `--navy`: `215 85% 11%` (near-black navy — was `244 47% 20%`)
- `--accent`: a lighter tint of the same blue hue, `217 85% 65%`, replacing the current cyan `189 94% 43%`, so accent/hover states read as "lighter version of primary" rather than a second unrelated hue
- `--ring`: follows `--primary`
- `--success` / `--warning` / `--destructive`: **unchanged** — these are semantic (price-drop/price-rise/error) indicators, not brand colors, and must stay visually distinct from the new primary blue
- `--background` / `--foreground` / `--card` / `--muted` / `--border`: unchanged (neutral near-white/slate grays already work with either brand hue)
- `--chart-*`: rescale to the new primary hue (`219`) instead of `217` (functionally identical, kept in sync for consistency)

## 3. Typography

- No change to `next/font` loading for body/UI text — Inter (body) and Manrope (headings) stay, since they're readable at paragraph/heading scale.
- Add **Baloo 2** (Google Font, weight 700/800) as a new `--font-logo` CSS variable, used **only** for the literal wordmark "OBCZAJONE.PL" in the header and footer (and the tagline directly under it) — not applied to page H1/H2/etc. This matches the source logo's chunky rounded all-caps look without making body headings shout.

## 4. Spacing tightening

Homepage (`app/page.tsx`) currently stacks major sections with `mt-20` (80px): hero → HowItWorks → WhyUs → RecentListings → PromotionalBanner → Faq → closing CTA. Reduce to `mt-12` (48px) between each, except keep a slightly larger `mt-14` (56px) before the closing CTA band (it's a visually distinct full-bleed color block and benefits from a touch more separation). Footer's `mt-20` top margin becomes `mt-14`.

No change to spacing *within* a section (card padding, gap-6 grids, etc.) — only the gaps *between* sections.

## 5. SEO additions

- **Organization JSON-LD**: add a second `<script type="application/ld+json">` block in `app/layout.tsx` (alongside the existing `WebSite` block) with `@type: Organization`, `name`, `url`, and `logo` pointing at the new `app/icon.tsx`-generated icon.
- **FAQPage JSON-LD**: the homepage already renders a FAQ section (`components/home/faq.tsx`) with hardcoded Q&A pairs — mirror that same list into a `FAQPage` JSON-LD block on the homepage so it's eligible for Google FAQ rich snippets.
- **Google Search Console verification**: the current `verification.google` value in `app/layout.tsx` is the literal placeholder string `'google-site-verification-code'`, which is not a real code and does nothing. Per the user (no real code supplied): remove the `verification` field entirely rather than ship a fake one. The user can add a real one later by pasting it back into `metadata.verification.google`.
- **OG image / favicon**: regenerated as part of section 1 (logo swap) — same infrastructure (`ImageResponse`), new colors/mark only.
- No changes to `sitemap.ts` or `public/robots.txt` — both already correct and unaffected by the visual refresh.

## 6. Cookie consent

- New client component `components/cookie-consent.tsx`: a fixed bottom bar, shown once per browser (checked/set via `localStorage`, key `cookie-consent-ack`), with a short sentence and a single "Akceptuję" button plus a link to `/polityka-prywatnosci`. No granular category toggles or a rejection flow — the site currently sets no non-essential/analytics cookies, so this is a notice rather than a consent-management platform. If analytics are added later, this component is the natural place to gate them behind the same acknowledgement flag.
- Rendered from `app/layout.tsx` so it appears on every page.

## Non-goals

- No change to the scraper, database schema, or any listing data.
- No change to `polityka-prywatnosci` / `regulamin` page *text* — only shared visual chrome (header/footer) around them.
- No analytics/tracking script is being added — the cookie banner is forward-looking, not gating any current tracker.
- No change to the earlier ListingCard overflow/zero-price/missing-image fixes already shipped on `main`.

## Verification

- Visual check of homepage + a listing detail page at 1280px and 375px (screenshot), confirming: new logo renders crisply in header/footer, tighter section spacing reads as intentional (not cramped), cookie bar appears on first load and stays dismissed after accepting and reloading.
- `npx tsc --noEmit` and `npx next lint` clean.
- View source / JSON-LD validated with a quick manual parse (`JSON.parse` in browser console) for both the Organization and FAQPage blocks.
- Confirm favicon/OG image updated by checking the generated routes directly (`/icon`, `/opengraph-image`, `/manifest-icon/192`, `/manifest-icon/512`).
