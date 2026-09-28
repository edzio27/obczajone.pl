/*
  Zrzut danych z bazy produkcyjnej do plików na dysku.

  Obiecałem ten skrypt przy rozmowie o zabezpieczeniu danych i go nie napisałem.
  28 września 2026 instancja przeszła w stan Unhealthy i nie wstała po restarcie,
  a dashboard pokazał `LAST BACKUP: No backups` - plan Free nie robi kopii.
  Historia cen zbierana od miesięcy istniała wtedy w jednym egzemplarzu i nie
  było jej skąd odtworzyć: Otomoto ani Otodom nie udostępniają przeszłych cen.

  Dlaczego Node, a nie `pg_dump`: na tej maszynie nie ma ani pg_dump, ani psql,
  ani CLI Supabase. Biblioteka `pg` jest już zależnością projektu, więc ten
  skrypt działa bez instalowania czegokolwiek - a kopia, do której trzeba się
  najpierw przygotować, nie powstaje.

  Czego ten zrzut NIE obejmuje, żeby nie było złudzeń:
    - schematu, polityk RLS, funkcji i cronów (to jest w migracjach w repo),
    - plików w Storage (zdjęcia z opinii - osobny system),
    - użytkowników z auth.users (osobny schemat, niedostępny przez poolera).
  Obejmuje dane z `public` - w tym historię cen, czyli jedyną rzecz, której
  nie da się odtworzyć z żadnego źródła.

  Użycie:
    node scripts/backup.mjs                  # zrzut do backups/<data>/
    node scripts/backup.mjs --keep 14        # zostaw 14 ostatnich kopii
    node scripts/backup.mjs --out /sciezka   # inny katalog docelowy

  Katalog `backups/` należy trzymać poza repo (jest w .gitignore) i - to ważne -
  skopiować gdzieś poza ten komputer. Kopia leżąca obok oryginału chroni przed
  awarią Supabase, ale nie przed utratą laptopa.
*/
import pg from 'pg';
import { readFileSync, mkdirSync, createWriteStream, readdirSync, rmSync, statSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

const args = process.argv.slice(2);
const wartosc = (nazwa, domyslna) => {
  const i = args.indexOf(nazwa);
  return i >= 0 && args[i + 1] ? args[i + 1] : domyslna;
};

const katalogDocelowy = wartosc('--out', 'backups');
const ileZostawic = Number(wartosc('--keep', '7'));

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

/*
  Termin na połączenie i na zapytanie.

  Bez tego skrypt uruchomiony w trakcie awarii wisi bez końca zamiast powiedzieć,
  że bazy nie ma - a to jest dokładnie ten moment, w którym człowiek najbardziej
  potrzebuje jasnej odpowiedzi. Ta sama lekcja co w lib/supabase-server.ts.
*/
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
  statement_timeout: 120_000,
});

const znacznik = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const katalog = path.join(katalogDocelowy, znacznik);

async function zrzucTabele(nazwa) {
  const plik = path.join(katalog, `${nazwa}.jsonl.gz`);
  const zapis = createWriteStream(plik);
  const gzip = createGzip();

  /*
    Kursor zamiast SELECT *: przy kilkuset tysiącach zapisów cen wczytanie
    wszystkiego do pamięci Node zabiłoby proces. Wiersze lecą strumieniem
    prosto do skompresowanego pliku.
  */
  const kursor = `kursor_${nazwa}`;
  await client.query('BEGIN');
  await client.query(`DECLARE ${kursor} CURSOR FOR SELECT * FROM public."${nazwa.replace(/"/g, '""')}"`);

  let ile = 0;
  const czytaj = async function* () {
    for (;;) {
      const { rows } = await client.query(`FETCH 1000 FROM ${kursor}`);
      if (rows.length === 0) break;
      ile += rows.length;
      yield rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    }
  };

  await pipeline(Readable.from(czytaj()), gzip, zapis);
  await client.query(`CLOSE ${kursor}`);
  await client.query('COMMIT');

  const rozmiar = statSync(plik).size;
  return { ile, rozmiar };
}

function posprzataj() {
  if (!Number.isFinite(ileZostawic) || ileZostawic <= 0) return;
  const kopie = readdirSync(katalogDocelowy)
    .filter((d) => /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  for (const stara of kopie.slice(ileZostawic)) {
    rmSync(path.join(katalogDocelowy, stara), { recursive: true, force: true });
    console.log(`  usunięto starą kopię: ${stara}`);
  }
}

try {
  await client.connect();
  mkdirSync(katalog, { recursive: true });

  const { rows: tabele } = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  if (tabele.length === 0) {
    console.error('Baza nie zwróciła żadnej tabeli - przerywam, żeby nie zapisać pustej kopii.');
    process.exit(1);
  }

  console.log(`kopia: ${katalog}`);
  console.log(`tabel do zrzucenia: ${tabele.length}\n`);

  let razemWierszy = 0;
  let razemBajtow = 0;

  for (const { tablename } of tabele) {
    const { ile, rozmiar } = await zrzucTabele(tablename);
    razemWierszy += ile;
    razemBajtow += rozmiar;
    console.log(`  ${tablename.padEnd(32)} ${String(ile).padStart(9)} wierszy  ${(rozmiar / 1024).toFixed(0).padStart(7)} kB`);
  }

  console.log(`\nrazem: ${razemWierszy} wierszy, ${(razemBajtow / 1048576).toFixed(1)} MB`);
  posprzataj();
  console.log('\nSkopiuj katalog backups/ poza ten komputer - kopia obok oryginału to nie kopia.');
} catch (error) {
  console.error('\nKopia NIE powstała:', error.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
