/*
  Wykonuje plik .sql na bazie produkcyjnej.

  Powstało, żeby zmiany w schemacie i harmonogramie nie wymagały ręcznego
  wklejania do SQL Editora. Wcześniej każda migracja i każde przełączenie crona
  było osobną rundą „przygotowałem plik — wklej — daj znać", a przy awarii
  bazy oznaczało to, że nie dało się nic naprawić bez człowieka przy klawiaturze.

  Użycie:
    node scripts/run-sql.mjs scripts/step1-resume-price-sweep.sql
    node scripts/run-sql.mjs --dry scripts/... # tylko pokaż, co poszłoby

  Hasło bierze się z SUPABASE_DB_PASSWORD w .env.local (plik jest w .gitignore).
  Adres poolera trzyma CLI w supabase/.temp/pooler-url, więc nie ma go tu na
  sztywno - gdyby Supabase zmienił region albo host, nie trzeba nic poprawiać.

  Skrypt NIE opakowuje niczego w transakcję. Część z tego, co uruchamiamy -
  cron.schedule, CREATE INDEX CONCURRENTLY - albo nie działa w transakcji, albo
  zachowuje się w niej inaczej. Pliki, które mają być atomowe, mają własne
  BEGIN/COMMIT w środku i to jest właściwe miejsce na tę decyzję.
*/
import pg from 'pg';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('Podaj plik .sql do wykonania.');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);

const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('Brak SUPABASE_DB_PASSWORD w .env.local');
  process.exit(1);
}

const poolerUrl = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
const connectionString = poolerUrl.replace('@', `:${encodeURIComponent(password)}@`);

const sql = readFileSync(file, 'utf8');

console.log(`plik: ${file} (${sql.split('\n').length} linii)`);

if (dryRun) {
  console.log('\n--- próba na sucho, nic nie wykonano ---');
  console.log(sql);
  process.exit(0);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  /*
    Wynik jest tablicą, po jednym elemencie na instrukcję w pliku. Wypisujemy
    tylko te, które coś zwróciły - skrypty konczą się zwykle SELECT-em
    kontrolnym i to jego chcemy zobaczyć, a nie ciszy po dziesięciu UPDATE-ach.
  */
  const results = await client.query(sql);
  const list = Array.isArray(results) ? results : [results];

  for (const r of list) {
    if (r.command && r.rowCount != null && !r.rows?.length) {
      console.log(`  ${r.command}: ${r.rowCount} wierszy`);
    }
    if (r.rows?.length) {
      console.log(`  ${r.command}:`);
      console.table(r.rows);
    }
  }
  console.log('\nOK');
} catch (error) {
  console.error('\nBŁĄD:', error.message);
  if (error.position) console.error('pozycja w pliku:', error.position);
  process.exitCode = 1;
} finally {
  await client.end();
}
