import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { trwaBudowanie } from './retry';

/*
  Jedno miejsce, w którym powstaje serwerowy klient Supabase - i jedyne, w
  którym da się ustawić limit czasu na zapytanie.

  supabase-js nie ma własnego timeoutu, a `fetch` w Node czeka bez końca. Gdy
  API przyjmuje połączenie i milczy - a tak wygląda tutejsza awaria, nie
  odmową, tylko ciszą - zapytanie nie kończy się ani sukcesem, ani błędem.
  Wszystkie wyjścia awaryjne rozstawione po stronach były wtedy nieosiągalne:
  kod nie dochodził do `if (error)`, bo wisiał na `await`. Budowanie serwisu
  padało po kolei na sitemapie, barometrze, archiwum, partnerach i werdyktach,
  a każda kolejna łatka dokładała obsługę błędu, który nigdy nie nadchodził.

  Limit należy do warstwy HTTP, nie do osiemnastu wywołań createClient
  rozsypanych po stronach - dlatego siedzi w jednym `fetch`, a nie w kolejnej
  warstwie ponad zapytaniami.
*/

/**
 * Ile czekamy na odpowiedź API.
 *
 * Przy budowaniu dziesięć sekund: zdrowe API odpowiada w sekundę, a deploy nie
 * ma po co czekać na coś, czego nie dostanie - Next i tak przerywa stronę po
 * sześćdziesięciu.
 *
 * W czasie żądania sześć, nie dwadzieścia. Poprzednia wartość była zła z dwóch
 * powodów. Vercel liczy czas wykonania funkcji, więc każde żądanie wiszące na
 * martwej bazie to rachunek za czekanie - a przy awariach po kilka razy dziennie
 * płacimy za nie regularnie. I nikt nie czeka dwudziestu sekund na stronę:
 * zdrowe API odpowiada tutaj w kilkadziesiąt milisekund, więc wszystko powyżej
 * kilku sekund to już nie wolna baza, tylko baza, której nie ma.
 */
function limitCzasuMs(): number {
  return trwaBudowanie() ? 10_000 : 6_000;
}

function fetchZLimitem(wejscie: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  /*
    Gdy wywołujący sam ustawił sygnał przez `.abortSignal(...)`, ma już swój
    limit i nie nadpisujemy go - inaczej krótsze zapytanie dostałoby cudzy,
    dłuższy termin, a dłuższe zostałoby ucięte w połowie.
  */
  if (init?.signal) return fetch(wejscie, init);

  return fetch(wejscie, { ...init, signal: AbortSignal.timeout(limitCzasuMs()) });
}

/**
 * Klient do odczytów serwerowych: strony, metadane, sitemapa, route handlery.
 *
 * Każde zapytanie kończy się w skończonym czasie - sukcesem albo błędem, który
 * strona potrafi obsłużyć. To jedyna różnica wobec gołego createClient i cały
 * powód istnienia tego pliku.
 */
export function klientSerwerowy(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: fetchZLimitem },
    }
  );
}
