# Premium price history chart

## Context

Last item from the external redesign proposal referenced throughout this session — item 5, "Wykres", inspired by Google Finance / Apple Stocks / TradingView: more whitespace, a thicker line, subtle animation. `components/price-history.tsx` currently renders a plain Recharts `LineChart` in hardcoded orange (`#f97316`), which also no longer matches the navy/blue brand established earlier this session.

## Visual changes

1. **Chart type**: switch from `LineChart` to `AreaChart` with a linear gradient fill under the curve — from the line color at ~25% opacity down to fully transparent. This is the single most recognizable "premium price chart" visual signature (Google Finance, Apple Stocks, Robinhood all use it).
2. **Line color**: `hsl(var(--primary))` (`#175CE0`) — replacing the hardcoded orange, consistent with the rest of the site. Not dynamic (doesn't flip to red/green based on trend direction) — confirmed with the site owner, since "green" would be ambiguous here (a price *drop* is good news for a buyer, the opposite of typical stock-chart convention).
3. **Line weight**: `strokeWidth` 2.5 → 3.
4. **No per-point dots**: `dot={false}` on the area/line — only the hover `activeDot` renders, for a clean continuous curve instead of a dotted line.
5. **More vertical space**: chart container height 224px (`h-56`) → 288px (`h-72`).
6. **Lighter grid**: `CartesianGrid` shows horizontal lines only (`horizontal={true} vertical={false}`), at a lighter stroke than today.
7. **Min/max reference dots**: keep the existing "najniższa/najwyższa" markers and legend, but recolor them from hardcoded hex (`#16a34a` / `#dc2626`) to the design tokens `hsl(var(--success))` / `hsl(var(--destructive))`, matching how the rest of the site already expresses "good/bad" price signals.
8. **Load animation**: keep Recharts' built-in draw-in animation (already on by default), with an explicit `animationDuration` (~800ms) rather than leaving it implicit, so behavior doesn't silently change if a future Recharts upgrade changes its default.

## Non-goals

- No new data — this is a pure presentational change to `components/price-history.tsx`. No changes to `lib/price-change.ts`, the scraper, or how snapshots are fetched.
- No changes to the empty/single-snapshot states (still plain "Brak historii" / "Mamy tylko jeden pomiar" cards) — only the populated multi-point chart is being restyled.
- No changes to the `ListingScoreCard` or any other component that reads price-change data — only the chart's own visual rendering.

## Verification

- Visual check on a listing with a multi-point price history (e.g. the Renault TRAFIC or Nissan Juke listings used earlier this session): confirm gradient fill, blue line, no per-point dots, taller chart, lighter grid, correctly colored min/max dots.
- `npx tsc --noEmit` / `npx next lint` clean.
