/*
  Uzupełnia współrzędne ogłoszeń z Otodomu zapisanych, zanim scraper zaczął je
  czytać. Tak jak przy backfillu lokalizacji: wywołuje funkcję scrape-listing,
  a nie parsuje stron samodzielnie, żeby nie powstała druga kopia parsera.

  Uruchamiać PO wgraniu migracji z kolumnami lat/lng i PO wdrożeniu
  poprawionego scrape-listing.
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

const DELAY_MS = 2500;

const { data: missing, error } = await db
  .from('listings')
  .select('id, url, location')
  .eq('source', 'otodom')
  .eq('is_active', true)
  .is('lat', null);

if (error) {
  console.error('Nie udało się pobrać listy:', error.message);
  process.exit(1);
}

console.log(`ogłoszeń bez współrzędnych: ${missing.length}`);

let ok = 0;
let bez = 0;

for (const [i, listing] of missing.entries()) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-listing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: listing.id }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const { data: po } = await db
      .from('listings').select('lat, lng, location').eq('id', listing.id).single();

    if (po?.lat != null && po?.lng != null) {
      ok++;
      console.log(`  [${i + 1}/${missing.length}] ${po.location}: ${po.lat.toFixed(4)}, ${po.lng.toFixed(4)}`);
    } else {
      bez++;
      console.log(`  [${i + 1}/${missing.length}] brak współrzędnych (oferta zdjęta?)`);
    }
  } catch (e) {
    bez++;
    console.log(`  [${i + 1}/${missing.length}] błąd: ${e.message}`);
  }

  await new Promise((r) => setTimeout(r, DELAY_MS));
}

console.log(`\nuzupełnione: ${ok} | bez zmian: ${bez}`);
