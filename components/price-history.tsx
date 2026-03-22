'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

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

export function PriceHistory({ snapshots }: PriceHistoryProps) {
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

  const priceChanges = [];
  for (let i = 0; i < snapshots.length - 1; i++) {
    const current = snapshots[i];
    const previous = snapshots[i + 1];
    const priceDiff = current.price - previous.price;

    priceChanges.push({
      date: current.scraped_at,
      currentPrice: current.price,
      previousPrice: previous.price,
      difference: priceDiff,
      title: current.title,
    });
  }

  if (snapshots.length === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Historia zmian</CardTitle>
          <CardDescription>Mamy tylko jeden snapshot tego ogłoszenia</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-lg">{snapshots[0].price.toLocaleString('pl-PL')} zł</p>
                  <p className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(snapshots[0].scraped_at), {
                      addSuffix: true,
                      locale: pl,
                    })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">{snapshots[0].title}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historia zmian ceny</CardTitle>
        <CardDescription>
          Śledziliśmy {snapshots.length} {snapshots.length === 1 ? 'zmianę' : 'zmiany'} w tym ogłoszeniu
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="border-l-4 border-blue-500 pl-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">{snapshots[0].price.toLocaleString('pl-PL')} zł</p>
                <p className="text-sm text-gray-500">
                  Aktualna cena (sprawdzone{' '}
                  {formatDistanceToNow(new Date(snapshots[0].scraped_at), {
                    addSuffix: true,
                    locale: pl,
                  })}
                  )
                </p>
              </div>
            </div>
          </div>

          {priceChanges.map((change, idx) => {
            const isPriceDown = change.difference < 0;
            const isPriceUp = change.difference > 0;

            return (
              <div
                key={idx}
                className={`border-l-4 pl-4 py-2 ${
                  isPriceDown
                    ? 'border-green-500'
                    : isPriceUp
                    ? 'border-red-500'
                    : 'border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{change.currentPrice.toLocaleString('pl-PL')} zł</p>
                      {isPriceDown && (
                        <span className="flex items-center text-green-600 text-sm">
                          <TrendingDown className="h-4 w-4 mr-1" />
                          {Math.abs(change.difference).toLocaleString('pl-PL')} zł
                        </span>
                      )}
                      {isPriceUp && (
                        <span className="flex items-center text-red-600 text-sm">
                          <TrendingUp className="h-4 w-4 mr-1" />
                          +{change.difference.toLocaleString('pl-PL')} zł
                        </span>
                      )}
                      {!isPriceDown && !isPriceUp && (
                        <span className="flex items-center text-gray-500 text-sm">
                          <Minus className="h-4 w-4 mr-1" />
                          Bez zmian
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(change.date), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="border-l-4 border-gray-300 pl-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {snapshots[snapshots.length - 1].price.toLocaleString('pl-PL')} zł
                </p>
                <p className="text-sm text-gray-500">
                  Pierwsza cena (
                  {formatDistanceToNow(new Date(snapshots[snapshots.length - 1].scraped_at), {
                    addSuffix: true,
                    locale: pl,
                  })}
                  )
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
