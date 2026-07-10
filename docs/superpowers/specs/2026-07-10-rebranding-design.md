# Rebranding design — obczajone.pl

## Context

obczajone.pl helps buyers check a listing (from Otomoto or Otodom) before purchasing: price history and other buyers' reviews. The current visual design reads as an unpolished, generic AI-generated SaaS template: a bright orange/blue gradient magnifying-glass logo, mismatched gradient colors per feature card, a stray pink/purple Instagram-branded partner banner that clashes with the rest of the page, dead footer links (plain text pretending to be navigation), a stale copyright year, and an English sentence dropped into otherwise all-Polish footer copy. The goal of this design is a full visual rebrand that makes the site read as a serious, trustworthy consumer-protection service, not a template.

This is a design-only rebrand: no changes to business logic, data model, or admin functionality. Security and code-quality fixes were already handled in a separate pass (commits `ed409e5`, `eecccff` on this branch).

## Brand identity

**Logo:** a monogram mark — a ring (the letter "O", from *obczajone*) with a green checkmark drawn inside it. Works as a standalone icon (favicon, avatar, app icon) and paired with the "obczajone.pl" wordmark in the header.

**Color palette:**
- Primary (navy): `#0F2A4A` — replaces the current near-black `--primary` and the orange accent as the dominant UI color (buttons, headings, header background elements).
- Accent (green): `#16A34A` — used sparingly, only for "verified/trust" signals: the checkmark, success states, the "zweryfikowane" micro-copy, positive price-change indicators.
- Neutrals: white background, existing gray scale for body text/borders (unchanged — these were already reasonable).
- The existing `--destructive` red and chart colors are unchanged; only `--primary` and `--accent` (and any hardcoded `orange-*`/mismatched gradient classes) are replaced.

**Typography:** Space Grotesk for headings (h1–h3, logo wordmark), Manrope for body text and UI labels. Both loaded via `next/font/google` (not a runtime `<link>` tag) to avoid layout shift and keep them self-hosted through Next's font optimization. Replaces the current default system-ui/Tailwind stack (no custom font was previously configured).

## Technical approach

Most of the app (listing detail, profile, admin) already themes itself through the shadcn CSS variables in `app/globals.css` (`--primary`, `--accent`, etc.) rather than hardcoded Tailwind color classes, so re-pointing those variables to the new navy/green palette re-skins those pages with no structural changes. The known exceptions to fix explicitly (hardcoded colors bypassing the token system):
- `app/page.tsx` — nearly every section uses ad-hoc `orange-*`/`blue-*`/`green-*` gradient classes directly; this file is being restructured anyway (see below).
- `app/listing/[id]/listing-client.tsx` — the "Zobacz oryginalne ogłoszenie" link hardcodes `bg-orange-500`; switch to `bg-primary`.
- `components/header.tsx` — the "Zaloguj się" button hardcodes an orange gradient; switch to the `default` button variant (which already resolves to `bg-primary` once the token changes).
- Any other hardcoded `orange-`/mismatched gradient class found during implementation should be swept to the token equivalent (`bg-primary`, `text-accent`, etc.) rather than left as a one-off exception.

