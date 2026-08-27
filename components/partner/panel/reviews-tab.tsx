'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Clock, MessageSquare, Star } from 'lucide-react';
import type { PartnerReview } from '@/lib/partner-data';

type ReviewsTabProps = {
  partnerId: string;
  reviews: PartnerReview[];
  onChanged: () => void;
};

/**
 * Prawo do odpowiedzi po stronie partnera. Publikowanie krytyki firmy bez
 * możliwości odniesienia się do niej na tej samej stronie jest nie do obrony -
 * i pod DSA jest to skarga, której da się uniknąć.
 */
export function ReviewsTab({ partnerId, reviews, onChanged }: ReviewsTabProps) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [saving, setSaving] = useState(false);

  function startEditing(review: PartnerReview) {
    setEditingId(review.id);
    setReplyBody(review.reply?.body ?? '');
  }

  async function saveReply(review: PartnerReview) {
    if (replyBody.trim().length === 0) return;

    setSaving(true);

    const { error } = review.reply
      ? await supabase
          .from('partner_review_replies')
          .update({ body: replyBody.trim(), updated_at: new Date().toISOString() })
          .eq('id', review.reply.id)
      : await supabase.from('partner_review_replies').insert({
          review_id: review.id,
          partner_id: partnerId,
          body: replyBody.trim(),
        });

    setSaving(false);

    if (error) {
      toast({ title: 'Nie udało się zapisać odpowiedzi', variant: 'destructive' });
      return;
    }

    toast({ title: 'Odpowiedź zapisana', description: 'Jest widoczna pod opinią na Twoim profilu.' });
    setEditingId(null);
    onChanged();
  }

  if (reviews.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="pt-6 text-center py-10">
          <p className="text-muted-foreground max-w-md mx-auto">
            Nikt jeszcze nie ocenił Twojej firmy. Najprostszy sposób na pierwsze opinie: po
            zakończonym zleceniu wyślij klientowi link do swojego profilu.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {review.author?.display_name ?? 'Użytkownik'}
                  </span>
                  {!review.is_approved && (
                    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Czeka na moderację
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(review.created_at), 'd MMMM yyyy', { locale: pl })}
                  {review.service_type ? ` · ${review.service_type}` : ''}
                </p>
              </div>
              <span className="inline-flex" aria-label={`Ocena ${review.rating} z 5`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
              </span>
            </div>

            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
              {review.comment}
            </p>

            {editingId === review.id ? (
              <div className="mt-4 space-y-3">
                <Textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={3}
                  maxLength={3000}
                  placeholder="Odpowiedz rzeczowo. Ta odpowiedź jest publiczna i widoczna pod opinią."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveReply(review)} disabled={saving}>
                    {saving ? 'Zapisywanie...' : 'Opublikuj odpowiedź'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Anuluj
                  </Button>
                </div>
              </div>
            ) : review.reply ? (
              <div className="mt-4 border-l-2 border-primary/30 bg-primary/5 rounded-r-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Twoja odpowiedź
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => startEditing(review)}>
                    Edytuj
                  </Button>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-line">{review.reply.body}</p>
              </div>
            ) : (
              review.is_approved && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => startEditing(review)}>
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                  Odpowiedz
                </Button>
              )
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
