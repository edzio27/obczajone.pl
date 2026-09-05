'use client';

import { Card, CardContent } from '@/components/ui/card';
import { FileSearch, ExternalLink } from 'lucide-react';
import { logAffiliateClick, type AffiliateClickContext } from '@/lib/affiliate-clicks';

/*
  Program partnerski konfigurujemy zmiennymi, a nie w kodzie, bo link zawiera
  identyfikator konta i bywa zmieniany bez udziału programisty. Dopóki nie są
  ustawione, blok płatny w ogóle się nie renderuje - lepiej nie pokazać nic niż
  pokazać przycisk prowadzący donikąd.
*/
const AFFILIATE_URL = process.env.NEXT_PUBLIC_VIN_AFFILIATE_URL;
const AFFILIATE_NAME = process.env.NEXT_PUBLIC_VIN_AFFILIATE_NAME;
const AFFILIATE_PROVIDER = process.env.NEXT_PUBLIC_VIN_AFFILIATE_PROVIDER;

type VinCheckCtaProps = {
  context: AffiliateClickContext;
  /** Tylko na stronie ogłoszenia - na stronie modelu nie ma jednego auta. */
  listingId?: string;
};

/**
 * Zaproszenie do sprawdzenia historii pojazdu po numerze VIN.
 *
 * Dlaczego nie ma tu przycisku „sprawdź to auto": VIN-u nie mamy i mieć nie
 * będziemy. Otomoto szyfruje `vin`, `registration` i `date_registration` przy
 * każdym żądaniu osobno - to token wymieniany na numer przez ich własne API,
 * a nie zamaskowana wartość do odczytania. Numer musi więc przyjść od
 * sprzedającego i to jest treść tej karty.
 *
 * Kolejność bloków nie jest przypadkowa. Najpierw bezpłatny rejestr rządowy,
 * dopiero potem raport płatny - odwrotna kolejność sprzedawałaby coś, co w
 * części da się mieć za darmo, i to na stronie, której jedyną wartością jest
 * mówienie kupującemu rzeczy, których sprzedający mu nie powie. Zaufanie jest
 * tu aktywem, z którego bierze się przychód, a nie kosztem przychodu.
 */
export function VinCheckCta({ context, listingId }: VinCheckCtaProps) {
  const hasAffiliate = Boolean(AFFILIATE_URL && AFFILIATE_NAME && AFFILIATE_PROVIDER);

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <FileSearch className="h-5 w-5 text-muted-foreground shrink-0" />
          <h3 className="font-semibold">
            {context === 'listing'
              ? 'Sprawdź historię tego auta po numerze VIN'
              : 'Zanim pojedziesz oglądać — sprawdź VIN'}
          </h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          VIN-u nie ma w ogłoszeniu — Otomoto go ukrywa. Poproś o niego
          sprzedającego przed obejrzeniem auta. Jeśli odmawia bez powodu, to sam
          w sobie jest odpowiedź, której szukasz.
        </p>

        <div className="space-y-3">
          <div className="rounded-lg border p-4">
            <p className="text-sm font-medium">Najpierw za darmo</p>
            <p className="text-sm text-muted-foreground mt-1">
              Rządowy rejestr <strong>historiapojazdu.gov.pl</strong> pokaże
              przebiegi z przeglądów, datę pierwszej rejestracji i to, czy auto
              było w Polsce rozbite. Potrzebujesz VIN-u, numeru rejestracyjnego
              i daty pierwszej rejestracji.
            </p>
            <a
              href="https://historiapojazdu.gov.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-2 hover:underline"
            >
              Otwórz bezpłatny rejestr
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {hasAffiliate && (
            <div className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">Gdy auto jeździło za granicą</p>
                {/*
                  Oznaczenie jest obowiązkowe i ma być widoczne, a nie schowane
                  w stopce - płacimy prowizję od tego kliknięcia.
                */}
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  Link partnerski
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Rejestr rządowy widzi tylko polską część historii. Płatny raport{' '}
                {AFFILIATE_NAME} dokłada zagraniczne przebiegi, zdjęcia z aukcji
                powypadkowych i zapisy o szkodach — czyli dokładnie to, co
                sprzedający „sprowadzonego, bezwypadkowego" woli przemilczeć.
              </p>
              <a
                href={AFFILIATE_URL}
                target="_blank"
                /*
                  `sponsored` to wymóg Google dla linków płatnych, `noopener`
                  odcina otwartej stronie dostęp do naszej przez window.opener.
                */
                rel="sponsored nofollow noopener noreferrer"
                onClick={() =>
                  logAffiliateClick(AFFILIATE_PROVIDER as string, context, listingId)
                }
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-2 hover:underline"
              >
                Sprawdź VIN w {AFFILIATE_NAME}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
