export function trwaBudowanie(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * Ponawia odczyt, gdy API chwilowo nie odpowiada.
 *
 * API Supabase w tym projekcie bywa niedostępne po kilka razy dziennie - wraca
 * po kilkudziesięciu sekundach, ale w międzyczasie potrafi wywrócić budowanie
 * serwisu. To wiązało każdy deploy z dostępnością bazy: w trakcie awarii nie
 * dało się wypchnąć żadnej poprawki, w tym poprawek tej awarii.
 *
 * Dwie sekundy przerwy i trzy podejścia wystarczają na typowy epizod. Jeśli
 * mimo nich nie ma odpowiedzi, wyjątek leci dalej - bo brak danych nie może
 * przebrać się za pusty serwis i trafić do cache'u. To rozróżnienie kosztowało
 * nas 26 września pustą stronę główną serwowaną przez godzinę.
 *
 * Operacja dostaje sygnał przerwania i ma go przekazać do zapytania
 * (`.abortSignal(sygnal)`). Bez tego cała reszta tego pliku jest ozdobą:
 * supabase-js nie ma własnego timeoutu, więc gdy API przyjmuje połączenie
 * i milczy, zapytanie nie kończy się ani sukcesem, ani błędem - po prostu
 * wisi. Żaden catch ani fallback nigdy się nie wykona, bo kod do nich nie
 * dojdzie. Tak padł build 28 września: wyjście awaryjne w sitemapie było
 * napisane poprawnie i nieosiągalne.
 */
export async function ponawiaj<T>(
  opis: string,
  operacja: (sygnal: AbortSignal) => Promise<T>,
  podejscia = 3
): Promise<T> {
  /*
    Przy budowaniu jedno podejście, nie trzy.

    Ponawianie pomaga w czasie żądania: epizod trwa kilkadziesiąt sekund,
    a użytkownik i tak czeka. Przy budowaniu działa odwrotnie - Next przerywa
    generowanie strony po sześćdziesięciu sekundach, a trzy podejścia po
    dwudziestopięciosekundowym timeoucie to ponad siedemdziesiąt. Retry sam
    przewracał wtedy deploy, który miał ratować.
  */
  const limit = trwaBudowanie() ? 1 : podejscia;

  /*
    Przy budowaniu czekamy najwyżej dziesięć sekund - zdrowe API odpowiada
    w sekundę, a deploy nie ma po co czekać dłużej na coś, czego i tak nie
    dostanie. W czasie żądania dajemy więcej miejsca: tam czeka człowiek,
    który wolałby zobaczyć dane z opóźnieniem niż błąd.
  */
  const limitCzasuMs = trwaBudowanie() ? 10_000 : 20_000;
  let ostatni: unknown;

  for (let i = 1; i <= limit; i += 1) {
    try {
      return await operacja(AbortSignal.timeout(limitCzasuMs));
    } catch (error) {
      ostatni = error;
      if (i < limit) {
        console.warn(`${opis}: podejście ${i} z ${limit} nie powiodło się, ponawiam`);
        await new Promise((r) => setTimeout(r, 2000 * i));
      }
    }
  }

  throw new Error(
    `${opis}: nie udało się po ${limit} podejściach — ${
      ostatni instanceof Error ? ostatni.message : String(ostatni)
    }`
  );
}
