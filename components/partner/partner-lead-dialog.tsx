'use client';

import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Loader as Loader2, CircleCheck as CheckCircle2 } from 'lucide-react';

export type LeadContext = 'partner_page' | 'listing_cta' | 'partners_page';

type PartnerLeadDialogProps = {
  partnerId: string;
  partnerName: string;
  listingId?: string | null;
  context?: LeadContext;
  children: ReactNode;
};

/**
 * Formularz zapytania do partnera. To jest jedyne miejsce, w którym powstaje
 * policzalny lead - kliknięcie w link partnera mówi tylko tyle, że ktoś wyszedł
 * ze strony, a rozliczyć da się dopiero konkretne zapytanie z kontaktem.
 *
 * Nie wymagamy logowania: żądanie numeru telefonu i założenia konta naraz kosztuje
 * więcej leadów, niż warta jest atrybucja. Gdy użytkownik jest zalogowany,
 * zapisujemy user_id - dzięki temu jego późniejsza opinia o partnerze dostaje
 * automatycznie znacznik "zweryfikowany klient".
 */
export function PartnerLeadDialog({
  partnerId,
  partnerName,
  listingId,
  context = 'partner_page',
  children,
}: PartnerLeadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (name.trim().length < 2) {
      toast({ title: 'Podaj imię', description: 'Partner musi wiedzieć, do kogo oddzwania.', variant: 'destructive' });
      return;
    }

    if (!phone.trim() && !email.trim()) {
      toast({
        title: 'Brak kontaktu',
        description: 'Podaj telefon albo e-mail - inaczej partner nie ma jak odpowiedzieć.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('partner_leads').insert({
      partner_id: partnerId,
      listing_id: listingId ?? null,
      user_id: user?.id ?? null,
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      message: message.trim(),
      context,
    });

    setLoading(false);

    if (error) {
      const isRateLimited = error.message?.includes('Rate limit');
      toast({
        title: isRateLimited ? 'Za dużo zapytań' : 'Nie udało się wysłać',
        description: isRateLimited
          ? 'Wysłałeś już kilka zapytań w krótkim czasie. Spróbuj ponownie za godzinę.'
          : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    setSent(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset dopiero przy zamknięciu, żeby potwierdzenie zdążyło się pokazać.
      setTimeout(() => {
        setSent(false);
        setMessage('');
      }, 200);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="text-center py-4">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <DialogTitle className="mb-2">Zapytanie wysłane</DialogTitle>
            <DialogDescription>
              {partnerName} dostał Twoje dane kontaktowe i odezwie się bezpośrednio do Ciebie.
              Gdy już po wszystkim, wróć i wystaw opinię — to ona pomaga kolejnym kupującym
              wybrać dobrze.
            </DialogDescription>
            <Button className="mt-5 w-full" onClick={() => handleOpenChange(false)}>
              Zamknij
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Zapytanie do: {partnerName}</DialogTitle>
              <DialogDescription>
                Zostaw kontakt, a partner odezwie się z terminem i wyceną. Zapytanie jest
                niezobowiązujące.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Imię *</Label>
                <Input
                  id="lead-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Telefon</Label>
                  <Input
                    id="lead-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={30}
                    placeholder="600 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-email">E-mail</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={150}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead-message">Czego dotyczy zapytanie?</Label>
                <Textarea
                  id="lead-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Np. Audi A4 2015, oględziny w Poznaniu, najlepiej w weekend."
                />
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Wysyłając zapytanie przekazujesz podane dane firmie {partnerName}, która skontaktuje
                się z Tobą w sprawie usługi. Szczegóły w{' '}
                <a href="/polityka-prywatnosci" className="underline hover:text-primary">
                  polityce prywatności
                </a>
                .
              </p>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  'Wyślij zapytanie'
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
