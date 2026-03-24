'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { checkRateLimit, recordAction } from '@/lib/rate-limit';
import { Star } from 'lucide-react';

type ReviewFormProps = {
  listingId: string;
  onReviewAdded?: () => void;
  hasUserReview?: boolean;
};

export function ReviewForm({ listingId, onReviewAdded, hasUserReview }: ReviewFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [visitedInPerson, setVisitedInPerson] = useState<string>('no');
  const [rating, setRating] = useState(3);
  const [priceDifference, setPriceDifference] = useState('');
  const [conditionDifference, setConditionDifference] = useState('');
  const [sizeMileageDifference, setSizeMileageDifference] = useState('');
  const [equipmentDifference, setEquipmentDifference] = useState('');
  const [photosDifference, setPhotosDifference] = useState('');
  const [comment, setComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: 'Zaloguj się',
        description: 'Musisz być zalogowany, aby dodać opinię',
        variant: 'destructive',
      });
      return;
    }

    const canProceed = await checkRateLimit(user.id, 'add_review', 20, 60);

    if (!canProceed) {
      toast({
        title: 'Limit przekroczony',
        description: 'Możesz dodać maksymalnie 20 opinii na godzinę',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from('reviews').insert({
        listing_id: listingId,
        user_id: user.id,
        visited_in_person: visitedInPerson === 'yes',
        rating,
        price_difference: priceDifference,
        condition_difference: conditionDifference,
        size_mileage_difference: sizeMileageDifference,
        equipment_difference: equipmentDifference,
        photos_difference: photosDifference,
        comment,
      });

      if (error) throw error;

      await recordAction(user.id, 'add_review');

      toast({
        title: 'Opinia dodana',
        description: 'Twoja opinia czeka na moderację',
      });

      setVisitedInPerson('no');
      setRating(3);
      setPriceDifference('');
      setConditionDifference('');
      setSizeMileageDifference('');
      setEquipmentDifference('');
      setPhotosDifference('');
      setComment('');

      if (onReviewAdded) {
        onReviewAdded();
      }
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się dodać opinii',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dodaj opinię</CardTitle>
          <CardDescription>Zaloguj się, aby dodać swoją opinię o tym ogłoszeniu</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (hasUserReview) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dodaj opinię</CardTitle>
        <CardDescription>
          Podziel się swoją opinią o tym ogłoszeniu. Wszystkie opinie są moderowane.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label>Czy byłeś/byłaś na miejscu?</Label>
            <RadioGroup value={visitedInPerson} onValueChange={setVisitedInPerson}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="visited-yes" />
                <Label htmlFor="visited-yes">Tak, byłem/byłam osobiście</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="visited-no" />
                <Label htmlFor="visited-no">Nie, kontaktowałem/am się tylko</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Ocena (1-5)</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 ${
                      value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="price">Co było inne niż w ogłoszeniu - Cena</Label>
            <Textarea
              id="price"
              value={priceDifference}
              onChange={(e) => setPriceDifference(e.target.value)}
              placeholder="np. Negocjował cenę w dół o 5000 zł"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="condition">Stan</Label>
            <Textarea
              id="condition"
              value={conditionDifference}
              onChange={(e) => setConditionDifference(e.target.value)}
              placeholder="np. Stan gorszy niż na zdjęciach, widoczne uszkodzenia"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="size">Wielkość / Przebieg</Label>
            <Textarea
              id="size"
              value={sizeMileageDifference}
              onChange={(e) => setSizeMileageDifference(e.target.value)}
              placeholder="np. Przebieg prawdopodobnie cofnięty"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="equipment">Wyposażenie</Label>
            <Textarea
              id="equipment"
              value={equipmentDifference}
              onChange={(e) => setEquipmentDifference(e.target.value)}
              placeholder="np. Brak klimatyzacji pomimo informacji w ogłoszeniu"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="photos">Zdjęcia</Label>
            <Textarea
              id="photos"
              value={photosDifference}
              onChange={(e) => setPhotosDifference(e.target.value)}
              placeholder="np. Zdjęcia były mocno przerobione, kolory inne"
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="comment">Dodatkowy komentarz</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Twoja szczegółowa opinia..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Dodawanie...' : 'Dodaj opinię'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
