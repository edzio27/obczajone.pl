/*
  Odtwarza markę i model z adresu ogłoszenia dla tych wpisów, którym scraper ich
  nie zapisał. To one blokują statystyki obniżek: w bazie jest 171 ogłoszeń,
  które realnie staniały, ale 130 z nich nie ma marki, więc wypadają z liczenia.

  Źródłem nie jest Otomoto, tylko slug w URL-u ("bmw-seria-5-ID6HY67f") zestawiony
  ze słownikiem par marka/model zbudowanym z ogłoszeń, które specs już mają.
  Dzięki temu nie zgadujemy - przypisujemy tylko takie pary, które w tej bazie
  już występują - i nie zależymy od tego, czy ogłoszenie jeszcze żyje.

  Domyślnie tylko raportuje. Zapis: node scripts/backfill-model-from-url.mjs --apply
*/
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { slugifyModel } from './model-slug.mjs';
import { specsFromUrl } from './otomoto-url-specs.mjs';

const APPLY = process.argv.includes('--apply');
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key);

/** Slug z adresu Otomoto: /oferta/<marka-model>-ID<id>.html, bez parametrów. */
function slugFromUrl(url) {
  if (!url) return null;
  const m = url.split('?')[0].match(/\/oferta\/(.+?)-ID[A-Za-z0-9]+\.html/);
  return m ? m[1] : null;
}

const listings = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('listings')
    .select('id, url, title, specs, source')
    .eq('source', 'otomoto').order('id', { ascending: true }).range(from, from + 999);
  if (error) throw error;
  listings.push(...data);
  if (data.length < 1000) break;
}

const known = new Map();
for (const r of listings) {
  const brand = r.specs?.brand?.trim(), model = r.specs?.model?.trim();
  if (!brand || !model) continue;
  const slug = slugifyModel(brand, model);
  if (!known.has(slug)) known.set(slug, { brand, model });
}

/*
  Trzy ogloszenia maja URL zepsuty przy recznym wklejaniu ("lhttps://...",
  "https:/www...", "http://..."). Constraint listings_url_matches_source dodano
  jako NOT VALID, wiec przy zapisie przeszly, ale KAZDY pozniejszy UPDATE na
  nich pada - lacznie z zapisem ceny przez dzienny scraper. Sa zamrozone od maja.

  Naprawiamy je przed backfillem i w tej samej transakcji, bo inaczej jeden taki
  wiersz wywraca caly skrypt. Poprawiamy wylacznie ksztalt adresu; jesli po
  naprawie nadal nie spelnia constraintu, zostawiamy wiersz w spokoju.
*/
const URL_OK = /^https:\/\/(www\.)?(otomoto|otodom)\.pl\//i;

function repairUrl(url) {
  if (!url) return null;
  let fixed = url.slice(url.search(/https?:/i));      // smieci przed schematem
  fixed = fixed.replace(/^https?:\/+/i, 'https://');  // http -> https, "https:/" -> "https://"
  return URL_OK.test(fixed) ? fixed : null;
}

const broken = listings.filter((r) => !URL_OK.test(r.url || ''));
const repairs = [];
for (const r of broken) {
  const fixed = repairUrl(r.url);
  if (fixed && fixed !== r.url) repairs.push({ id: r.id, from: r.url, to: fixed });
}
const unrepairable = new Set(
  broken.filter((r) => !repairUrl(r.url)).map((r) => r.id)
);

const missing = listings.filter(
  (r) => (!r.specs?.brand?.trim() || !r.specs?.model?.trim()) && !unrepairable.has(r.id)
);
const matched = [], unmatched = new Map();
for (const r of missing) {
  const slug = slugFromUrl(r.url);
  if (!slug) continue;
  const hit = known.get(slug);
  if (hit) { matched.push({ row: r, ...hit, how: 'slownik' }); continue; }
  const split = specsFromUrl(r.url);
  if (split) matched.push({ row: r, ...split, how: 'marka+reszta' });
  else unmatched.set(slug, (unmatched.get(slug) || 0) + 1);
}

console.log(`ogłoszeń Otomoto: ${listings.length}`);
console.log(`słownik par marka/model: ${known.size}`);
console.log(`URL-e do naprawy: ${repairs.length}${unrepairable.size ? `, nie do uratowania: ${unrepairable.size}` : ''}`);
for (const r of repairs) console.log(`  ${JSON.stringify(r.from.slice(0, 46))} → ${JSON.stringify(r.to.slice(0, 46))}`);
console.log(`bez marki/modelu: ${missing.length}`);
console.log(`  → da się odtworzyć z URL-a: ${matched.length}`);
console.log(`     ze słownika par: ${matched.filter((m) => m.how === 'slownik').length}`);
console.log(`     po nazwie marki: ${matched.filter((m) => m.how === 'marka+reszta').length}`);
console.log(`  → slug nieznany w bazie: ${[...unmatched.values()].reduce((a, b) => a + b, 0)}`);
console.log('\nnajczęstsze nieznane slugi:', [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10));
console.log('\nprzykłady dopasowań po nazwie marki:');
for (const m of matched.filter((x) => x.how === 'marka+reszta').slice(0, 10))
  console.log(`  ${slugFromUrl(m.row.url)} → ${m.brand} / ${m.model}`);

