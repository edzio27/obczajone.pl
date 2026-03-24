'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Star, Loader as Loader2 } from 'lucide-react';

type Review = {
  id: string;
  visited_in_person: boolean;
  rating: number;
  price_difference: string;
  condition_difference: string;
  size_mileage_difference: string;
  equipment_difference: string;
  photos_difference: string;
  comment: string;
};

type ReviewEditDialogProps = {
  review: Review;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewUpdated: () => void;
};

export function ReviewEditDialog({ review, open, onOpenChange, onReviewUpdated }: ReviewEditDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [visitedInPerson, setVisitedInPerson] = useState<string>(review.visited_in_person ? 'yes' : 'no');
  const [rating, setRating] = useState(review.rating);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [priceDifference, setPriceDifference] = useState(review.price_difference);
  const [conditionDifference, setConditionDifference] = useState(review.condition_difference);
  const [sizeMileageDifference, setSizeMileageDifference] = useState(review.size_mileage_difference);
  const [equipmentDifference, setEquipmentDifference] = useState(review.equipment_difference);
  const [photosDifference, setPhotosDifference] = useState(review.photos_difference);
  const [comment, setComment] = useState(review.comment);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: 'Błąd',
        description: 'Musisz wybrać ocenę',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('reviews')
        .update({
          visited_in_person: visitedInPerson === 'yes',
          rating,
          price_difference: priceDifference,
          condition_difference: conditionDifference,
          size_mileage_difference: sizeMileageDifference,
          equipment_difference: equipmentDifference,
          photos_difference: photosDifference,
          comment,
          updated_at: new Date().toISOString(),
        })
        .eq('id', review.id);

      if (error) throw error;

      toast({
        title: 'Sukces',
        description: 'Opinia została zaktualizowana',
      });

      onOpenChange(false);
      onReviewUpdated();
    } catch (error: any) {
      toast({
        title: 'Błąd',
        description: error.message || 'Nie udało się zaktualizować opinii',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj opinię</DialogTitle>
          <DialogDescription>
            Zaktualizuj swoją opinię o tym ogłoszeniu
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Czy byłeś/aś na miejscu?</Label>
            <RadioGroup value={visitedInPerson} onValueChange={setVisitedInPerson}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="edit-yes" />
                <Label htmlFor="edit-yes" className="font-normal cursor-pointer">
                  Tak, widziałem/am osobiście
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="edit-no" />
                <Label htmlFor="edit-no" className="font-normal cursor-pointer">
                  Nie, opieram się na ogłoszeniu
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>Ocena ogólna *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-price">Cena (różnice vs ogłoszenie)</Label>
            <Textarea
              id="edit-price"
              value={priceDifference}
              onChange={(e) => setPriceDifference(e.target.value)}
              placeholder="np. Cena wyższa o 5000 zł niż podana w ogłoszeniu"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-condition">Stan (różnice vs ogłoszenie)</Label>
            <Textarea
              id="edit-condition"
              value={conditionDifference}
              onChange={(e) => setConditionDifference(e.target.value)}
              placeholder="np. Stan gorszy niż w opisie, widoczne rysy"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-size">Wielkość / Przebieg (różnice vs ogłoszenie)</Label>
            <Textarea
              id="edit-size"
              value={sizeMileageDifference}
              onChange={(e) => setSizeMileageDifference(e.target.value)}
              placeholder="np. Przebieg faktycznie wyższy o 20 tys km"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-equipment">Wyposażenie (różnice vs ogłoszenie)</Label>
            <Textarea
              id="edit-equipment"
              value={equipmentDifference}
              onChange={(e) => setEquipmentDifference(e.target.value)}
              placeholder="np. Brak klimatyzacji mimo zapewnień w ogłoszeniu"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-photos">Zdjęcia (różnice vs rzeczywistość)</Label>
            <Textarea
              id="edit-photos"
              value={photosDifference}
              onChange={(e) => setPhotosDifference(e.target.value)}
              placeholder="np. Zdjęcia retuszowane, w rzeczywistości więcej uszkodzeń"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-comment">Dodatkowy komentarz</Label>
            <Textarea
              id="edit-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Twoje dodatkowe uwagi..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Zapisywanie...
                </>
              ) : (
                'Zapisz zmiany'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
