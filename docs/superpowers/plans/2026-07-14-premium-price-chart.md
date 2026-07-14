# Premium Price Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the price history chart into a gradient-filled area chart matching the site's navy/blue brand, per `docs/superpowers/specs/2026-07-14-premium-price-chart.md`.

**Architecture:** Single-file change to `components/price-history.tsx` — swap Recharts' `LineChart`/`Line` for `AreaChart`/`Area` with a gradient `<defs>`, recolor everything from hardcoded hex to the existing `--primary`/`--success`/`--destructive` design tokens, and adjust sizing/grid for more whitespace. No data or props change.

**Tech Stack:** No new dependencies — `recharts` (already installed) supports `AreaChart`/`Area` and gradient fills natively.

## Global Constraints

- Presentational-only change — `PriceHistoryProps`, the snapshot data shape, and the empty/single-snapshot states stay exactly as they are today.
- Line color is fixed brand blue, not dynamic based on trend direction (confirmed with the site owner).

---

### Task 1: Restyle the chart

**Files:**
- Modify: `components/price-history.tsx`

- [ ] **Step 1: Replace the Recharts imports**

Replace:

```tsx
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts';
```

with:

```tsx
import { useId } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
} from 'recharts';
```

- [ ] **Step 2: Generate a unique gradient id**

Replace:

```tsx
export function PriceHistory({ snapshots }: PriceHistoryProps) {
  if (snapshots.length === 0) {
```

with:

```tsx
export function PriceHistory({ snapshots }: PriceHistoryProps) {
  const gradientId = useId();

  if (snapshots.length === 0) {
```

- [ ] **Step 3: Taller chart container**

Replace:

```tsx
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
```

with:

```tsx
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeOpacity={0.6} />
```

- [ ] **Step 4: Replace the `Line` with a gradient-filled `Area`, drop per-point dots**

Replace:

```tsx
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="price"
                stroke="#f97316"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#ea580c', strokeWidth: 0 }}
              />
              {snapshots.length > 2 && minPrice !== maxPrice && minPoint && (
                <ReferenceDot
                  x={minPoint.date}
                  y={minPoint.price}
                  r={5}
                  fill="#16a34a"
                  stroke="white"
                  strokeWidth={2}
                />
              )}
              {snapshots.length > 2 && minPrice !== maxPrice && maxPoint && (
                <ReferenceDot
                  x={maxPoint.date}
                  y={maxPoint.price}
                  r={5}
                  fill="#dc2626"
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
```

with:

```tsx
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                animationDuration={800}
              />
              {snapshots.length > 2 && minPrice !== maxPrice && minPoint && (
                <ReferenceDot
                  x={minPoint.date}
                  y={minPoint.price}
                  r={5}
                  fill="hsl(var(--success))"
                  stroke="white"
                  strokeWidth={2}
                />
              )}
              {snapshots.length > 2 && minPrice !== maxPrice && maxPoint && (
                <ReferenceDot
                  x={maxPoint.date}
                  y={maxPoint.price}
                  r={5}
                  fill="hsl(var(--destructive))"
                  stroke="white"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
```

- [ ] **Step 5: Recolor the min/max legend dots to design tokens**

Replace:

```tsx
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-600 inline-block" />
              Najniższa: {minPrice.toLocaleString('pl-PL')} zł
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
              Najwyższa: {maxPrice.toLocaleString('pl-PL')} zł
            </span>
```

with:

```tsx
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-success inline-block" />
              Najniższa: {minPrice.toLocaleString('pl-PL')} zł
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-destructive inline-block" />
              Najwyższa: {maxPrice.toLocaleString('pl-PL')} zł
            </span>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx next lint`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/price-history.tsx
git commit -m "Restyle price history chart: gradient area fill, brand blue, more whitespace"
```

---

### Task 2: Verification and push

- [ ] **Step 1: Visual check**

Using this project's preview tooling: navigate to a listing with a multi-point price history (e.g. the Nissan Juke listing used earlier this session, id `79889b29-d0f3-4b06-a320-457b5775b2cc`). Confirm:
- Chart is visibly taller than before.
- Area under the line has a light blue gradient fill fading to transparent.
- Line is blue (`#175CE0`-ish), thicker, with no visible dot at every data point.
- Grid shows only light horizontal lines, no vertical lines.
- Min/max markers and legend dots are green/red (via `--success`/`--destructive`), not the old hardcoded hex.

- [ ] **Step 2: Push**

```bash
git push origin main
```

Expected: push succeeds.

- [ ] **Step 3: Final report**

Confirm to the user: chart restyled, screenshot showing the new look, commit pushed. Also note this was the last item from the original ChatGPT proposal list worked through this session.
