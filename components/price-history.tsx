'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Bell, TrendingDown } from 'lucide-react';
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
  /** Kiedy ostatnio sprawdzaliśmy cenę, także bez zmiany. */
  lastCheckedAt?: string | null;
  /** Element z zapisem na powiadomienie, do którego przewija przycisk. */
  watchTargetId?: string;
};

function changesLabel(count: number): string {
  if (count === 1) return '1 zmiana ceny';
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  const few = lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14);
  return `${count} ${few ? 'zmiany' : 'zmian'} ceny`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-base font-semibold text-gray-900">
          {payload[0].value.toLocaleString('pl-PL')} zł
        </p>
        {payload[0].payload?.checkOnly && (
          <p className="text-xs text-gray-500 mt-0.5">ostatnie sprawdzenie, cena bez zmian</p>
        )}
      </div>
    );
  }
  return null;
}

export function PriceHistory({ snapshots, lastCheckedAt, watchTargetId }: PriceHistoryProps) {
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

  const changes = sorted.map((s) => ({
    date: format(new Date(s.scraped_at), 'd MMM yyyy', { locale: pl }),
    price: s.price,
  }));

  /*
    Jeden punkt to nie „jeden pomiar”. Od 14 września zapisujemy cenę tylko
    wtedy, gdy się zmieni, więc jeden punkt znaczy „cena stoi od tego dnia”.
    Wykres z jedną kropką na całą szerokość strony nic nie mówił, a od
    14 października stoi zaraz pod zdjęciem.
  */
  if (sorted.length === 1) {
    const only = sorted[0];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Historia ceny
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-foreground">
            Cena <span className="font-semibold">{only.price.toLocaleString('pl-PL')} zł</span> bez
            zmian od {format(new Date(only.scraped_at), 'd MMMM yyyy', { locale: pl })}.
          </p>
          {lastCheckedAt && (
            <p className="text-sm text-muted-foreground">
              Ostatnio sprawdzona{' '}
              {formatDistanceToNow(new Date(lastCheckedAt), { addSuffix: true, locale: pl })}.
              Każdą zmianę dopiszemy tutaj.
            </p>
          )}
          {watchTargetId && (
            <Button
              variant="outline"
              onClick={() => {
                const target = document.getElementById(watchTargetId);
                target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target?.querySelector('input')?.focus({ preventScroll: true });
              }}
            >
              <Bell className="h-4 w-4 mr-2" />
              Powiadom mnie, gdy cena spadnie
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  /*
    Punkt „sprawdzone dziś”. W bazie nowy wiersz powstaje tylko przy zmianie
    ceny, więc bez tego wykres kończył się na ostatniej zmianie, czasem sprzed
    miesiąca, choć oglądane ogłoszenia sprawdzamy codziennie. Ten punkt nie jest
    zapisem z bazy, tylko `last_checked_at` z ceną, która wtedy wciąż była.
  */
  const lastChangeAt = new Date(sorted[sorted.length - 1].scraped_at).getTime();
  const checkedAt = lastCheckedAt ? new Date(lastCheckedAt).getTime() : null;
  const data: { date: string; price: number; checkOnly?: boolean }[] = [...changes];
  if (checkedAt && checkedAt - lastChangeAt > 12 * 60 * 60 * 1000) {
    data.push({
      date: format(new Date(checkedAt), 'd MMM yyyy', { locale: pl }),
      price: sorted[sorted.length - 1].price,
      checkOnly: true,
    });
  }

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
          {changesLabel(sorted.length - 1)} od{' '}
          {format(new Date(sorted[0].scraped_at), 'd MMMM yyyy', { locale: pl })}
          {priceDiff !== 0 && (
            <span
              className={`ml-2 font-medium ${priceDiff < 0 ? 'text-success' : 'text-warning'}`}
            >
              {priceDiff < 0 ? '' : '+'}
              {priceDiff.toLocaleString('pl-PL')} zł od pierwszego pomiaru
            </span>
          )}
          {checkedAt && (
            <span className="block mt-1">
              Ostatnio sprawdzona{' '}
              {formatDistanceToNow(new Date(checkedAt), { addSuffix: true, locale: pl })}.
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
                // Schodki, nie krzywa: między pomiarami cena stała, a spadek
                // nastąpił gdzieś przed punktem, w którym go zauważyliśmy.
                // Gładka linia sugerowała tanienie po trochu przez cały miesiąc.
                type="stepAfter"
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
