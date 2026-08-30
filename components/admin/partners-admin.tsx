'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { VOIVODESHIPS } from '@/lib/geo';
import { PARTNER_COLUMNS, slugify, type Partner } from '@/lib/partner-data';
import { coordsFromLocation } from '@/lib/geo';
import { ExternalLink, Loader as Loader2, Plus, UserPlus } from 'lucide-react';

type PartnerAccount = { partner_id: string; user_id: string; display_name?: string };

export function PartnersAdmin() {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<PartnerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    category: 'car',
    city: '',
    voivodeship: '',
    contact_url: '',
    description: '',
  });

  const load = useCallback(async () => {
    const [{ data: partnersData }, { data: accountsData }] = await Promise.all([
      supabase.from('partners').select(PARTNER_COLUMNS).order('created_at'),
      supabase.from('partner_users').select('partner_id, user_id'),
    ]);

    const rows = (accountsData as PartnerAccount[]) || [];
    if (rows.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', rows.map((r) => r.user_id));

      const nameById = new Map<string, string>();
      (profiles || []).forEach((p: any) => nameById.set(p.id, p.display_name));
      rows.forEach((row) => {
        row.display_name = nameById.get(row.user_id);
      });
    }

    setPartners((partnersData as unknown as Partner[]) || []);
    setAccounts(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFlag(partner: Partner, field: 'is_active' | 'is_verified' | 'is_promoted', value: boolean) {
    const patch: Record<string, any> = { [field]: value };
    if (field === 'is_verified') {
      patch.verified_at = value ? new Date().toISOString() : null;
    }

    const { error } = await supabase.from('partners').update(patch).eq('id', partner.id);

    if (error) {
      toast({ title: 'Nie udało się zapisać', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  }

  async function createPartner(event: React.FormEvent) {
    event.preventDefault();
    if (newPartner.name.trim().length < 2 || !newPartner.contact_url.trim()) {
      toast({ title: 'Nazwa i link kontaktowy są wymagane', variant: 'destructive' });
      return;
    }

    setCreating(true);

    const base = slugify(newPartner.name) || 'partner';
    const taken = new Set(partners.map((p) => p.slug));
    let slug = base;
    let suffix = 1;
    while (taken.has(slug)) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }

    /*
      Współrzędne z miasta, tą samą tablicą, którą ogłoszenia dostają swoje
      położenie. Bez nich firma nie trafia ani na mapę partnerów, ani do doboru
      po odległości przy ogłoszeniach - a wygląda na poprawnie dodaną, więc
      błędu nie widać, dopóki partner nie zapyta, czemu nie ma zapytań.

      Kod polecający ustawiamy od razu z tego samego powodu: bez niego odznaka
      i link partnera nie mają czego liczyć.
    */
    const coords = coordsFromLocation(newPartner.city);

    const { error } = await supabase.from('partners').insert({
      name: newPartner.name.trim(),
      slug,
      category: newPartner.category,
      city: newPartner.city.trim() || null,
      voivodeship: newPartner.voivodeship || null,
      contact_url: newPartner.contact_url.trim(),
      description: newPartner.description.trim(),
      partner_since: new Date().toISOString().slice(0, 10),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      referral_slug: slug,
    });

    setCreating(false);

    if (error) {
      toast({ title: 'Nie udało się dodać', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Partner dodany', description: `Profil: /partner/${slug}` });
    setNewPartner({ name: '', category: 'car', city: '', voivodeship: '', contact_url: '', description: '' });
    setShowForm(false);
    load();
  }

  /** Dolicza współrzędne partnerowi, który powstał, zanim robił to formularz. */
  async function fixCoords(partner: Partner) {
    const coords = coordsFromLocation(partner.city);
    if (!coords) {
      toast({
        title: 'Nie znam tego miasta',
        description: `„${partner.city}” nie ma w tablicy. Wpisz w profilu większe miasto obok albo dopisz je do CITY_COORDS.`,
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('partners')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', partner.id);

    if (error) {
      toast({ title: 'Nie udało się zapisać', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Współrzędne ustawione', description: `${partner.name} jest już na mapie.` });
    load();
  }

  async function linkAccount(partner: Partner) {
    const login = window.prompt(
      `Podaj nazwę użytkownika (część adresu e-mail przed @), któremu dajesz dostęp do panelu firmy ${partner.name}.\n\nUżytkownik musi mieć już założone konto w serwisie.`
    );
    if (!login) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('display_name', login.trim())
      .maybeSingle();

    if (!profile) {
      toast({
        title: 'Nie znaleziono użytkownika',
        description: 'Sprawdź pisownię albo poproś firmę o założenie konta.',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('partner_users')
      .insert({ partner_id: partner.id, user_id: profile.id });

    if (error) {
      toast({ title: 'Nie udało się przypisać konta', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Konto przypisane', description: `${profile.display_name} ma dostęp do panelu partnera.` });
    load();
  }

  async function unlinkAccount(account: PartnerAccount) {
    const { error } = await supabase
      .from('partner_users')
      .delete()
      .eq('partner_id', account.partner_id)
      .eq('user_id', account.user_id);

    if (error) {
      toast({ title: 'Nie udało się odpiąć konta', variant: 'destructive' });
      return;
    }
    load();
  }

  if (loading) {
    return <p className="text-muted-foreground">Ładowanie partnerów...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? 'ghost' : 'default'}>
          <Plus className="h-4 w-4 mr-2" />
          {showForm ? 'Anuluj' : 'Dodaj partnera'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nowy partner</CardTitle>
            <CardDescription>
              Resztę profilu (opis, usługi, cennik) uzupełni firma sama w panelu partnera.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createPartner} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="np-name">Nazwa firmy *</Label>
                  <Input
                    id="np-name"
                    value={newPartner.name}
                    onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                    required
                  />
                  {newPartner.name && (
                    <p className="text-xs text-muted-foreground">
                      Adres profilu: /partner/{slugify(newPartner.name)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Kategoria</Label>
                  <Select
                    value={newPartner.category}
                    onValueChange={(v) => setNewPartner({ ...newPartner, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Sprawdzanie aut</SelectItem>
                      <SelectItem value="home">Sprawdzanie nieruchomości</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="np-city">Miasto</Label>
                  <Input
                    id="np-city"
                    value={newPartner.city}
                    onChange={(e) => setNewPartner({ ...newPartner, city: e.target.value })}
                  />
                  {newPartner.city.trim() &&
                    (coordsFromLocation(newPartner.city) ? (
                      <p className="text-xs text-success">
                        Rozpoznane — firma trafi na mapę i do ogłoszeń z okolicy
                      </p>
                    ) : (
                      <p className="text-xs text-destructive">
                        Nie znam tego miasta. Partner powstanie, ale bez pozycji na mapie i bez
                        dopasowania do ogłoszeń — dopisz współrzędne ręcznie albo wpisz większe
                        miasto obok.
                      </p>
                    ))}
                </div>
                <div className="space-y-2">
                  <Label>Województwo</Label>
                  <Select
                    value={newPartner.voivodeship}
                    onValueChange={(v) => setNewPartner({ ...newPartner, voivodeship: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Wybierz" />
                    </SelectTrigger>
                    <SelectContent>
                      {VOIVODESHIPS.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="np-contact">Link kontaktowy *</Label>
                <Input
                  id="np-contact"
                  value={newPartner.contact_url}
                  onChange={(e) => setNewPartner({ ...newPartner, contact_url: e.target.value })}
                  placeholder="https://..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="np-description">Jedno zdanie opisu</Label>
                <Input
                  id="np-description"
                  value={newPartner.description}
                  onChange={(e) => setNewPartner({ ...newPartner, description: e.target.value })}
                />
              </div>

              <Button type="submit" disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Dodaj partnera
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {partners.map((partner) => {
        const partnerAccounts = accounts.filter((a) => a.partner_id === partner.id);

        return (
          <Card key={partner.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{partner.name}</h3>
                    <Badge variant="secondary">
                      {partner.category === 'car' ? 'auta' : 'nieruchomości'}
                    </Badge>
                    {!partner.is_active && <Badge variant="outline">wyłączony</Badge>}
                    {/* Brak współrzędnych to awaria cicha: profil działa, ale firma
                        nie jest nigdzie proponowana. Musi być widać z listy. */}
                    {(partner.lat == null || partner.lng == null) && (
                      <Badge variant="destructive">bez współrzędnych</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {partner.city || 'brak miasta'} · ocena{' '}
                    {partner.rating_avg != null ? partner.rating_avg.toFixed(2) : '—'} (
                    {partner.rating_count}) · oględziny: {partner.inspection_count}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(partner.lat == null || partner.lng == null) && partner.city && (
                    <Button variant="outline" size="sm" onClick={() => fixCoords(partner)}>
                      Ustaw z miasta
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/partner/${partner.slug}`} target="_blank">
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Profil
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mb-4">
                <FlagSwitch
                  id={`active-${partner.id}`}
                  label="Widoczny w serwisie"
                  checked={partner.is_active}
                  onChange={(v) => toggleFlag(partner, 'is_active', v)}
                />
                <FlagSwitch
                  id={`verified-${partner.id}`}
                  label="Zweryfikowany"
                  checked={partner.is_verified}
                  onChange={(v) => toggleFlag(partner, 'is_verified', v)}
                />
                <FlagSwitch
                  id={`promoted-${partner.id}`}
                  label="Promowany (płatny)"
                  checked={partner.is_promoted}
                  onChange={(v) => toggleFlag(partner, 'is_promoted', v)}
                />
              </div>

              <div className="border-t pt-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Dostęp do panelu: </span>
                    {partnerAccounts.length === 0 ? (
                      <span className="text-muted-foreground">brak</span>
                    ) : (
                      partnerAccounts.map((account) => (
                        <button
                          key={account.user_id}
                          onClick={() => unlinkAccount(account)}
                          className="inline-flex items-center gap-1 mr-2 underline decoration-dotted hover:text-destructive"
                          title="Kliknij, aby odebrać dostęp"
                        >
                          {account.display_name ?? account.user_id.slice(0, 8)}
                        </button>
                      ))
                    )}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => linkAccount(partner)}>
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Przypisz konto
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function FlagSwitch({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
        {label}
      </Label>
    </div>
  );
}
