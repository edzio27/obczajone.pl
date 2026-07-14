'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { TrendingDown } from 'lucide-react';
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

type Snapshot = {
  id: string;
  price: number;
  title: string;
  description: string;
  scraped_at: string;
};

type PriceHistoryProps = {
  snapshots: Snapshot[];
};

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-base font-semibold text-gray-900">
          {payload[0].value.toLocaleString('pl-PL')} zł
        </p>
      </div>
    );
  }
  return null;
}

export function PriceHistory({ snapshots }: PriceHistoryProps) {
  const gradientId = useId();

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brak historii</CardTitle>
          <CardDescription>
            Nie mamy jeszcze żadnych danych historycznych dla tego ogłoszenia
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime()
  );

  const data = sorted.map((s) => ({
    date: format(new Date(s.scraped_at), 'd MMM yyyy', { locale: pl }),
    price: s.price,
  }));

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const priceDiff = lastPrice - firstPrice;

  const yMin = Math.floor((minPrice * 0.97) / 500) * 500;
  const yMax = Math.ceil((maxPrice * 1.03) / 500) * 500;

  const minPoint = data.find((d) => d.price === minPrice);
  const maxPoint = data.find((d) => d.price === maxPrice);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-primary" />
          Historia ceny
        </CardTitle>
        <CardDescription>
          {snapshots.length === 1
            ? 'Mamy tylko jeden pomiar dla tego ogłoszenia'
            : `${snapshots.length} pomiarów ceny`}
          {snapshots.length > 1 && priceDiff !== 0 && (
            <span
              className={`ml-2 font-medium ${priceDiff < 0 ? 'text-success' : 'text-warning'}`}
            >
              {priceDiff < 0 ? '' : '+'}
              {priceDiff.toLocaleString('pl-PL')} zł od pierwszego pomiaru
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
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
        {snapshots.length > 2 && minPrice !== maxPrice && (
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-success inline-block" />
              Najniższa: {minPrice.toLocaleString('pl-PL')} zł
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-destructive inline-block" />
              Najwyższa: {maxPrice.toLocaleString('pl-PL')} zł
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
