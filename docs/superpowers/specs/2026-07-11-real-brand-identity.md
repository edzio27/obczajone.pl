# Real brand identity rollout (Brand Guide assets)

## Context

On July 10 this branch went through a from-scratch rebrand (navy `#0F2A4A` / green `#16A34A`, Space Grotesk + Manrope, a ring-and-checkmark monogram) because no real brand assets existed yet. The site owner has since provided actual designer-made brand assets in `/Users/eugeniusz.keptia/Downloads/Rebranding cesly.pl i logo (1)/`:

- `Brand Guide - obczajone.pl.png` — defines the real color palette, fonts, and CSS custom-property names.
- `obczajone.pl - Light v3.png` — the canonical logo lockup: a chat-bubble icon with a white checkmark (indigo→cyan gradient) plus the "obczajone.pl" wordmark and the tagline "ogłoszenia i opinie" (the tagline is misspelled in the graphic itself — "ogłoszeria i opjnie" — this is a graphic-production typo, not a naming decision; the correct Polish spelling is used everywhere in code/copy).
- `Facebook Cover - obczajone.pl.png` — a social-media collateral image using an *alternate* icon (magnifying glass + stars). Confirmed with the site owner: this is not canonical; the checkmark bubble from "Light v3" is the one and only logo mark going forward.

This spec supersedes the July 10 rebrand's invented color/font/logo system entirely. It does not touch anything else that rebrand built (homepage structure, listing card layout, pagination, price-change feature) — those stay exactly as they are and simply inherit the new colors through the existing CSS-variable token system, the same way they picked up the July 10 palette automatically.

## Logo mark

Recreated as an SVG (matching the existing pattern from July 10: a `LogoMark` React component plus copies inlined into each `next/server` `ImageResponse` generator, since Satori can't consume a shared component):

- Shape: a rounded-square chat bubble with a small tail at the bottom-left corner (the classic "speech bubble" silhouette from the reference image), corner radius roughly a quarter of the bubble's width.
- Fill: linear gradient, indigo `#4F46E5` (top-left) → cyan `#06B6D4` (bottom-right), matching the Brand Guide's Primary and Accent colors exactly (the gradient is not a separate color decision — it's literally Primary-to-Accent).
- Mark: a bold, rounded white checkmark centered in the bubble, matching the reference image's stroke weight.

## Design tokens

Full replacement of the shadcn CSS variables in `app/globals.css`, computed from the Brand Guide's exact hex values:

| Token | Hex | HSL (stored value) | Used for |
|---|---|---|---|
| `--primary` | `#4F46E5` | `243 75% 59%` | Primary buttons, links, brand-colored UI |
| `--navy` (new) | `#1E1B4B` | `244 47% 20%` | Dark surfaces (CTA band, apple-icon/OG background) |
| `--accent` | `#06B6D4` | `189 94% 43%` | shadcn's generic hover/highlight token (ghost/outline button hover, dropdown item hover) — intentionally wired to the real Accent color this time, since the Brand Guide defines Accent as a genuine secondary-interaction color, not something to keep neutral |
| `--background` | `#F8F9FA` | `209 17% 98%` | Page background (replaces pure white) |
| `--success` (renamed from `--verified`) | `#16A34A` | `142 76% 36%` | Price-drop badges, "verified" signals |
| `--warning` (new) | `#F59E0B` | `38 92% 50%` | Price-increase badges (replaces `--destructive` for this specific use — destructive stays reserved for real errors/delete actions) |
| `--foreground` | `#1F2937` | `215 28% 17%` | Body text |
| `--muted-foreground` | `#6B7280` | `220 9% 46%` | Secondary/muted text |
| `--radius` | `10px` | `0.625rem` | Replaces the current `0.75rem` (12px) |

`--primary-foreground` stays white (`0 0% 100%`) — white text reads correctly on both the new indigo primary and the navy. `--destructive` (red, existing shadcn default) is untouched — still used for real error states. `--card`, `--popover`, `--border`, `--input`, `--secondary`, `--muted`, and the `--chart-*` series are not specified by the Brand Guide and are left exactly as the July 10 rebrand set them — they're near-neutral light grays that don't clash with the new palette. The one exception is `--ring` (the focus-ring color), which is re-pointed to track the new `--primary` value (`243 75% 59%`), matching the existing pattern where the focus ring is always primary-derived rather than an independent color.

Tailwind config gets a new `success` and `warning` color pair (`DEFAULT`/`foreground`, same pattern as the existing `verified` entry it replaces) and a `navy` color, all sourced from the corresponding CSS variables.

## Typography

`app/layout.tsx` swaps its font loader from Space Grotesk + Manrope to **Manrope (headings)** + **Inter (body)** — the reverse pairing of what the July 10 rebrand used, but following the exact same technical pattern (`next/font/google`, CSS variables, `font-heading`/`font-sans` Tailwind utilities wired in `globals.css`'s base layer). Manrope drops down to become the heading font instead of body; Inter becomes the new body font (replacing Manrope's old body role). Weights: Manrope `600`/`700` for headings, Inter default variable weight range for body (`400`–`600` per the Brand Guide).

## Tagline in the header

`components/header.tsx` gains a small tagline under/beside the wordmark: "Ogłoszenia i opinie" (correct spelling), styled as small muted text, visible next to "obczajone.pl" — matching the Brand Guide reference layout. Mobile: the tagline can wrap or hide below a breakpoint if it crowds the header (implementer's call during the visual check, not a new design decision — the constraint is it must not cause header overflow/wrapping of the logo row itself).

## Price-change badge color semantics

`components/listing-card.tsx`'s `PriceChangeBadge` and the equivalent inline block in `app/listing/[id]/listing-client.tsx` currently use `text-verified`/`text-destructive`. Both are updated to use the renamed `text-success` for a price drop and the new `text-warning` for a price increase. The "no change" neutral case is unaffected (already just muted-foreground text).

## Non-goals

- No changes to homepage structure, listing card layout, pagination, or the price-change *feature* itself (only its badge colors) — all from the July 10–11 work stay as-is.
- No changes to RLS, auth, business logic, or the promotional partner banner's content (only its colors, which already flow from the `--primary` token and need no separate edit).
- The Facebook Cover asset's alternate icon (magnifying glass + stars) is not implemented anywhere.
- No new legal/marketing copy beyond the tagline itself.
