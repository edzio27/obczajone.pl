# ListingCard overflow fix

## Context

The July 11 horizontal `ListingCard` redesign overflows its grid column at real desktop widths: in the homepage's `grid md:grid-cols-2 lg:grid-cols-3` layout, each column is only ~360px wide at a typical 1280px viewport. The price/date row (`flex-row` above the `sm` breakpoint) assumes viewport width implies card width, which is false inside a multi-column grid — the price and `whitespace-nowrap` date can't both fit on one line at that column width, and the date text visibly spills outside the card's rounded border. Confirmed via screenshot at 1280px viewport.

## Fix

Two changes to `components/listing-card.tsx`, no new dependencies:

1. **Image size**: fixed `w-24 h-24` at all breakpoints (was `w-28 sm:w-36`, which grew *larger* on wider viewports — the opposite of helpful inside a narrow grid column — leaving less room for text exactly when the column is narrowest relative to viewport).
2. **Price/date row**: always stacked vertically (price on top, date in small muted text directly below) — remove the `sm:flex-row sm:items-end sm:justify-between sm:gap-2` conditional entirely, so it never attempts a side-by-side layout regardless of viewport width. This guarantees no overflow at any grid column width without needing CSS container queries.

No changes to the rest of the card (badge/rating row, title, location) — those aren't overflowing in the screenshots.

## Verification

Screenshot the homepage's 3-column grid at 1280px (the width that reproduced the bug) and confirm no text bleeds past any card's border, then re-check mobile (375px) to confirm the existing single-column mobile layout still looks right.
