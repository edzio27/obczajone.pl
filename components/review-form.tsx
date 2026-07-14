'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { Star, X, Loader as Loader2, ImagePlus } from 'lucide-react';

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
  const [comment, setComment] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = selectedFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const addFiles = useCallback((files: File[]) => {
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
  }, [selectedFiles, toast]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    addFiles(files);
    event.target.value = '';
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ALLOWED_TYPES.includes(f.type)
    );
    if (files.length > 0) addFiles(files);
  }, [addFiles]);

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

      // Note: rate-limit recording now happens atomically in a database
      // trigger (enforce_review_rate_limit) alongside the insert itself, so
      // it can't be skipped by bypassing the client. No separate client-side
      // recordAction() call is needed here (it would double-count).

      toast({
        title: 'Opinia dodana',
        description: selectedFiles.length > 0
          ? `Opinia ze zdjęciami czeka na moderację`
          : 'Twoja opinia czeka na moderację',
      });

      setVisitedInPerson('no');
      setRating(3);
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
                  aria-label={`Oceń na ${value} z 5 gwiazdek`}
                  aria-pressed={value === rating}
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
            <Label htmlFor="comment">Twoja opinia</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Opisz swoje doświadczenie z tym ogłoszeniem..."
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <Label>Zdjęcia (opcjonalnie)</Label>
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                id="review-photos"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading || selectedFiles.length >= MAX_PHOTOS}
              />

              {selectedFiles.length < MAX_PHOTOS && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-6 text-center cursor-pointer
                    transition-all duration-200
                    ${isDragging
                      ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                      : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
                    }
                    ${uploading ? 'pointer-events-none opacity-60' : ''}
                  `}
                >
                  <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <div className={`p-2 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <ImagePlus className={`h-5 w-5 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    {isDragging ? (
                      <p className="text-sm font-medium text-blue-600">Upuść zdjęcia tutaj</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-700">
                          Przeciągnij i upuść lub <span className="text-blue-600">kliknij</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedFiles.length}/{MAX_PHOTOS} zdjęć — JPEG, PNG, WebP, maks. 5 MB
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${file.size}-${file.lastModified}`} className="relative group">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                        <img
                          src={previewUrls[index]}
                          alt={`Podgląd ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          aria-label={`Usuń zdjęcie ${index + 1}`}
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
