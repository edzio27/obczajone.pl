# ListingCard Overflow Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the price/date text overflowing past the card border in the homepage's 3-column grid at real desktop widths.

**Architecture:** Two isolated Tailwind class changes in `components/listing-card.tsx` — a fixed (non-responsive-growing) image size, and an always-vertical price/date stack instead of a viewport-width-triggered side-by-side row.

**Tech Stack:** No new dependencies.

## Global Constraints

- No changes outside `components/listing-card.tsx`.
- Image size becomes a fixed `w-24 h-24` at all breakpoints (was `w-28 sm:w-36`).
- Price/date block is always a vertical stack (price, then date below) — never side-by-side, at any viewport width.

---

### Task 1: Fix the image size and price/date layout

**Files:**
- Modify: `components/listing-card.tsx`

- [ ] **Step 1: Make the image a fixed size**

Replace:

```tsx
          <div className="w-28 sm:w-36 aspect-square flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
```

with:

```tsx
          <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
```

(dropping `aspect-square` in favor of an explicit `h-24` since the container is no longer variable-width — this keeps the image exactly square at all times without relying on the `aspect-ratio` CSS property computing off a responsive width.)

- [ ] **Step 2: Always stack price and date vertically**

Replace:

```tsx
            <div className="mt-auto pt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
              <div>
                <p className="text-xl font-bold text-primary whitespace-nowrap">
                  {current_price.toLocaleString('pl-PL')} zł
                </p>
                {priceChangePercent != null && (
                  <PriceChangeBadge percent={priceChangePercent} />
                )}
              </div>
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(created_at), {
                  addSuffix: true,
                  locale: pl,
                })}
              </p>
            </div>
```

with:

```tsx
            <div className="mt-auto pt-2">
              <p className="text-xl font-bold text-primary">
                {current_price.toLocaleString('pl-PL')} zł
              </p>
              {priceChangePercent != null && (
                <PriceChangeBadge percent={priceChangePercent} />
              )}
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(created_at), {
                  addSuffix: true,
                  locale: pl,
                })}
              </p>
            </div>
```

(dropping `whitespace-nowrap` on both the price and the date — with a guaranteed-own-line layout, wrapping is no longer a failure mode, and removing it means an unusually long relative-date string, e.g. after a locale change, degrades by wrapping instead of overflowing.)

- [ ] **Step 3: Verify types and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx next lint`
Expected: no new errors.

- [ ] **Step 4: Visual verification at the width that reproduced the bug**

Using this project's preview tooling: resize the browser viewport to `1280x900` (not a named "desktop" preset if that maps to something else — the bug reproduces specifically in a 3-column grid at this width) and reload the homepage. Confirm:
- No text (price, date, or anything else) visibly extends past any card's rounded border.
- Price is on its own line, date directly below it in small muted text.
- The `otomoto`/`otodom` badge + star rating row still fits on one line without wrapping.

Then resize to `375x812` (mobile) and confirm the single-column layout still looks correct (this was already working before this fix, just confirm it didn't regress).

- [ ] **Step 5: Commit**

```bash
git add components/listing-card.tsx
git commit -m "Fix ListingCard price/date overflow in the 3-column desktop grid"
```

---

### Task 2: Push

- [ ] **Step 1: Push to origin**

This work landed directly on `main` per the site owner's prior instruction ("spushuj wszystko na main"). Push:

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 2: Final report**

Confirm to the user: the overflow bug is fixed, screenshots taken at both the bug-reproducing width (1280px) and mobile (375px), commit pushed.
