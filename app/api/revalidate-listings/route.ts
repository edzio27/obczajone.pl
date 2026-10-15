import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

/*
  Odświeżenie stron ogłoszeń na żądanie scrapera.

  Strony ogłoszeń mają `revalidate = 86400`, bo przy krótszym czasie crawler
  Google regenerował czternaście tysięcy stron i kładł bazę (23 września).
  Przez to cena sprawdzona przez scraper trafiała na stronę nawet dobę
  później: 14 października BMW potaniało o 15 tys. zł, a strona dalej
  pokazywała stan sprzed pięciu dni.

  Teraz scraper po każdej porcji wysyła tu identyfikatory, które właśnie
  sprawdził. `revalidatePath` tylko oznacza stronę jako nieaktualną; render
  i zapytanie do bazy przychodzą dopiero z następnym wejściem. Crawler dalej
  dostaje cache, a odświeżamy wyłącznie to, co scraper faktycznie dotknął.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tyle, ile scraper może sprawdzić w jednym przebiegu (BATCH_SIZE). */
const MAX_IDS = 25;

export async function POST(request: Request) {
  // trim(): wartość wklejona w panelu Vercela potrafi przynieść ze schowka
  // znak nowej linii, a wtedy żaden nagłówek jej nie odpowie.
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'REVALIDATE_SECRET nie jest ustawiony' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Brak dostępu' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length > MAX_IDS || !ids.every((id) => typeof id === 'string' && UUID.test(id))) {
    return NextResponse.json({ error: 'Oczekuję listy do 25 identyfikatorów ogłoszeń' }, { status: 400 });
  }

  for (const id of ids) {
    revalidatePath(`/listing/${id}`);
  }

  return NextResponse.json({ revalidated: ids.length });
}
