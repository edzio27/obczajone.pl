import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo-mark';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white mt-14">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <LogoMark className="h-8 w-8" />
                <h3 className="font-logo font-extrabold text-lg uppercase tracking-tight">
                  <span className="text-navy">Obczajone</span>
                  <span className="text-primary">.pl</span>
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Obczaj zanim kupisz.</p>
              <p className="text-gray-600 text-sm leading-relaxed">
                Portal do weryfikacji ogłoszeń z Otomoto i Otodom.
                Pomagamy kupującym podejmować świadome decyzje.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Dla użytkowników</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/#jak-to-dziala" className="hover:text-primary transition-colors">
                    Jak to działa?
                  </Link>
                </li>
                <li>
                  <Link href="/#faq" className="hover:text-primary transition-colors">
                    Najczęstsze pytania
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-4">Bezpieczeństwo</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>
                  <Link href="/polityka-prywatnosci" className="hover:text-primary transition-colors">
                    Polityka prywatności
                  </Link>
                </li>
                <li>
                  <Link href="/regulamin" className="hover:text-primary transition-colors">
                    Regulamin serwisu
                  </Link>
                </li>
                <li>
                  <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
                    Zgłoś nadużycie
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-8 text-center text-gray-600 text-sm">
            <p>&copy; {year} obczajone.pl — wszystkie prawa zastrzeżone</p>
            <p className="mt-2">
              Kontakt:{' '}
              <a href="mailto:kontakt@obczajone.pl" className="hover:text-primary transition-colors">
                kontakt@obczajone.pl
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
