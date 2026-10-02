'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/*
  Granica błędu dla całego serwisu.

  Strony ogłoszeń powstają przy pierwszym wejściu (`dynamicParams`), więc gdy
  baza nie odpowiada, nie mają z czego się zbudować. Kod rzuca wtedy wyjątkiem
  i robi to celowo: wcześniej zwracał 404, a zapieczony 404 na istniejące
  ogłoszenie wypisywał nam strony z Google i trzymał się długo po powrocie bazy.
  Wyjątek daje 500, czyli "nasza wina, wróć później" - wyszukiwarka zrozumie to
  poprawnie i nie skasuje adresu.

  Czego przedtem brakowało: bez tego pliku Next oddawał gołą białą stronę
  z napisem "500: Internal Server Error". Kliknięcie w kafelek podobnego
  ogłoszenia wyglądało jak zepsuty link, bo nawigacja kończyła się niczym.
  Status zostaje ten sam, zmienia się tylko to, co widzi człowiek.

  Nie ma tu Headera ani Footera świadomie: oba pobierają dane, a ta strona
  pokazuje się właśnie wtedy, gdy pobieranie zawodzi.
*/
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Strona nie mogła się wyświetlić:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Chwilowa przerwa
        </p>

        <h1 className="mt-3 text-2xl md:text-3xl font-extrabold text-balance">
          Nie udało się wczytać tej strony
        </h1>

        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground text-pretty">
          Nasza baza danych chwilowo nie odpowiada. To problem po naszej stronie,
          nie po Twojej — ogłoszenie nie zniknęło i za moment powinno się wczytać.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Spróbuj ponownie
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Wróć na stronę główną
          </Link>
        </div>

        {/*
          Odnośniki do stron, które przy awarii bazy i tak działają: są
          statyczne albo odświeżane co godzinę, więc serwują się z cache'u.
          Zamiast ślepej uliczki czytelnik dostaje coś, co faktycznie otworzy.
        */}
        <div className="mt-10 border-t pt-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            W międzyczasie
          </p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 justify-center text-sm">
            <Link href="/obnizki" className="underline underline-offset-4 hover:no-underline">
              Największe obniżki
            </Link>
            <Link href="/archiwum-otomoto" className="underline underline-offset-4 hover:no-underline">
              Archiwum ogłoszeń
            </Link>
            <Link href="/ile-spada-cena" className="underline underline-offset-4 hover:no-underline">
              Ile spada cena
            </Link>
            <Link href="/barometr" className="underline underline-offset-4 hover:no-underline">
              Barometr obniżek
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
