'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Point = { label: string; value: number; n: number | null };

function IndexTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: Point = payload[0].payload;
  const change = point.value - 100;
  return (
    <div className="rounded-lg border bg-background px-4 py-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">{point.label}</p>
      <p className="text-base font-semibold text-foreground">
        {point.value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <p className={`text-xs ${change < 0 ? 'text-success' : 'text-muted-foreground'}`}>
        {change > 0 ? '+' : ''}
        {change.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}% od startu pomiarów
      </p>
      {point.n != null && (
        <p className="text-xs text-muted-foreground">{point.n.toLocaleString('pl-PL')} aut w pomiarze</p>
      )}
    </div>
  );
}

/**
 * Indeks cen tych samych aut, 100 = pierwszy tydzień pomiarów.
 *
 * Pierwszy punkt dokładamy tutaj: baza zwraca iloraz za każdy kolejny tydzień,
 * więc tydzień bazowy nie ma własnego wiersza, a bez niego wykres zaczynałby
 * się od 99,4 i wyglądał, jakby coś spadło przed startem.
 */
export function PriceIndexChart({
  points,
}: {
  points: { week: string; value: number; n: number }[];
}) {
  const gradientId = useId();
  if (points.length === 0) return null;

  const first = new Date(points[0].week);
  first.setDate(first.getDate() - 7);
  const data: Point[] = [
    { label: `tydzień od ${format(first, 'd MMM', { locale: pl })}`, value: 100, n: null },
    ...points.map((p) => ({
      label: `tydzień od ${format(new Date(p.week), 'd MMM', { locale: pl })}`,
      value: p.value,
      n: p.n,
    })),
  ];

  const values = data.map((d) => d.value);
  const yMin = Math.floor(Math.min(...values) * 2) / 2 - 0.5;
  const yMax = Math.ceil(Math.max(...values) * 2) / 2 + 0.5;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal vertical={false} stroke="#e5e7eb" strokeOpacity={0.6} />
          <XAxis
            dataKey="label"
            tickFormatter={(v: string) => v.replace('tydzień od ', '')}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={(v) => v.toLocaleString('pl-PL')}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip content={<IndexTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
