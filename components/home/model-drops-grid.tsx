import Link from 'next/link';
import { ArrowRight, HandCoins } from 'lucide-react';
import { SectionHeading } from '@/components/home/section-heading';
import { Reveal } from '@/components/motion/reveal';
import type { ModelTrend } from '@/lib/price-trends';

function formatPln(value: number): string {
  return `${Math.round(value).toLocaleString('pl-PL')} zł`;
}

function formatPercent(value: number): string {
  return `${value.toLocaleString('pl-PL', { maximumFractionDigits: 1 })}%`;
}

/**
 * Pierwsza sekcja pod wyszukiwarką: ile da się utargować na popularnych modelach.
 *
 * Wcześniej stało tu „Ostatnio sprawdzone”, które w praktyce pokazywało
 * mieszkania z Otodom z dopiskiem „Brak lokalizacji”, bo przelot dokłada je
 * co godzinę. Ktoś, kto przyszedł z Google po historię ceny auta, widział
 * serwis o czymś innym. Te liczby są za to tylko nasze: bierzemy je
 * z obserwowanych obniżek, a Otomoto ich nie pokazuje.
 */
export function ModelDropsGrid({ trends }: { trends: ModelTrend[] }) {
  const withDrops = trends.filter((t) => t.medianDropPercent != null && t.sampleSize > 0);
  if (withDrops.length === 0) return null;

  return (
    <section className="pt-4" aria-labelledby="ile-da-sie-utargowac">
      <SectionHeading
        id="ile-da-sie-utargowac"
        eyebrow="Ile da się utargować"
        icon={HandCoins}
        title="Jak schodzą z ceny sprzedający popularnych aut"
        description="Policzone z obniżek, które sami zaobserwowaliśmy na Otomoto. Przy każdym ogłoszeniu podpowiadamy też, od jakiej kwoty zacząć rozmowę."
        action={{ href: '/ile-spada-cena', label: 'Wszystkie modele' }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {withDrops.map((t, index) => (
          // Na telefonie cztery: dziewięć kart jedna pod drugą to ekran przewijania,
          // zanim ktoś dojdzie do obniżek. Reszta jest pod „Wszystkie modele”.
          <Reveal
            key={t.slug}
            delay={index * 50}
            className={index >= 4 ? 'hidden sm:block' : undefined}
          >
            <Link
              href={`/ile-spada-cena/${t.slug}`}
              className="group block h-full rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-bold text-foreground">
                  {t.brand} {t.model}
                </h3>
                <span className="text-2xl font-extrabold text-success">
                  −{formatPercent(t.medianDropPercent!)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Tanieje co {Math.max(1, Math.round(t.sampleSize / Math.max(t.droppedCount, 1)))}. ogłoszenie
                {t.medianDropPln != null && <>, typowo o {formatPln(t.medianDropPln)}</>}.
                {t.medianPrice != null && <> Mediana ceny: {formatPln(t.medianPrice)}.</>}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground/80 group-hover:gap-2.5 transition-all">
                Zobacz, ile spada cena
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