Logo asset: replace the messy `public/obczajone_logo_transparent_cropped copy copy.png` (and its sibling near-duplicate PNGs: `obczajone_logo_transparent_cropped copy.png`, `obczajone_logo_transparent_cropped.png`, `logo_no_bg.png`, `logo_smooth.png`, `obczajone_bg_removed.png`, `obczajone_full_transparent.png`, `icon.png`, `icon.svg`, `icon-192.png`, `icon-512.png`, `icon-square.png`, `apple-touch-icon.png`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico`) with a single new SVG source (`public/logo-mark.svg` — the ring+checkmark icon alone, and `public/logo-full.svg` if a combined lockup asset is useful) and regenerate the favicon/apple-touch-icon/manifest PNG icons from it. `og-image.png`/`og-image.svg` should also be redrawn in the new brand style since the current one presumably carries the old logo/colors (verify during implementation and regenerate if so).

## Homepage restructure (`app/page.tsx`)

Full-depth version, top to bottom:

1. **Header** (shared component) — new logo, nav unchanged in function, restyled button.
2. **Hero** — existing headline "Sprawdź ogłoszenie przed zakupem" and the URL input form are kept (copy is fine), restyled to the new palette/type, gradients removed.
3. **Trust stat bar** — a single stat, exactly as directed by the site owner: "Ponad 10 000 sprawdzonych ogłoszeń". Static text, not a DB query (the owner supplied this figure directly rather than asking for a live count).
4. **"Jak to działa" (How it works)** — 3 steps: (1) wklej link do ogłoszenia z Otomoto/Otodom, (2) zobacz historię cen i zmiany w ogłoszeniu, (3) przeczytaj opinie innych, którzy już to sprawdzili/odwiedzili. Simple numbered/icon layout, no new component library needed.
5. **"Dlaczego warto" (Why us)** — keep the existing 3 concepts already in the copy (Historia cen / Opinie kupujących / Bezpieczeństwo) and their existing descriptive text, but restyle: one consistent icon treatment (navy icon on light background, not a different gradient color per card) instead of the current green/blue/orange-per-card mismatch.
6. **Ostatnio sprawdzone ogłoszenia** (`RecentListings`) — unchanged component logic, just inherits new tokens.
7. **Ostatnie opinie** (`RecentReviews`) — unchanged component logic, inherits new tokens.
8. **Baner partnera** (`PromotionalBanner`) — keep the existing partner content and photo (real business relationship, not invented), restyle the card background and CTA button to the new palette instead of the current blue-card-with-pink/purple-Instagram-gradient-button combination that clashes with everything else. The Instagram icon can stay; the button color should not.
9. **FAQ** — a short list (4–6 items) written from what the app actually does and the RLS/moderation facts already documented in `README.md` (e.g. "Czy dodawanie ogłoszenia jest płatne?", "Czy moje dane są bezpieczne?", "Kto moderuje opinie?"). No invented claims beyond what the codebase already states.
10. **CTA band** — keep existing copy/intent, restyle from orange gradient to navy.
11. **Footer** — rebuilt as three real columns:
    - Brand blurb (existing copy, unchanged).
    - "Dla użytkowników": links to the on-page anchors for "Jak to działa" and "FAQ" (real, functional, since those sections now exist on the page).
    - "Bezpieczeństwo": real links to the two new placeholder pages (`/regulamin`, `/polityka-prywatnosci`) and a `mailto:kontakt@obczajone.pl` link for "Zgłoś nadużycie".
    - Bottom bar: current year (computed, not hardcoded, so it never goes stale again), contact email, no more stray English sentence.

## New pages

- `app/regulamin/page.tsx` and `app/polityka-prywatnosci/page.tsx` — simple static pages, new-brand-styled, with a clearly-marked placeholder skeleton (section headings a real terms-of-service/privacy-policy document would need — definitions, scope, user obligations, data processing, contact — each with a short `[Do uzupełnienia: ...]` placeholder note) rather than fabricated legal text. These are marked `robots: noindex` until real content replaces the placeholders (to avoid indexing empty legal pages).

## Other pages (listing detail, profile, admin)

No structural changes. They inherit the new look primarily through the CSS variable swap. Spot-fix the specific hardcoded-orange instance in `listing-client.tsx` noted above. Sweep each page once during implementation to confirm no other hardcoded color classes were missed.

## Non-goals

- No changes to RLS, data model, auth flow, or admin capabilities.
- No fabricated statistics beyond the single figure the site owner explicitly provided.
- No real legal copy for the terms/privacy pages — placeholders only.
- No changes to the partner relationship/content in the promotional banner beyond visual restyling.
