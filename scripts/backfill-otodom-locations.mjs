/*
  Uzupełnia lokalizację ogłoszeń z Otodomu, którym scraper jej nie zapisał.

  Ogłoszenia zbierane przed poprawką odczytu miasta mają `location = ''`, bo
  Otodom przeniósł te dane, a obie stare ścieżki zwracały pustkę bez błędu.
  Dzienny przebieg tego nie naprawi: czyta cenę i parametry, nigdy lokalizację.

  Skrypt nie pobiera stron sam - wywołuje funkcję scrape-listing, czyli tę samą
  drogę, którą idzie wklejenie linku przez użytkownika. Dzięki temu nie ma tu
  drugiej kopii parsera, która mogłaby rozjechać się z pierwszą.

  Uruchamiać dopiero PO wdrożeniu poprawionej funkcji scrape-listing.
*/
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const db = createClient(SUPABASE_URL, ANON_KEY);

/** Odstęp między wywołaniami - każde z nich pobiera stronę z Otodomu. */
const DELAY_MS = 2500;

const { data: missing, error } = await db
  .from('listings')
  .select('id, url, location')
  .eq('source', 'otodom')
  .eq('is_active', true)
  .eq('location', '');

if (error) {
  console.error('Nie udało się pobrać listy:', error.message);
  process.exit(1);
}

console.log(`ogłoszeń bez lokalizacji: ${missing.length}`);

let uzupelnione = 0;
let bezZmian = 0;

for (const [i, listing] of missing.entries()) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-listing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: listing.id }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { data: po } = await db
      .from('listings').select('location').eq('id', listing.id).single();

    if (po?.location) {
      uzupelnione++;
      console.log(`  [${i + 1}/${missing.length}] ${po.location}`);
    } else {
      bezZmian++;
      console.log(`  [${i + 1}/${missing.length}] nadal pusto (oferta zdjęta?)`);
    }
  } catch (e) {
    bezZmian++;
    console.log(`  [${i + 1}/${missing.length}] błąd: ${e.message}`);
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\nuzupełnione: ${uzupelnione} | bez zmian: ${bezZmian}`);
