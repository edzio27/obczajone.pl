'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { daysLeft, type ContestEntry, type ContestRound } from '@/lib/contest-data';
import { Check, Loader as Loader2, ThumbsUp, Trophy } from 'lucide-react';

const VOTER_KEY = 'obczajone:voter-token';
const VOTED_KEY = (roundId: string) => `obczajone:voted:${roundId}`;

/**
 * Token głosującego. Trzymany w przeglądarce, losowy, nie mówi o nikim nic.
 *
 * Powstrzymuje drugie kliknięcie tej samej osoby i nic ponadto - kto chce,
 * wyczyści dane i zagłosuje ponownie. To jest uczciwy sufit dla głosowania bez
 * kont, a alternatywa, czyli wymóg rejestracji, jest dokładnie tym, przez co
 * każdy inny formularz w tym serwisie stoi pusty.
 */
function voterToken(): string {
  try {
    const existing = window.localStorage.getItem(VOTER_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(VOTER_KEY, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function ContestClient({
  round,
  initialEntries,
}: {
  round: ContestRound | null;
  initialEntries: ContestEntry[];
}) {
  const { toast } = useToast();
  const [entries, setEntries] = useState(initialEntries);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);

  useEffect(() => {
    if (!round) return;
    try {
      setVotedFor(window.localStorage.getItem(VOTED_KEY(round.id)));
    } catch {
      setVotedFor(null);
    }
  }, [round]);

  const open = round ? round.is_open && daysLeft(round) >= 0 : false;

  async function vote(entryId: string) {
    if (!round || votedFor || voting) return;

    setVoting(entryId);

    const { error } = await supabase.from('contest_votes').insert({
      round_id: round.id,
      entry_id: entryId,
      voter_token: voterToken(),
    });

    setVoting(null);

    if (error) {
      const already = error.message?.includes('contest_votes_one_per_round');
      toast({
        title: already ? 'Już głosowałeś w tej rundzie' : 'Nie udało się oddać głosu',
        description: already
          ? 'Jeden głos na rundę. Wróć, gdy zaczniemy kolejną.'
          : error.message?.includes('contest_round_closed')
            ? 'Głosowanie w tej rundzie jest już zamknięte.'
            : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    setEntries((current) =>
      current
        .map((e) => (e.id === entryId ? { ...e, vote_count: e.vote_count + 1 } : e))
        .sort((a, b) => b.vote_count - a.vote_count)
    );
    setVotedFor(entryId);
    try {
      window.localStorage.setItem(VOTED_KEY(round.id), entryId);
    } catch {
      /* brak pamięci nie może cofnąć oddanego głosu */
    }

    toast({
      title: 'Głos oddany',
      description: 'Wynik ogłosimy po zamknięciu rundy.',
    });
  }

  if (!round) {
    return (
      <Card>
        {/* Bez otwartej rundy nie ma do czego zgłaszać auta, więc formularza tu
            nie ma - a skoro go nie ma, strona nie może obiecywać, że jest. */}
        <CardContent className="pt-6 text-muted-foreground">
          Żadna runda nie jest w tej chwili otwarta. Kolejne głosowanie ruszy niedługo —
          wtedy pojawi się tu lista zgłoszonych aut i formularz zgłoszenia.
        </CardContent>
      </Card>
    );
  }

  const left = daysLeft(round);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">{round.title}</h2>
        {open ? (
          <Badge variant="outline">
            {left <= 0 ? 'Ostatni dzień' : `Zostało ${left} dni`}
          </Badge>
        ) : (
          <Badge variant="secondary">Głosowanie zamknięte</Badge>
        )}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground">
            Nie ma jeszcze zatwierdzonych zgłoszeń w tej rundzie. Twoje może być pierwsze.
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {entries.map((entry) => {
            const isWinner = round.winner_entry_id === entry.id;
            const mine = votedFor === entry.id;

            return (
              <Card key={entry.id} className={isWinner ? 'border-primary' : undefined}>
                <CardContent className="pt-6 space-y-3">
                  {isWinner && (
                    <Badge className="gap-1">
                      <Trophy className="h-3 w-3" />
                      Zwycięzca rundy
                    </Badge>
                  )}
                  <div>
                    <h3 className="font-semibold">{entry.title}</h3>
                    {entry.city && (
                      <p className="text-sm text-muted-foreground">{entry.city}</p>
                    )}
                  </div>
                  {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-sm font-medium">
                      {entry.vote_count} {entry.vote_count === 1 ? 'głos' : 'głosów'}
                    </span>
                    {open && (
                      <Button
                        size="sm"
                        variant={mine ? 'default' : 'outline'}
                        disabled={!!votedFor || voting !== null}
                        onClick={() => vote(entry.id)}
                      >
                        {voting === entry.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : mine ? (
                          <>
                            <Check className="h-4 w-4 mr-1" /> Twój głos
                          </>
                        ) : (
                          <>
                            <ThumbsUp className="h-4 w-4 mr-1" /> Głosuj
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EntryForm roundId={round.id} />
    </div>
  );
}

function EntryForm({ roundId }: { roundId: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    listing_url: '',
    title: '',
    city: '',
    note: '',
    submitter_name: '',
    submitter_contact: '',
  });
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!consent) {
      toast({
        title: 'Potrzebna zgoda',
        description: 'Bez zgody na publikację werdyktu nie możemy zgłosić auta do głosowania.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('contest_entries').insert({
      round_id: roundId,
      listing_url: form.listing_url.trim(),
      title: form.title.trim(),
      city: form.city.trim(),
      note: form.note.trim(),
      submitter_name: form.submitter_name.trim(),
      submitter_contact: form.submitter_contact.trim(),
      consent_public: true,
    });
    setSaving(false);

    if (error) {
      toast({
        title: 'Nie udało się zgłosić',
        description: error.message?.includes('contest_entries_one_per_round')
          ? 'To ogłoszenie jest już zgłoszone w tej rundzie.'
          : 'Sprawdź, czy wszystkie pola są wypełnione, i spróbuj ponownie.',
        variant: 'destructive',
      });
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <Card className="border-primary/40">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-primary">Zgłoszenie przyjęte</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sprawdzimy je i dodamy do głosowania. Odezwiemy się na podany kontakt — również
            wtedy, gdy Twoje auto wygra.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="zglos">
      <CardContent className="pt-6">
        <h3 className="font-semibold text-lg mb-1">Zgłoś swoje auto</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Sprzedajesz auto i wiesz, że jest uczciwe? Niezależny werdykt przy ogłoszeniu robi
          za Ciebie robotę, której żaden opis nie zrobi.
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="listing_url">Link do ogłoszenia *</Label>
            <Input
              id="listing_url"
              required
              value={form.listing_url}
              onChange={(e) => update('listing_url', e.target.value)}
              placeholder="https://www.otomoto.pl/..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Auto *</Label>
              <Input
                id="title"
                required
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Skoda Octavia 1.5 TSI, 2019"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Miejscowość</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Wrocław"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Dlaczego akurat to auto? (opcjonalnie)</Label>
            <Textarea
              id="note"
              rows={3}
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              placeholder="Jeden właściciel, pełna historia serwisowa, bezwypadkowe..."
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="submitter_name">Imię *</Label>
              <Input
                id="submitter_name"
                required
                value={form.submitter_name}
                onChange={(e) => update('submitter_name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="submitter_contact">Telefon lub e-mail *</Label>
              <Input
                id="submitter_contact"
                required
                value={form.submitter_contact}
                onChange={(e) => update('submitter_contact', e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span className="text-muted-foreground">
              Zgadzam się, żeby werdykt z oględzin został opublikowany przy tym ogłoszeniu —
              również wtedy, gdy wypadnie niekorzystnie. *
            </span>
          </label>

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Zgłoś auto do głosowania'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
