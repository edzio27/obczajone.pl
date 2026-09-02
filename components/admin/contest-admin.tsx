'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Check, ExternalLink, Trophy, X } from 'lucide-react';

/**
 * Prowadzenie konkursu: runda, moderacja zgłoszeń, wskazanie zwycięzcy.
 *
 * Otwarcie i zamknięcie rundy jest decyzją, a nie zdarzeniem w kalendarzu -
 * runda kończy się wtedy, kiedy partner ma czas pojechać. Dlatego nie ma tu
 * crona, tylko przycisk.
 */

type Round = {
  id: string;
  title: string;
  ends_at: string;
  is_open: boolean;
  winner_entry_id: string | null;
};

type Entry = {
  id: string;
  round_id: string;
  listing_url: string;
  title: string;
  city: string;
  note: string;
  submitter_name: string;
  submitter_contact: string;
  status: 'pending' | 'approved' | 'rejected';
  vote_count: number;
  created_at: string;
};

export function ContestAdmin() {
  const { toast } = useToast();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [title, setTitle] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [roundsResult, entriesResult] = await Promise.all([
      supabase
        .from('contest_rounds')
        .select('id, title, ends_at, is_open, winner_entry_id')
        .order('ends_at', { ascending: false }),
      supabase
        .from('contest_entries')
        .select(
          'id, round_id, listing_url, title, city, note, submitter_name, submitter_contact, status, vote_count, created_at'
        )
        .order('created_at', { ascending: false }),
    ]);

    setRounds((roundsResult.data as Round[]) || []);
    setEntries((entriesResult.data as Entry[]) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createRound(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !endsAt) return;

    setBusy(true);
    const { error } = await supabase
      .from('contest_rounds')
      .insert({ title: title.trim(), ends_at: new Date(endsAt).toISOString() });
    setBusy(false);

    if (error) {
      toast({ title: 'Nie udało się dodać rundy', variant: 'destructive' });
      return;
    }

    setTitle('');
    setEndsAt('');
    load();
  }

  async function setStatus(entryId: string, status: Entry['status']) {
    const { error } = await supabase
      .from('contest_entries')
      .update({ status })
      .eq('id', entryId);

    if (error) {
      toast({ title: 'Nie udało się zmienić statusu', variant: 'destructive' });
      return;
    }

    setEntries((current) =>
      current.map((e) => (e.id === entryId ? { ...e, status } : e))
    );
  }

  async function chooseWinner(roundId: string, entryId: string) {
    const { error } = await supabase
      .from('contest_rounds')
      .update({ winner_entry_id: entryId, is_open: false })
      .eq('id', roundId);

    if (error) {
      toast({ title: 'Nie udało się zapisać zwycięzcy', variant: 'destructive' });
      return;
    }

    toast({
      title: 'Zwycięzca wskazany',
      description: 'Runda zamknięta. Werdykt publikuje partner przez panel albo formularz przy ogłoszeniu.',
    });
    load();
  }

  async function toggleRound(round: Round) {
    await supabase
      .from('contest_rounds')
      .update({ is_open: !round.is_open })
      .eq('id', round.id);
    load();
  }

  const pending = entries.filter((e) => e.status === 'pending');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Nowa runda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createRound} className="grid sm:grid-cols-[1fr,200px,auto] gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="round-title">Tytuł</Label>
              <Input
                id="round-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Głosowanie 2–9 września"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="round-ends">Koniec głosowania</Label>
              <Input
                id="round-ends"
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              Dodaj rundę
            </Button>
          </form>
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zgłoszenia do sprawdzenia ({pending.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.city || 'bez miejscowości'} · {entry.submitter_name} ·{' '}
                      {entry.submitter_contact}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setStatus(entry.id, 'approved')}>
                      <Check className="h-4 w-4 mr-1" /> Dopuść
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(entry.id, 'rejected')}
                    >
                      <X className="h-4 w-4 mr-1" /> Odrzuć
                    </Button>
                  </div>
                </div>
                {entry.note && <p className="text-sm">{entry.note}</p>}
                <a
                  href={entry.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  Zobacz ogłoszenie <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rounds.map((round) => {
        const roundEntries = entries
          .filter((e) => e.round_id === round.id && e.status === 'approved')
          .sort((a, b) => b.vote_count - a.vote_count);

        return (
          <Card key={round.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {round.title}
                  <Badge variant={round.is_open ? 'default' : 'secondary'}>
                    {round.is_open ? 'otwarta' : 'zamknięta'}
                  </Badge>
                </CardTitle>
                <Button size="sm" variant="outline" onClick={() => toggleRound(round)}>
                  {round.is_open ? 'Zamknij głosowanie' : 'Otwórz ponownie'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {roundEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak dopuszczonych zgłoszeń.</p>
              ) : (
                roundEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b last:border-b-0 py-2"
                  >
                    <div>
                      <span className="font-medium">{entry.title}</span>
                      <span className="text-sm text-muted-foreground">
                        {' '}
                        — {entry.vote_count} głosów · {entry.submitter_contact}
                      </span>
                    </div>
                    {round.winner_entry_id === entry.id ? (
                      <Badge className="gap-1">
                        <Trophy className="h-3 w-3" /> zwycięzca
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => chooseWinner(round.id, entry.id)}
                      >
                        Wskaż zwycięzcę
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
