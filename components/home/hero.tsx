import Link from 'next/link';
import { ArrowRight, BadgeCheck, Gauge, MapPin, ShieldCheck, Star, Zap } from 'lucide-react';
import { ListingUrlForm } from '@/components/listing-url-form';
import { CountUp } from '@/components/motion/count-up';
import type { HomeStats } from '@/lib/home-data';

type HeroProps = {
  stats: HomeStats;
};

/**
 * Nagłówek strony głównej.
 *
 * Rozstrzyga rzecz, której poprzednia wersja nie rozstrzygała: serwis prowadzi
 * dwie różne sprawy naraz - darmowe sprawdzenie ogłoszenia i płatne oględziny
 * na miejscu. Do wczoraj ta druga wisiała pod wyszukiwarką jako linijka tekstu
 * ósemką, mimo że to jedyne miejsce, w którym pojawiają się pieniądze. Teraz
 * obie ścieżki stoją obok siebie jako równorzędne karty, a płatna ma kolor
 * zarezerwowany wyłącznie dla niej.
 */
export function Hero({ stats }: HeroProps) {
  // Liczba poniżej progu działa gorzej niż jej brak - "12 sprawdzonych ogłoszeń"
  // mówi odwiedzającemu, że jest tu pierwszy.
  const tiles = [
    { value: stats.listingCount, min: 100, label: 'sprawdzonych ogłoszeń', icon: Gauge },
    { value: stats.inspectionCount, min: 1, label: 'oględzin na żywo', icon: BadgeCheck },
    { value: stats.reviewCount, min: 5, label: 'opinii od kupujących', icon: Star },
    { value: stats.partnerCount, min: 1, label: 'firm w katalogu', icon: MapPin },
  ].filter((t): t is typeof t & { value: number } => t.value != null && t.value >= t.min);

  return (
    <section className="surface-ink relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 mesh-ink" />
      <div aria-hidden className="absolute inset-0 grid-lines mask-fade-b opacity-70" />
      {/* Miękkie przejście w tło strony, żeby ciemna sekcja nie kończyła się linią. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background"
      />

      <div className="container mx-auto px-4 relative">
        <div className="max-w-6xl mx-auto pt-14 pb-24 md:pt-20 md:pb-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-signal animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
              </span>
              Otomoto i Otodom — historia cen, opinie, oględziny
            </div>

            <h1
              className="mt-5 text-[2.6rem] leading-[1.02] sm:text-6xl md:text-[4.25rem] font-extrabold text-white text-balance animate-fade-in"
              style={{ animationDelay: '60ms' }}
            >
              Sprawdź, zanim
              <br className="hidden sm:block" />{' '}
              <span className="relative inline-block">
                <span className="relative z-10">kupisz.</span>
                <span
                  aria-hidden
                  className="absolute inset-x-[-0.06em] bottom-[0.02em] z-0 h-[0.16em] rounded-full bg-signal"
                />
              </span>
            </h1>

            <p
              className="mt-5 max-w-xl text-base md:text-lg text-white/70 leading-relaxed text-pretty animate-fade-in"
              style={{ animationDelay: '120ms' }}
            >
              Zdjęcia w ogłoszeniu pokazują tylko to, co sprzedający chciał pokazać.
              My pokazujemy historię ceny, opinie tych, którzy już tam pojechali —
              a jeśli trzeba, wysyłamy kogoś na miejsce.
            </p>
          </div>

          <div className="mt-8 animate-fade-in" style={{ animationDelay: '180ms' }}>
            <ListingUrlForm tone="ink" />
          </div>

          {/* Dwie drogi, dwa kafelki. Lewy - to, po co ludzie tu trafiają
              z Google. Prawy - to, z czego serwis żyje. */}
          <div
            className="mt-10 grid gap-4 sm:grid-cols-2 max-w-3xl animate-fade-in"
            style={{ animationDelay: '240ms' }}
          >
            <Link
              href="#ostatnio-sprawdzone"
              className="group rounded-2xl border border-white/12 bg-white/[0.05] p-5 transition-all duration-300 ease-spring hover:bg-white/[0.09] hover:border-white/25 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3.5">
                <span className="icon-tile h-10 w-10 bg-primary/20 text-primary">
                  <Zap className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-white">Sprawdzam sam</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                    Historia ceny, opinia AI i komentarze innych kupujących. Za darmo,
                    bez zakładania konta.
                  </p>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/85 group-hover:gap-2.5 transition-all">
                    Zobacz przykłady
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>

            <Link
              href="/partnerzy"
              className="group relative overflow-hidden rounded-2xl border border-signal/30 bg-signal/[0.09] p-5 transition-all duration-300 ease-spring hover:bg-signal/[0.14] hover:border-signal/50 hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-3.5">
                <span className="icon-tile h-10 w-10 bg-signal text-signal-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-bold text-white">Niech ktoś pojedzie za mnie</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/65">
                    Firma z okolicy obejrzy auto lub mieszkanie na żywo i wystawi werdykt,
                    zanim wpłacisz zaliczkę.
                  </p>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-signal group-hover:gap-2.5 transition-all">
                    Zamów inspekcję
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          </div>

          {tiles.length > 0 && (
            <div
              className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-6 animate-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              {tiles.map(({ value, label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-white/35" />
                  <div>
                    <div className="text-2xl md:text-3xl font-extrabold text-white tabular leading-none">
                      <CountUp value={value} />
                    </div>
                    <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/45 font-semibold">
                      {label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
