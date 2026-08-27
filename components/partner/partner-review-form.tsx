'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { AuthDialog } from '@/components/auth/auth-dialog';
import { Star, Loader as Loader2 } from 'lucide-react';
import type { PartnerReview } from '@/lib/partner-data';

type PartnerReviewFormProps = {
  partnerId: string;
  partnerName: string;
  onSubmitted?: () => void;
};

export function PartnerReviewForm({ partnerId, partnerName, onSubmitted }: PartnerReviewFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [existing, setExisting] = useState<PartnerReview | null>(null);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [serviceType, setServiceType] = useState('');
  const [comment, setComment] = useState('');

  // Jedna opinia na użytkownika - jeśli już jakąś wystawił, formularz staje się
  // edycją zamiast pokazywać błąd unikalności dopiero po kliknięciu "Wyślij".
  useEffect(() => {
    if (!user) {
      setExisting(null);
      return;
    }

    let cancelled = false;
    setChecking(true);

    supabase
      .from('partner_reviews')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const review = data as PartnerReview;
          setExisting(review);
          setRating(review.rating);
          setServiceType(review.service_type);
          setComment(review.comment);
        }
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, partnerId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!user) {
      setAuthDialogOpen(true);
      return;
    }

    if (comment.trim().length < 20) {
      toast({
        title: 'Napisz kilka zdań',
        description: 'Ocena bez uzasadnienia nikomu nie pomaga. Minimum 20 znaków.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const payload = {
      rating,
      service_type: serviceType.trim(),
      comment: comment.trim(),
    };

    const { error } = existing
      ? await supabase.from('partner_reviews').update(payload).eq('id', existing.id)
      : await supabase.from('partner_reviews').insert({ ...payload, partner_id: partnerId, user_id: user.id });

    setLoading(false);

    if (error) {
      const isRateLimited = error.message?.includes('Rate limit');
      const isSelfReview = error.message?.includes('cannot review itself');
      toast({
        title: isSelfReview ? 'To Twoja firma' : isRateLimited ? 'Za dużo opinii' : 'Nie udało się zapisać',
        description: isSelfReview
          ? 'Nie można wystawić opinii własnej firmie.'
          : isRateLimited
          ? 'Spróbuj ponownie za godzinę.'
          : 'Spróbuj ponownie za chwilę.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: existing ? 'Opinia zaktualizowana' : 'Dziękujemy za opinię',
      description: 'Trafiła do moderacji i pojawi się publicznie po sprawdzeniu.',
    });

    onSubmitted?.();
  }

  if (!user) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Korzystałeś z usług tej firmy?</CardTitle>
            <CardDescription>
              Zaloguj się, żeby wystawić opinię. Wymagamy konta, bo opinie dotyczą konkretnej firmy
              i muszą mieć autora.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setAuthDialogOpen(true)}>Zaloguj się i oceń</Button>
          </CardContent>
        </Card>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {existing ? 'Twoja opinia o tej firmie' : `Oceń: ${partnerName}`}
        </CardTitle>
        <CardDescription>
          {existing
            ? 'Możesz poprawić swoją opinię — po edycji wróci do moderacji.'
            : 'Napisz, co firma sprawdziła i czy było warto. Opinia trafia do moderacji przed publikacją.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Ocena</Label>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  aria-label={`Ocena ${star} z 5`}
                  className="p-0.5"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= (hoverRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="service-type">Z czego korzystałeś?</Label>
            <Input
              id="service-type"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              maxLength={100}
              placeholder="Np. oględziny przedzakupowe, pomiar lakieru"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="partner-comment">Opinia *</Label>
            <Textarea
              id="partner-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={3000}
              placeholder="Co sprawdzili, jak szybko przyjechali, czy raport był konkretny, czy uchronił Cię przed czymś?"
              required
            />
          </div>

          <Button type="submit" disabled={loading || checking}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Zapisywanie...
              </>
            ) : existing ? (
              'Zapisz zmiany'
            ) : (
              'Wyślij opinię'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
