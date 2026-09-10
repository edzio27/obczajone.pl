'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts';
import type { ModelDrop, DropBucket } from '@/lib/barometer-data';

/*
  Wykresy używają recharts, bo tym samym narysowana jest historia cen na
  stronie ogłoszenia - dwie biblioteki do wykresów w jednym serwisie znaczyłyby
  dwa różne wyglądy tego samego rodzaju treści.
*/

const AXIS = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

/**
 * Ile realnie schodzą sprzedający, model po modelu.
 *
 * Obok każdego słupka stoi wielkość próbki, bo to ona decyduje, czy liczbę
 * wolno potraktować poważnie. Ranking bez próbki zachęca do porównywania
 * modelu z trzema przecenami z modelem, który ma ich dwadzieścia pięć.
 */
export function ModelDropsChart({ data }: { data: ModelDrop[] }) {
  const rows = data.map((d) => ({
    name: `${d.brand} ${d.model}`,
    percent: d.medianDropPercent,
    drops: d.drops,
  }));

  return (
    <div style={{ height: Math.max(280, rows.length * 34) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            unit="%"
            domain={[0, 'dataMax + 1']}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 13,
            }}
            formatter={(value: any, _n: any, item: any) => [
              `${value}% — z ${item.payload.drops} przecen`,
              'Typowa obniżka',
            ]}
          />
          <Bar dataKey="percent" radius={[0, 6, 6, 0]} maxBarSize={22}>
            {rows.map((row) => (
              // Słupki oparte na mniejszej próbce są celowo bledsze - to jedyny
              // sposób, żeby wykres sam mówił, czemu można ufać bardziej.
              <Cell
                key={row.name}
                fill="hsl(var(--primary))"
                fillOpacity={row.drops >= 10 ? 1 : row.drops >= 5 ? 0.7 : 0.45}
              />
            ))}
            <LabelList
              dataKey="drops"
              position="right"
              formatter={(v: any) => `${v} przecen`}
              style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Jak duże są obniżki, gdy już się zdarzą. */
export function DropDistributionChart({ data }: { data: DropBucket[] }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 13,
            }}
            formatter={(value: any) => [`${value} ogłoszeń`, 'W tym przedziale']}
          />
          <Bar dataKey="listings" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" maxBarSize={64}>
            <LabelList
              dataKey="listings"
              position="top"
              style={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
