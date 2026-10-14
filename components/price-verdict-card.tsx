import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Minus, Info, HandCoins } from 'lucide-react';
import type { PriceComparison } from '@/lib/price-comparison';
import type { ModelTrend } from '@/lib/price-trends';
import type { NegotiationHint, PriceVerdict } from '@/lib/price-verdict';

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

const TONE: Record<PriceVerdict['level'], { icon: typeof Minus; className: string }> = {
  okazja: { icon: TrendingDown, className: 'text-success' },
  ponizej: { icon: TrendingDown, className: 'text-success' },
  rynkowa: { icon: Minus, className: 'text-muted-foreground' },
  powyzej: { icon: TrendingUp, className: 'text-warning' },
  wysoka: { icon: TrendingUp, className: 'text-warning' },
};

/**
 * Ocena ceny: czy odstaje od podobnych ofert i ile da się utargować.
 *
 * Zastępuje samą kartę „Cena na tle podobnych ofert”. Mediana odpowiadała na
 * pytanie „czy to drogo”, a kupujący, który ma już link w ręku, pyta przede
 * wszystkim „ile mogę zaproponować”. Na to odpowiada druga połowa karty.
 */
export function PriceVerdictCard({
  comparison,
  verdict,
  negotiation,
  trend,
  trendSlug,
}: {
  comparison: PriceComparison | null;
  verdict: PriceVerdict | null;
  negotiation: NegotiationHint | null;
  trend: ModelTrend | null;
  trendSlug: string | null;
}) {
  if (!comparison && !negotiation) return null;

  const tone = verdict ? TONE[verdict.level] : null;
  const Icon = tone?.icon;

  return (
    <Card className="mb-6" id="ocena-ceny">
      <CardHeader>
        <CardTitle className="text-lg">Ocena ceny</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {verdict && comparison?.sufficient ? (
          <div>
            <div className={`flex items-center gap-2 mb-4 ${tone!.className}`}>
              {Icon && <Icon className="h-6 w-6 flex-shrink-0" />}
              <span className="text-2xl font-bold">{verdict.label}</span>
            </div>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted-foreground">Mediana podobnych ofert</dt>
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
          </div>
        ) : comparison?.sufficient ? (
          <p className="text-sm text-muted-foreground">
            Orientacyjnie: mediana ofert {comparison.criteriaLabel} to{' '}
            <span className="font-semibold text-foreground">{formatPln(comparison.medianPrice!)}</span>.
            W tej grupie są różne wersje i silniki, więc nie oceniamy na tej podstawie ceny
            konkretnego auta.
          </p>
        ) : comparison ? (
          <p className="text-sm text-muted-foreground">
            Mamy w bazie za mało porównywalnych ofert modelu {comparison.criteriaLabel}
            {comparison.sampleSize > 0 && ` (${comparison.sampleSize})`}, żeby uczciwie powiedzieć,
            czy ta cena odstaje.
          </p>
        ) : null}

        {negotiation && trend && (
          <div className="rounded-xl border bg-muted/40 p-4">
            <div className="flex items-center gap-2 mb-2 text-foreground">
              <HandCoins className="h-5 w-5 flex-shrink-0 text-primary" />
              <span className="font-semibold">Propozycja na start rozmowy</span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              ok. {formatPln(negotiation.suggestedOffer)}
              <span className="ml-2 whitespace-nowrap text-base font-medium text-muted-foreground">
                (−{formatPln(negotiation.suggestedDiscount)})
              </span>
            </p>

            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>
                Przy {trend.brand} {trend.model} sprzedający schodzą z ceny w ok.{' '}
                {formatPercent(negotiation.shareDroppedPercent)} ogłoszeń, typowo o{' '}
                {formatPercent(negotiation.typicalDropPercent)}.
              </li>
              {negotiation.alreadyDroppedPercent > 0 && (
                <li>
                  {negotiation.alreadyAtTypical
                    ? `Ten sprzedający już zszedł o ${formatPercent(negotiation.alreadyDroppedPercent)}, czyli co najmniej tyle, ile zwykle. Pole do negocjacji jest mniejsze.`
                    : `Ten sprzedający już zszedł o ${formatPercent(negotiation.alreadyDroppedPercent)}, więc część typowej obniżki ma za sobą.`}
                </li>
              )}
              {verdict && (verdict.level === 'powyzej' || verdict.level === 'wysoka') && (
                <li>
                  Argument do rozmowy: podobne oferty mają medianę{' '}
                  {formatPln(comparison!.medianPrice!)}.
                </li>
              )}
            </ul>

            {trendSlug && (
              <Link
                href={`/ile-spada-cena/${trendSlug}`}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Ile spada cena {trend.brand} {trend.model} →
              </Link>
            )}
          </div>
        )}

        {/*
          Bez tego zdania liczby są nieweryfikowalne, a przy okazji byłyby
          nadużyciem: liczymy z ofert, które mamy u siebie, a nie z całego rynku.
        */}
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            {verdict &&
              comparison?.sufficient &&
              `Mediana z ${comparison.sampleSize} ofert w naszej bazie: ${comparison.criteriaLabel}. `}
            {negotiation &&
              trend &&
              `Obniżki z ${trend.sampleSize} obserwowanych ogłoszeń ${trend.brand} ${trend.model}. `}
            To ceny ofertowe, nie transakcyjne. Propozycja to punkt wyjścia do rozmowy, nie wycena.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
