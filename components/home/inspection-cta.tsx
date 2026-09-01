import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, CircleDollarSign, FileCheck2, MapPinned, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/motion/reveal';
import type { Partner } from '@/lib/partner-data';

const points = [
  {
    icon: MapPinned,
    title: 'Firma z okolicy oferty',
    description: 'Dobieramy po lokalizacji ogłoszenia i pokazujemy, ile kilometrów ma do przejechania.',
  },
  {
    icon: FileCheck2,
    title: 'Werdykt na piśmie',
    description: 'Polecam / z zastrzeżeniami / odradzam, wraz z tym, co zastała na miejscu.',
  },
  {
    icon: CircleDollarSign,
    title: 'Bez prowizji od oględzin',
    description: 'Zapytanie idzie prosto do firmy. Cenę ustala ona, my nie doliczamy nic od siebie.',
  },
];

/**
 * Sekcja komercyjna strony głównej.
 *
 * Wcześniej jedyne wejście w płatną ścieżkę z tej strony to był link ósemką pod
 * wyszukiwarką. Tutaj argument jest postawiony wprost i w tym miejscu, do
 * którego czytelnik dochodzi już po zobaczeniu, że serwis faktycznie coś
 * sprawdził - a nie przed.
 */
export function InspectionCta({ partners }: { partners: Partner[] }) {
  const faces = partners.filter((p) => p.logo_url).slice(0, 5);

  return (
    <Reveal>
      <section
        className="surface-ink relative isolate mt-20 overflow-hidden rounded-[1.75rem]"
        aria-labelledby="zamow-inspekcje"
      >
        <div aria-hidden className="absolute inset-0 mesh-ink" />
        <div aria-hidden className="absolute inset-0 grid-lines opacity-60" />

        <div className="relative grid gap-10 p-8 md:grid-cols-[1.15fr_1fr] md:p-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/15 px-3 py-1.5 text-xs font-bold text-signal">
              <ShieldCheck className="h-3.5 w-3.5" />
              Oględziny na miejscu
            </div>

            <h2
              id="zamow-inspekcje"
              className="mt-4 text-3xl md:text-[2.6rem] leading-[1.08] font-extrabold text-white text-balance"
            >
              Nie masz jak pojechać 300 km, żeby zobaczyć jedno auto?
            </h2>

            <p className="mt-4 max-w-lg text-[15px] md:text-base leading-relaxed text-white/70 text-pretty">
              Zaliczka wpłacona w ciemno kosztuje więcej niż każde oględziny. Firma
              z okolicy ogłoszenia obejrzy auto albo mieszkanie na żywo, zrobi zdjęcia
              i wystawi werdykt — zanim podejmiesz decyzję.
            </p>

            <div className="mt-7">
              <Button asChild variant="signal" size="xl">
                <Link href="/partnerzy">
                  Znajdź firmę w swoim regionie
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              {faces.length > 0 && (
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {faces.map((partner) => (
                      <span
                        key={partner.id}
                        className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white/20 bg-white"
                        title={partner.name}
                      >
                        <Image
                          src={partner.logo_url!}
                          alt={partner.name}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-white/55">Firmy, które już z nami jeżdżą</span>
                </div>
              )}
            </div>
          </div>

          <ul className="space-y-3 self-center">
            {points.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/[0.05] p-4"
              >
                <span className="icon-tile h-9 w-9 bg-white/10 text-white">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white">{title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60">{description}</p>
                </div>
              </li>
            ))}

            <li className="flex items-start gap-2 px-1 pt-1 text-xs leading-relaxed text-white/45">
              <BadgeCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Kryteria odznaki „Zweryfikowany partner” opisujemy jawnie na stronie{' '}
                <Link href="/dla-firm#weryfikacja" className="underline hover:text-white/70">
                  dla firm
                </Link>
                , a pozycje płatne są oznaczone jako promowane.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </Reveal>
  );
}
