// Ile ogłoszeń realnie dostanie porównanie cenowe. Tylko odczyt.
// Pobieramy stronami, żeby objąć całą bazę, a nie przypadkowy jej wycinek.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const PAGE = 1000;
const all = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from('listings')
    .select('id, current_price, specs')
    .eq('source', 'otomoto')
    .gt('current_price', 0)
    .order('created_at', { ascending: false })
    .range(from, from + PAGE - 1);

  if (error) throw error;
  all.push(...data);
  if (data.length < PAGE) break;
}

console.log(`ogłoszeń otomoto z ceną > 0: ${all.length}`);

const withSpecs = all.filter((l) => l.specs?.brand && l.specs?.model);
console.log(
  `z marką i modelem: ${withSpecs.length} (${((withSpecs.length / all.length) * 100).toFixed(0)}%)`
);

const buckets = new Map();
for (const l of withSpecs) {
  const key = `${l.specs.brand} ${l.specs.model}`;
  buckets.set(key, (buckets.get(key) || 0) + 1);
}

const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
console.log(`różnych modeli: ${sorted.length}`);

console.log('\nnajczęstsze modele:');
for (const [name, n] of sorted.slice(0, 10)) {
  console.log(`   ${String(n).padStart(3)} × ${name}`);
}

// Porównanie potrzebuje 5 INNYCH ofert, czyli 6 sztuk modelu w bazie.
// Sprawdzamy też, co dałoby obniżenie progu.
console.log('\npokrycie przy różnych progach minimalnej próbki:');
for (const min of [3, 4, 5, 6, 8, 10]) {
  const eligible = withSpecs.filter(
    (l) => buckets.get(`${l.specs.brand} ${l.specs.model}`) >= min + 1
  );
  const models = sorted.filter(([, n]) => n >= min + 1).length;
  const pct = ((eligible.length / withSpecs.length) * 100).toFixed(0);
  const mark = min === 5 ? '  <- obecny próg' : '';
  console.log(
    `   >=${String(min).padStart(2)} porównań: ${String(eligible.length).padStart(4)} ogłoszeń (${String(pct).padStart(2)}%), ${String(models).padStart(2)} modeli${mark}`
  );
}
