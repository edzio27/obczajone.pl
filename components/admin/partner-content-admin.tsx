'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Check, Star, Trash2 } from 'lucide-react';
import { VERDICT_LABELS } from '@/lib/partner-data';

type PendingReview = {
  id: string;
  partner_id: string;
  rating: number;
  comment: string;
  service_type: string;
  is_verified_customer: boolean;
  created_at: string;
};

type PendingInspection = {
  id: string;
  partner_id: string;
  listing_id: string;
  verdict: keyof typeof VERDICT_LABELS;
  summary: string;
  findings: string[];
  price_opinion: string;
  created_at: string;
};

/**
 * Moderacja treści, które partnerzy i użytkownicy publikują wokół partnerów.
 * Trzymana osobno od moderacji opinii o ogłoszeniach, bo tu stawką jest reputacja
 * konkretnej firmy - a to zupełnie inny rodzaj ryzyka niż opinia o aucie.
 */
export function PartnerContentAdmin({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [inspections, setInspections] = useState<PendingInspection[]>([]);
  const [partnerNames, setPartnerNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: reviewsData }, { data: inspectionsData }, { data: partners }] = await Promise.all([
      supabase
        .from('partner_reviews')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('partner_inspections')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false }),
      supabase.from('partners').select('id, name'),
    ]);

    const names = new Map<string, string>();
    (partners || []).forEach((p: any) => names.set(p.id, p.name));

    const pendingReviews = (reviewsData as PendingReview[]) || [];
    const pendingInspections = (inspectionsData as PendingInspection[]) || [];

    setReviews(pendingReviews);
    setInspections(pendingInspections);
    setPartnerNames(names);
    onCountChange?.(pendingReviews.length + pendingInspections.length);
    setLoading(false);
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(
    table: 'partner_reviews' | 'partner_inspections',
    id: string,
    action: 'approve' | 'delete'
  ) {
    const { error } =
      action === 'approve'
        ? await supabase.from(table).update({ is_approved: true }).eq('id', id)
        : await supabase.from(table).delete().eq('id', id);

    if (error) {
      toast({ title: 'Nie udało się wykonać operacji', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: action === 'approve' ? 'Opublikowano' : 'Usunięto' });
    load();
  }

  if (loading) return <p className="text-muted-foreground">Ładowanie...</p>;

  if (reviews.length === 0 && inspections.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center py-10">
          <p className="text-muted-foreground">Nic nie czeka na moderację.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Opinie o partnerach ({reviews.length})</h3>
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {partnerNames.get(review.partner_id) ?? 'Partner'}
                        </span>
                        {review.is_verified_customer && (
                          <Badge variant="outline" className="text-success border-success/30 text-xs">
                            kontakt przez serwis
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), {
                          addSuffix: true,
                          locale: pl,
                        })}
                        {review.service_type ? ` · ${review.service_type}` : ''}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {review.rating}
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </span>
                  </div>

                  <p className="text-sm text-gray-700 whitespace-pre-line">{review.comment}</p>

                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => moderate('partner_reviews', review.id, 'approve')}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Publikuj
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => moderate('partner_reviews', review.id, 'delete')}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Usuń
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {inspections.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">Oględziny partnerów ({inspections.length})</h3>
          <div className="space-y-3">
            {inspections.map((inspection) => (
              <Card key={inspection.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                    <div>
                      <span className="font-medium">
                        {partnerNames.get(inspection.partner_id) ?? 'Partner'}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(inspection.created_at), {
                          addSuffix: true,
                          locale: pl,
                        })}
                        {' · '}
                        <Link href={`/listing/${inspection.listing_id}`} className="underline">
                          zobacz ogłoszenie
                        </Link>
                      </p>
                    </div>
                    <Badge variant="outline">{VERDICT_LABELS[inspection.verdict]}</Badge>
                  </div>

                  <p className="text-sm text-gray-700 whitespace-pre-line">{inspection.summary}</p>

                  {inspection.findings.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {inspection.findings.map((finding, index) => (
                        <li key={index} className="text-sm text-gray-600">
                          • {finding}
                        </li>
                      ))}
                    </ul>
                  )}

                  {inspection.price_opinion && (
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>O cenie:</strong> {inspection.price_opinion}
                    </p>
                  )}

                  <div className="flex gap-2 pt-4">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => moderate('partner_inspections', inspection.id, 'approve')}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Publikuj
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => moderate('partner_inspections', inspection.id, 'delete')}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Usuń
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
