import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(Boolean)
  .map(l => [l.slice(0,l.indexOf('=')), l.slice(l.indexOf('=')+1)]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const t0=Date.now();
const r = await db.from('otodom_sweep_targets').select('id').limit(1);
console.log('otodom_sweep_targets:', r.error ? `BRAK (${r.error.code})` : 'istnieje');
const c = await db.from('listings').select('*',{count:'exact',head:true});
console.log('odpowiedź bazy:', Date.now()-t0, 'ms | listings:', c.count ?? c.error?.message);
