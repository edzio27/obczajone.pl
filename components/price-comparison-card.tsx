import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus, Info } from 'lucide-react';
import type { PriceComparison } from '@/lib/price-comparison';

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

/** Poniżej tego progu różnica jest szumem, a nie sygnałem. */
const MEANINGFUL_DIFFERENCE_PERCENT = 3;

export function PriceComparisonCard({ comparison }: { comparison: PriceComparison }) {
  if (!comparison.sufficient) {
    return (
      <Card className="mb-6 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Cena na tle podobnych ofert</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Mamy w bazie za mało ofert modelu {comparison.criteriaLabel}
            {comparison.sampleSize > 0 && ` (tylko ${comparison.sampleSize})`}, żeby policzyć
            wiarygodną medianę. Wrócimy do tego, gdy uzbiera się ich więcej.
          </p>
        </CardContent>
      </Card>
    );
  }

  const percent = comparison.percentVsMedian ?? 0;
  const isCheaper = percent < -MEANINGFUL_DIFFERENCE_PERCENT;
  const isPricier = percent > MEANINGFUL_DIFFERENCE_PERCENT;

  const Icon = isCheaper ? TrendingDown : isPricier ? TrendingUp : Minus;
  const tone = isCheaper ? 'text-success' : isPricier ? 'text-warning' : 'text-muted-foreground';

  const headline = isCheaper
    ? `${Math.abs(percent).toFixed(0)}% poniżej mediany`
    : isPricier
      ? `${percent.toFixed(0)}% powyżej mediany`
      : 'Cena zbliżona do mediany';

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Cena na tle podobnych ofert</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`flex items-center gap-2 mb-4 ${tone}`}>
          <Icon className="h-6 w-6 flex-shrink-0" />
          <span className="text-2xl font-bold">{headline}</span>
        </div>

        <dl className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <dt className="text-xs text-muted-foreground">Mediana</dt>
            <dd className="text-lg font-semibold text-foreground">
              {formatPln(comparison.medianPrice!)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Typowy przedział</dt>
            <dd className="text-lg font-semibold text-foreground">
              {formatPln(comparison.lowerQuartile!)} – {formatPln(comparison.upperQuartile!)}
            </dd>
          </div>
        </dl>

        {/*
          Bez tego zdania liczba jest nieweryfikowalna, a przy okazji byłaby
          nadużyciem: liczymy medianę z ofert, które mamy u siebie, a nie z całego
          rynku. Użytkownik ma prawo wiedzieć, na czym stoi.
        */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Na podstawie {comparison.sampleSize} ofert w naszej bazie — {comparison.criteriaLabel}.
            To ceny ofertowe, nie transakcyjne.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
