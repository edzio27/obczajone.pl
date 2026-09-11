'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import type { CityPrices } from '@/lib/city-prices';

const AXIS = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' };

/**
 * Cena metra miasto po mieście.
 *
 * To jedyna liczba na tej stronie, która da się porównać między miastami -
 * mediana ceny ofertowej nie, bo w jednym mieście obserwujemy kawalerki,
 * a w innym trzypokojowe. Metr kwadratowy zrównuje jedno z drugim.
 */
export function CityPricesChart({ data }: { data: CityPrices[] }) {
  const rows = data
    .filter((c) => c.medianPricePerM2 != null)
    .sort((a, b) => (b.medianPricePerM2 ?? 0) - (a.medianPricePerM2 ?? 0))
    .map((c) => ({
      name: c.city,
      perM2: c.medianPricePerM2 as number,
      listings: c.listings,
    }));

  return (
    <div style={{ height: Math.max(280, rows.length * 38) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 72, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            /*
              Górna granica zaokrąglona w górę do pełnych 5 tys., żeby podziałka
              wypadała na 5, 10, 15, 20 - a nie na "19 tys.", co wygląda jak
              literówka, mimo że jest poprawne.
            */
            domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.05) / 5000) * 5000]}
            tickFormatter={(v: number) => `${Math.round(v / 1000)} tys.`}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={92}
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
              `${Number(value).toLocaleString('pl-PL')} zł/m² — z ${item.payload.listings} ogłoszeń`,
              'Mediana',
            ]}
          />
          <Bar dataKey="perM2" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))" maxBarSize={24}>
            <LabelList
              dataKey="perM2"
              position="right"
              formatter={(v: any) => `${Number(v).toLocaleString('pl-PL')} zł`}
              style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
