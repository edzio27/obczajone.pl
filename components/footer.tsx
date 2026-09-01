import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/brand/logo-mark';

const COLUMNS = [
  {
    heading: 'Sprawdzanie ofert',
    links: [
      { href: '/#jak-to-dziala', label: 'Jak to działa' },
      { href: '/#faq', label: 'Najczęstsze pytania' },
      { href: '/posrednicy', label: 'Mapa pośredników' },
    ],
  },
  {
    heading: 'Oględziny na żywo',
    links: [
      { href: '/partnerzy', label: 'Katalog firm' },
      { href: '/dla-firm', label: 'Zostań partnerem' },
      { href: '/dla-firm#weryfikacja', label: 'Zasady weryfikacji' },
      { href: '/panel-partnera', label: 'Panel partnera' },
    ],
  },
  {
    heading: 'Formalności',
    links: [
      { href: '/polityka-prywatnosci', label: 'Polityka prywatności' },
      { href: '/regulamin', label: 'Regulamin serwisu' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="surface-ink relative isolate mt-20 overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-ink" />
      <div aria-hidden className="absolute inset-0 grid-lines opacity-50" />

      <div className="container mx-auto px-4 relative">
        {/* Dodatkowy odstęp na dole pod przyklejony pasek akcji na telefonie. */}
        <div className="max-w-6xl mx-auto pt-14 pb-32 md:pb-14">
          <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
            <div>
              <div className="flex items-center gap-2.5">
                <LogoMark className="h-9 w-9" />
                <span className="font-logo text-xl font-extrabold tracking-[-0.03em] text-white">
                  obczajone<span className="text-primary">.pl</span>
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/55 text-pretty">
                Historia cen, opinie kupujących i oględziny na miejscu dla ofert
                z Otomoto i Otodom. Żeby zaliczka nie była pierwszym testem
                uczciwości sprzedającego.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href="/partnerzy"
                  className="inline-flex items-center gap-1.5 rounded-full bg-signal px-3.5 py-2 text-xs font-bold text-signal-foreground transition-transform duration-200 ease-spring hover:scale-[1.03]"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Zamów inspekcję
                </Link>
                <Link
                  href="/posrednicy"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-2 text-xs font-semibold text-white/75 transition-colors hover:border-white/35 hover:text-white"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Mapa pośredników
                </Link>
              </div>
            </div>

            {COLUMNS.map(({ heading, links }) => (
              <div key={heading}>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/40">
                  {heading}
                </h3>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {links.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="group inline-flex items-center gap-1 text-white/65 transition-colors hover:text-white"
                      >
                        {label}
                        <ArrowUpRight className="h-3 w-3 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-60" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {year} obczajone.pl — wszystkie prawa zastrzeżone</p>
            <a
              href="mailto:kontakt@obczajone.pl"
              className="inline-flex items-center gap-2 transition-colors hover:text-white"
            >
              <Mail className="h-4 w-4" />
              kontakt@obczajone.pl
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
