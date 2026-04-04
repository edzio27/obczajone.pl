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
import { Star, Upload, X, Loader as Loader2 } from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = MAX_PHOTOS - selectedFiles.length;
    if (remainingSlots <= 0) {
      toast({
        title: 'Limit zdjęć',
        description: `Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęć`,
        variant: 'destructive',
      });
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    const invalidFiles = filesToAdd.filter(
      file => !ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE
    );

    if (invalidFiles.length > 0) {
      toast({
        title: 'Nieprawidłowe pliki',
        description: 'Akceptowane formaty: JPEG, PNG, WebP. Max rozmiar: 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFiles(prev => [...prev, ...filesToAdd]);
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

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
    setUploading(true);

    try {
      const { data: reviewData, error: reviewError } = await supabase.from('reviews').insert({
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
      }).select().single();

      if (reviewError) throw reviewError;

      if (selectedFiles.length > 0 && reviewData) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${listingId}/${reviewData.id}/${Date.now()}_${i}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('listing-photos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('listing-photos')
            .getPublicUrl(fileName);

          const { error: dbError } = await supabase
            .from('user_listing_photos')
            .insert({
              listing_id: listingId,
              user_id: user.id,
              review_id: reviewData.id,
              photo_url: publicUrl,
              file_size: file.size,
              order_index: i,
            });

          if (dbError) throw dbError;
        }
      }

      await recordAction(user.id, 'add_review');

      toast({
        title: 'Opinia dodana',
        description: selectedFiles.length > 0
          ? `Opinia ze zdjęciami czeka na moderację`
          : 'Twoja opinia czeka na moderację',
      });

      setVisitedInPerson('no');
      setRating(3);
      setPriceDifference('');
      setConditionDifference('');
      setSizeMileageDifference('');
      setEquipmentDifference('');
      setPhotosDifference('');
      setComment('');
      setSelectedFiles([]);

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
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <Card data-review-form>
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
    <Card data-review-form>
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

          <div className="space-y-3">
            <Label>Zdjęcia (opcjonalnie)</Label>
            <div className="space-y-3">
              <div>
                <input
                  type="file"
                  id="review-photos"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading || selectedFiles.length >= MAX_PHOTOS}
                />
                <label htmlFor="review-photos">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={uploading || selectedFiles.length >= MAX_PHOTOS}
                    className="cursor-pointer"
                  >
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Dodaj zdjęcia ({selectedFiles.length}/{MAX_PHOTOS})
                    </span>
                  </Button>
                </label>
              </div>

              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Podgląd ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                          {(file.size / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Maksymalnie {MAX_PHOTOS} zdjęć. Dozwolone formaty: JPEG, PNG, WebP. Max rozmiar: 5MB
              </p>
            </div>
          </div>

          <Button type="submit" disabled={loading || uploading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploading ? 'Wysyłanie zdjęć...' : 'Dodawanie...'}
              </>
            ) : (
              'Dodaj opinię'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
