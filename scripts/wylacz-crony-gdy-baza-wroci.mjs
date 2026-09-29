/*
  Czeka na powrót bazy i natychmiast wyłącza wszystkie zadania cykliczne.

  Powstało 29 września 2026, w trakcie awarii, która trwała ponad dobę.
  Instancja wyczerpała budżet Disk IO i przestała przyjmować połączenia, więc
  `pg_cron` nie dało się dotknąć żadną drogą - ani przez run-sql.mjs, ani przez
  SQL Editor. Problem w tym, że w chwili, gdy Postgres wstanie, harmonogram
  ruszy razem z nim: pięć zadań co godzinę, w tym trzy ciężkie przeliczenia
  z percentylami. Instancja, która dopiero co nie dała rady, dostałaby pełne
  obciążenie w pierwszych minutach życia.

  Ten skrypt zajmuje to okno. Sprawdza połączenie co minutę, a gdy się uda:
  najpierw spisuje harmonogram do pliku (wyłączenie kasuje wpisy bezpowrotnie,
  a snapshoty i alerty zakładały migracje rozsiane po historii repo), potem
  kasuje wszystko. Dopiero wtedy można spokojnie robić backup i wracać
  z ograniczonym harmonogramem - scripts/reduce-disk-io.sql.

  Użycie:
    node scripts/wylacz-crony-gdy-baza-wroci.mjs
    node scripts/wylacz-crony-gdy-baza-wroci.mjs --minut 180
*/
import pg from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const i = args.indexOf('--minut');
const ileMinut = i >= 0 && args[i + 1] ? Number(args[i + 1]) : 240;

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter(Boolean)
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
);
const pooler = readFileSync('supabase/.temp/pooler-url', 'utf8').trim();
const connectionString = pooler.replace('@', `:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@`);

const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));

async function sprobuj() {
  const c = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15_000,
    statement_timeout: 30_000,
  });
  await c.connect();
  return c;
}

const start = Date.now();
for (let proba = 1; proba <= ileMinut; proba += 1) {
  let client;
  try {
    client = await sprobuj();
  } catch {
    await czekaj(60_000);
    continue;
  }

  const minut = Math.round((Date.now() - start) / 60000);
  console.log(`BAZA WROCILA po ${minut} min - wylaczam zadania cykliczne`);

  try {
    const spis = await client.query(
      'SELECT jobid, jobname, schedule, active, command FROM cron.job ORDER BY jobname'
    );
    const plik = `kopia-cronow-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(plik, JSON.stringify(spis.rows, null, 2));
    console.log(`  spisano ${spis.rows.length} zadan do ${plik}`);
    for (const r of spis.rows) console.log(`    ${r.jobname.padEnd(26)} ${r.schedule}`);

    if (spis.rows.length > 0) {
      await client.query('SELECT cron.unschedule(jobid) FROM cron.job');
    }

    const po = await client.query('SELECT count(*)::int AS ile FROM cron.job');
    console.log(`  zostalo zadan: ${po.rows[0].ile} (ma byc 0)`);
    console.log('\nTeraz mozna: node scripts/backup.mjs');
  } catch (e) {
    console.error('  NIE UDALO SIE wylaczyc zadan:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
  process.exit(process.exitCode ?? 0);
}

console.log(`BAZA NIE WROCILA w ciagu ${ileMinut} min - zadania nadal aktywne`);
process.exit(1);
