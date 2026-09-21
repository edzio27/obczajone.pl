import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/*
  Jedyne zadanie tego pliku: sprowadzić adres odznaki do jednej z dwóch postaci.

  Klucz cache'u na brzegu Vercela obejmuje query string, więc `/badge/<slug>?r=1`
  to dla niego inny zasób niż `/badge/<slug>` - a każdy nowy klucz to pełne
  wywołanie funkcji i zapytanie do bazy. Przy losowym parametrze ta przestrzeń
  jest nieskończona, czyli ktoś z pętlą w bashu mógłby nam przepalić budżet CPU
  i dołożyć t4g.nano tyle zapytań, ile mu się zechce. Cztery firmy i mało znany
  endpoint sprawiają, że to na razie teoria - ale jest to jedyny sposób, w jaki
  ta trasa może realnie zaboleć, a zamknięcie go kosztuje kilkanaście linijek.

  Przekierowanie, nie `rewrite`: przy rewrite nadal zależelibyśmy od tego, czy
  brzeg liczy klucz cache'u przed nim, czy po nim, a tego nie chcę zgadywać.
  Przekierowanie rozstrzyga sprawę niezależnie od tej semantyki - odpowiada
  samo middleware, funkcja nie rusza, baza nie rusza, a `<img src>` idzie za
  308 tak samo przezroczyście jak przeglądarka.

  `theme` zostaje, bo to jedyny parametr, który cokolwiek zmienia w obrazku;
  `theme=light` jest wartością domyślną, więc zwija się do adresu bez query,
  żeby nie robić trzeciego wpisu w cache'u na to samo SVG.
*/
export function middleware(request: NextRequest) {
  const url = request.nextUrl;

  const canonical = url.clone();
  canonical.search = '';
  if (url.searchParams.get('theme') === 'dark') {
    canonical.searchParams.set('theme', 'dark');
  }

  if (canonical.search === url.search) {
    return NextResponse.next();
  }

  return NextResponse.redirect(canonical, 308);
}

export const config = {
  matcher: '/badge/:slug*',
};