// Ile obniżek to odsłoni - jedyna liczba, dla której to robimy.
const filled = new Map(matched.map((m) => [m.row.id, m]));
const snaps = [];
for (let f = 0; ; f += 1000) {
  const { data } = await db.from('listing_snapshots').select('listing_id, price, scraped_at')
    .order('scraped_at', { ascending: true }).range(f, f + 999);
  snaps.push(...(data || []));
  if ((data || []).length < 1000) break;
}
const firstPrice = new Map();
for (const s of snaps) if (!firstPrice.has(s.listing_id)) firstPrice.set(s.listing_id, Number(s.price));

const priceById = new Map();
for (let f = 0; ; f += 1000) {
  const { data } = await db.from('listings').select('id, current_price')
    .gt('current_price', 0).order('id', { ascending: true }).range(f, f + 999);
  for (const r of data || []) priceById.set(r.id, Number(r.current_price));
  if ((data || []).length < 1000) break;
}

function modelOf(r) {
  const b = r.specs?.brand?.trim(), m = r.specs?.model?.trim();
  if (b && m) return `${b} ${m}`;
  const f = filled.get(r.id);
  return f ? `${f.brand} ${f.model}` : null;
}
function stats(useFilled) {
  const groups = new Map();
  for (const r of listings) {
    const key = useFilled ? modelOf(r) : (r.specs?.brand?.trim() && r.specs?.model?.trim() ? `${r.specs.brand.trim()} ${r.specs.model.trim()}` : null);
    if (!key || !priceById.has(r.id)) continue;
    (groups.get(key) || groups.set(key, []).get(key)).push(r);
  }
  const passing = [...groups.entries()].filter(([, v]) => v.length >= 5);
  let drops = 0;
  for (const [, rows] of passing)
    for (const r of rows) {
      const fp = firstPrice.get(r.id);
      if (fp > 0 && fp - priceById.get(r.id) > 0) drops++;
    }
  return { models: passing.length, drops };
}
const before = stats(false), after = stats(true);
console.log(`\nSTRONY MODELI:  teraz ${before.models}  →  po backfillu ${after.models}`);
console.log(`OBNIŻKI W STATYSTYKACH:  teraz ${before.drops}  →  po backfillu ${after.drops}`);

if (process.argv.includes('--sql')) {
  /*
    Anon key nie ma prawa UPDATE na listings (polityki RLS daja tylko INSERT
    i SELECT), wiec bez klucza serwisowego zapis idzie przez panel Supabase.
    jsonb_build_object + || dopisuje marke i model, nie ruszajac reszty specs.
  */
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  const urlLines = repairs.map(
    (r) => `UPDATE listings SET url = ${q(r.to)} WHERE id = ${q(r.id)};`
  );
  const lines = matched.map(
    (m) => `UPDATE listings SET specs = COALESCE(specs, '{}'::jsonb) || jsonb_build_object('brand', ${q(m.brand)}, 'model', ${q(m.model)}) WHERE id = ${q(m.row.id)};`
  );
  writeFileSync('scripts/backfill-model-from-url.sql',
    `-- Wygenerowane przez scripts/backfill-model-from-url.mjs --sql.\n` +
    `--\n` +
    `-- 1. Naprawa ${repairs.length} adresow zepsutych przy recznym wklejaniu. Bez tego\n` +
    `--    kazdy UPDATE na tych wierszach lamie constraint listings_url_matches_source\n` +
    `--    (dodany jako NOT VALID, wiec stare wiersze go nie przeszly) - te ogloszenia\n` +
    `--    nie przyjmuja tez zapisu ceny z dziennego scrapera.\n` +
    `-- 2. Marka i model dla ${matched.length} ogloszen, odtworzone z ich adresow.\n` +
    `--    Odslania to obnizki, ktore juz sa w bazie, ale wypadaja ze statystyk.\n` +
    `--\n` +
    `-- Bezpieczne do powtorzenia.\nBEGIN;\n` +
    (urlLines.length ? urlLines.join('\n') + '\n' : '') +
    lines.join('\n') + `\nCOMMIT;\n`);
  console.log(`\nzapisano scripts/backfill-model-from-url.sql (${urlLines.length} napraw URL + ${lines.length} backfill)`);
  process.exit(0);
}

if (!APPLY) {
  console.log('\n(próba na sucho — nic nie zapisano; uruchom z --apply, żeby zapisać, lub z --sql po plik SQL)');
  process.exit(0);
}

for (const r of repairs) {
  const { error } = await db.from('listings').update({ url: r.to }).eq('id', r.id);
  if (error) console.error(`nie udalo sie naprawic URL ${r.id}:`, error.message);
}

let ok = 0, fail = 0;
for (const m of matched) {
  const merged = { ...(m.row.specs ?? {}), brand: m.brand, model: m.model };
  const { error } = await db.from('listings').update({ specs: merged }).eq('id', m.row.id);
  if (error) { if (fail === 0) console.error('błąd zapisu:', error.message); fail++; } else ok++;
}
console.log(`\nzapisano: ${ok}, błędów: ${fail}`);
