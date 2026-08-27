'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { VOIVODESHIPS } from '@/lib/geo';
import { Loader as Loader2 } from 'lucide-react';
import type { Partner } from '@/lib/partner-data';

type ProfileTabProps = {
  partner: Partner;
  onSaved: () => void;
};

export function ProfileTab({ partner, onSaved }: ProfileTabProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: partner.name,
    description: partner.description,
    about: partner.about,
    services: partner.services.join('\n'),
    phone: partner.phone ?? '',
    email: partner.email ?? '',
    website: partner.website ?? '',
    contact_url: partner.contact_url,
    price_from: partner.price_from != null ? String(partner.price_from) : '',
    response_time: partner.response_time ?? '',
    city: partner.city ?? '',
    voivodeship: partner.voivodeship ?? '',
  });

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    const { error } = await supabase
      .from('partners')
      .update({
        name: form.name.trim(),
        description: form.description.trim(),
        about: form.about.trim(),
        services: form.services
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
        contact_url: form.contact_url.trim(),
        price_from: form.price_from ? Number(form.price_from) : null,
        response_time: form.response_time.trim() || null,
        city: form.city.trim() || null,
        voivodeship: form.voivodeship || null,
      })
      .eq('id', partner.id);

    setSaving(false);

    if (error) {
      toast({ title: 'Nie udało się zapisać', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Profil zaktualizowany' });
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Twój profil publiczny</CardTitle>
        <CardDescription>
          To jest treść strony obczajone.pl/partner/{partner.slug}. Adres strony, odznaka
          weryfikacji i pozycja w katalogu nie są edytowalne — o nich decyduje redakcja serwisu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Nazwa firmy</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              maxLength={150}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-description">Jedno zdanie o firmie</Label>
            <Input
              id="p-description"
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              maxLength={200}
              placeholder="Widoczne na kartach i na mapie"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-about">O firmie</Label>
            <Textarea
              id="p-about"
              value={form.about}
              onChange={(e) => update('about', e.target.value)}
              rows={5}
              placeholder="Kilka akapitów: od kiedy działacie, jak wygląda badanie, co klient dostaje."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-services">Zakres usług — jedna pozycja w linii</Label>
            <Textarea
              id="p-services"
              value={form.services}
              onChange={(e) => update('services', e.target.value)}
              rows={5}
              placeholder={'Oględziny przedzakupowe\nPomiar grubości lakieru\nDiagnostyka komputerowa\nSprawdzenie historii serwisowej'}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-phone">Telefon</Label>
              <Input
                id="p-phone"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-email">E-mail</Label>
              <Input
                id="p-email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                maxLength={150}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-website">Strona firmy</Label>
              <Input
                id="p-website"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                maxLength={200}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-contact">Link kontaktowy</Label>
              <Input
                id="p-contact"
                value={form.contact_url}
                onChange={(e) => update('contact_url', e.target.value)}
                maxLength={300}
                placeholder="Profil społecznościowy albo strona z ofertą"
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-price">Cena od (zł)</Label>
              <Input
                id="p-price"
                type="number"
                min="0"
                step="10"
                value={form.price_from}
                onChange={(e) => update('price_from', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-response">Czas reakcji</Label>
              <Input
                id="p-response"
                value={form.response_time}
                onChange={(e) => update('response_time', e.target.value)}
                maxLength={50}
                placeholder="Np. do 24h"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-city">Miasto</Label>
              <Input
                id="p-city"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label>Województwo</Label>
              <Select value={form.voivodeship} onValueChange={(v) => update('voivodeship', v)}>
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

          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              'Zapisz profil'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
