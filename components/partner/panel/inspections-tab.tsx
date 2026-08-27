'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock, Loader as Loader2, Search } from 'lucide-react';
import { VERDICT_LABELS, type InspectionVerdict, type PartnerInspection } from '@/lib/partner-data';

type ListingHit = {
  id: string;
  title: string;
  location: string;
  current_price: number;
};

const VERDICT_STYLES: Record<string, string> = {
  recommended: 'bg-success/10 text-success border-success/20',
  reservations: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  not_recommended: 'bg-destructive/10 text-destructive border-destructive/20',
};

type InspectionsTabProps = {
  partnerId: string;
  inspections: PartnerInspection[];
  onChanged: () => void;
};

export function InspectionsTab({ partnerId, inspections, onChanged }: InspectionsTabProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<ListingHit[]>([]);
  const [selected, setSelected] = useState<ListingHit | null>(null);
  const [verdict, setVerdict] = useState<InspectionVerdict>('recommended');
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState('');
  const [priceOpinion, setPriceOpinion] = useState('');
  const [inspectedAt, setInspectedAt] = useState('');
  const [saving, setSaving] = useState(false);

  /**
   * Partner szuka ogłoszenia po tytule albo wkleja link/ID z naszego serwisu.
   * Wpis musi wskazywać na ogłoszenie, które u nas istnieje - oględziny bez
   * strony, przy której się wyświetlą, nie mają sensu.
   */
  async function searchListings(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) return;

    setSearching(true);

    const uuidMatch = trimmed.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );

    const request = uuidMatch
      ? supabase
          .from('listings')
          .select('id, title, location, current_price')
          .eq('id', uuidMatch[0])
      : supabase
          .from('listings')
          .select('id, title, location, current_price')
          .ilike('title', `%${trimmed}%`)
          .eq('is_active', true)
          .gt('current_price', 0)
          .limit(8);

    const { data } = await request;
    setHits((data as ListingHit[]) || []);
    setSearching(false);
  }

  function resetForm() {
    setSelected(null);
    setHits([]);
    setQuery('');
    setVerdict('recommended');
    setSummary('');
    setFindings('');
    setPriceOpinion('');
    setInspectedAt('');
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;

    if (summary.trim().length < 20) {
      toast({
        title: 'Za krótkie podsumowanie',
        description: 'Minimum 20 znaków — to jest tekst, który przeczyta kolejny kupujący.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('partner_inspections').insert({
      partner_id: partnerId,
      listing_id: selected.id,
      verdict,
      summary: summary.trim(),
      findings: findings
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      price_opinion: priceOpinion.trim(),
      inspected_at: inspectedAt || null,
    });

    setSaving(false);

    if (error) {
      const duplicate = error.message?.includes('partner_inspections_one_per_listing');
      toast({
        title: duplicate ? 'Już opisałeś to ogłoszenie' : 'Nie udało się opublikować',
        description: duplicate
          ? 'Na jedno ogłoszenie przypada jeden wpis od firmy. Edytuj istniejący.'
          : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Wysłane do moderacji',
      description: 'Po zatwierdzeniu wpis pojawi się przy ogłoszeniu i na Twoim profilu.',
    });
    resetForm();
    onChanged();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Opublikuj oględziny</CardTitle>
          <CardDescription>
            Skrócony werdykt z Twoich oględzin, przypięty do konkretnego ogłoszenia. Widzi go każdy,
            kto czyta tę stronę — z Twoją nazwą i linkiem do profilu. Publikuj wyłącznie za zgodą
            klienta, który zlecił badanie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selected ? (
            <>
              <form onSubmit={searchListings} className="flex gap-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tytuł ogłoszenia albo link z obczajone.pl"
                />
                <Button type="submit" variant="outline" disabled={searching}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </form>

              {hits.length > 0 && (
                <div className="space-y-2">
                  {hits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => setSelected(hit)}
                      className="w-full text-left rounded-lg border p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <p className="font-medium text-sm">{hit.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {hit.location}
                        {hit.current_price > 0
                          ? ` · ${hit.current_price.toLocaleString('pl-PL')} zł`
                          : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {!searching && hits.length === 0 && query.trim().length >= 3 && (
                <p className="text-sm text-muted-foreground">
                  Nic nie znaleziono. Ogłoszenie musi być najpierw dodane do serwisu — wklej jego
                  link z Otomoto na stronie głównej, a potem wróć tutaj.
                </p>
              )}
            </>
          ) : (
            <form onSubmit={publish} className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">{selected.title}</p>
                  <p className="text-xs text-muted-foreground">{selected.location}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Zmień
                </Button>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Werdykt</Label>
                  <Select value={verdict} onValueChange={(v) => setVerdict(v as InspectionVerdict)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VERDICT_LABELS) as InspectionVerdict[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {VERDICT_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inspected-at">Data oględzin</Label>
                  <Input
                    id="inspected-at"
                    type="date"
                    value={inspectedAt}
                    onChange={(e) => setInspectedAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Podsumowanie *</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Co sprawdziłeś i jaki jest ogólny obraz auta."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="findings">Znalezione usterki — jedna w linii</Label>
                <Textarea
                  id="findings"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={4}
                  placeholder={'Ognisko korozji na progu lewym\nLakier tylnego błotnika 320 µm\nWycieku oleju brak'}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price-opinion">Opinia o cenie</Label>
                <Input
                  id="price-opinion"
                  value={priceOpinion}
                  onChange={(e) => setPriceOpinion(e.target.value)}
                  maxLength={1000}
                  placeholder="Np. Cena adekwatna po uwzględnieniu kosztu blacharki (~2 tys. zł)."
                />
              </div>

              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  'Wyślij do moderacji'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <div>
        <h3 className="font-semibold mb-3">Twoje wpisy</h3>
        {inspections.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="pt-6 text-center py-8">
              <p className="text-muted-foreground">Nie opublikowałeś jeszcze żadnych oględzin.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {inspections.map((inspection) => (
              <Card key={inspection.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <Link
                      href={`/listing/${inspection.listing_id}`}
                      className="font-medium text-sm hover:text-primary transition-colors"
                    >
                      {inspection.listing?.title || 'Ogłoszenie'}
                    </Link>
                    <div className="flex items-center gap-2">
                      {!inspection.is_approved && (
                        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          W moderacji
                        </Badge>
                      )}
                      <Badge variant="outline" className={VERDICT_STYLES[inspection.verdict]}>
                        {VERDICT_LABELS[inspection.verdict]}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {inspection.inspected_at
                      ? `Oględziny: ${format(new Date(inspection.inspected_at), 'd MMMM yyyy', { locale: pl })}`
                      : `Dodano: ${format(new Date(inspection.created_at), 'd MMMM yyyy', { locale: pl })}`}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{inspection.summary}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
