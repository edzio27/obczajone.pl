import type { SupabaseClient } from '@supabase/supabase-js';

export type ContestRound = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  is_open: boolean;
  winner_entry_id: string | null;
};

export type ContestEntry = {
  id: string;
  round_id: string;
  listing_id: string | null;
  listing_url: string;
  title: string;
  city: string;
  note: string;
  vote_count: number;
  created_at: string;
};

/** Kolumny widoczne publicznie. Danych kontaktowych zgłaszającego tu nie ma. */
export const CONTEST_ENTRY_COLUMNS =
  'id, round_id, listing_id, listing_url, title, city, note, vote_count, created_at';

/** Runda, w której się teraz głosuje, albo ostatnia zakończona. */
export async function fetchCurrentRound(
  supabase: SupabaseClient
): Promise<ContestRound | null> {
  const { data: open } = await supabase
    .from('contest_rounds')
    .select('id, title, starts_at, ends_at, is_open, winner_entry_id')
    .eq('is_open', true)
    .order('ends_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (open) return open as ContestRound;

  const { data: last } = await supabase
    .from('contest_rounds')
    .select('id, title, starts_at, ends_at, is_open, winner_entry_id')
    .order('ends_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (last as ContestRound) ?? null;
}

export async function fetchRoundEntries(
  supabase: SupabaseClient,
  roundId: string
): Promise<ContestEntry[]> {
  const { data } = await supabase
    .from('contest_entries')
    .select(CONTEST_ENTRY_COLUMNS)
    .eq('round_id', roundId)
    .eq('status', 'approved')
    .order('vote_count', { ascending: false });

  return (data as ContestEntry[]) || [];
}

/** Ile dni zostało do końca rundy. Ujemne, gdy runda już minęła. */
export function daysLeft(round: ContestRound): number {
  const ms = new Date(round.ends_at).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
