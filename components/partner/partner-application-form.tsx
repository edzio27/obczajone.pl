'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { VOIVODESHIPS } from '@/lib/geo';
import { Loader as Loader2, CircleCheck as CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'car', label: 'Sprawdzam samochody' },
  { value: 'home', label: 'Sprawdzam nieruchomości' },
  { value: 'both', label: 'Jedno i drugie' },
];

export function PartnerApplicationForm() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    nip: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    voivodeship: '',
    category: 'car',
    website: '',
    message: '',
  });

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (form.company_name.trim().length < 2 || !form.email.trim()) {
      toast({
        title: 'Uzupełnij dane',
        description: 'Nazwa firmy i e-mail są niezbędne, żeby się odezwać.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('partner_applications').insert({
      company_name: form.company_name.trim(),
      nip: form.nip.trim(),
      contact_name: form.contact_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      city: form.city.trim(),
      voivodeship: form.voivodeship,
      category: form.category,
      website: form.website.trim(),
      message: form.message.trim(),
    });

    setLoading(false);

    if (error) {
      toast({
        title: error.message?.includes('Rate limit') ? 'Spróbuj za chwilę' : 'Nie udało się wysłać',
        description: 'Możesz też napisać bezpośrednio na kontakt@obczajone.pl',
        variant: 'destructive',
      });
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="pt-6 text-center py-10">
          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">Zgłoszenie przyjęte</h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Odezwiemy się w ciągu kilku dni roboczych. Sprawdzimy dane firmy, ustalimy zakres
            i założymy profil — nic nie musisz robić do tego czasu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company">Nazwa firmy *</Label>
              <Input
                id="company"
                value={form.company_name}
                onChange={(e) => update('company_name', e.target.value)}
                maxLength={150}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nip">NIP</Label>
              <Input
                id="nip"
                value={form.nip}
                onChange={(e) => update('nip', e.target.value)}
                maxLength={20}
                placeholder="Przyspiesza weryfikację"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Osoba kontaktowa</Label>
              <Input
                id="contact-name"
                value={form.contact_name}
                onChange={(e) => update('contact_name', e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-email">E-mail *</Label>
              <Input
                id="app-email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                maxLength={150}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app-phone">Telefon</Label>
              <Input
                id="app-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app-website">Strona / profil</Label>
              <Input
                id="app-website"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                maxLength={200}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app-city">Miasto</Label>
              <Input
                id="app-city"
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
            <div className="space-y-2">
              <Label>Co sprawdzasz?</Label>
              <Select value={form.category} onValueChange={(v) => update('category', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-message">Kilka słów o firmie</Label>
            <Textarea
              id="app-message"
              value={form.message}
              onChange={(e) => update('message', e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Od kiedy działacie, ilu klientów miesięcznie, jaki obszar obsługujecie, czym się wyróżniacie."
            />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Dane z formularza wykorzystujemy wyłącznie do kontaktu w sprawie współpracy. Szczegóły w{' '}
            <a href="/polityka-prywatnosci" className="underline hover:text-primary">
              polityce prywatności
            </a>
            .
          </p>

          <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wysyłanie...
              </>
            ) : (
              'Wyślij zgłoszenie'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
