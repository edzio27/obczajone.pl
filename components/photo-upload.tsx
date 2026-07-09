'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Loader as Loader2, ImagePlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_PHOTOS = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Photo = {
  id: string;
  photo_url: string;
  file_size: number;
  order_index: number;
  uploaded_at: string;
  user_id: string;
};

type PhotoUploadProps = {
  listingId: string;
  onPhotosChange?: () => void;
};

export function PhotoUpload({ listingId, onPhotosChange }: PhotoUploadProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useState(() => {
    loadPhotos();
  });

  async function loadPhotos() {
    try {
      const { data, error } = await supabase
        .from('user_listing_photos')
        .select('*')
        .eq('listing_id', listingId)
        .order('order_index');

      if (error) throw error;
      setPhotos(data || []);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFiles(files: File[]) {
    if (!user) {
      toast({
        title: 'Musisz być zalogowany',
        description: 'Zaloguj się, aby dodać zdjęcia',
        variant: 'destructive',
      });
      return;
    }

    const userPhotosCount = photos.filter(p => p.user_id === user.id).length;
    const remainingSlots = MAX_PHOTOS - userPhotosCount;

    if (remainingSlots <= 0) {
      toast({
        title: 'Limit zdjęć',
        description: `Możesz dodać maksymalnie ${MAX_PHOTOS} zdjęć`,
        variant: 'destructive',
      });
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    const invalidFiles = filesToUpload.filter(
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

    setUploading(true);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${listingId}/${Date.now()}_${i}.${fileExt}`;

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
            photo_url: publicUrl,
            file_size: file.size,
            order_index: userPhotosCount + i,
          });

        if (dbError) throw dbError;
      }

      toast({
        title: 'Zdjęcia dodane',
        description: `Pomyślnie dodano ${filesToUpload.length} zdjęć`,
      });

      await loadPhotos();
      onPhotosChange?.();
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się dodać zdjęć',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    await uploadFiles(files);
    event.target.value = '';
  }

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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(f =>
      ALLOWED_TYPES.includes(f.type)
    );
    if (files.length === 0) return;
    await uploadFiles(files);
  }, [photos, user]);

  async function handleDelete(photo: Photo) {
    if (!user || photo.user_id !== user.id) return;

    try {
      const fileName = photo.photo_url.split('/listing-photos/')[1];

      await supabase.storage
        .from('listing-photos')
        .remove([fileName]);

      const { error } = await supabase
        .from('user_listing_photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;

      toast({
        title: 'Zdjęcie usunięte',
        description: 'Zdjęcie zostało pomyślnie usunięte',
      });

      await loadPhotos();
      onPhotosChange?.();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast({
        title: 'Błąd',
        description: 'Nie udało się usunąć zdjęcia',
        variant: 'destructive',
      });
    }
  }

  const userPhotos = photos.filter(p => p.user_id === user?.id);
  const otherPhotos = photos.filter(p => p.user_id !== user?.id);
  const canUpload = user && userPhotos.length < MAX_PHOTOS;

  return (
    <div className="space-y-6">
      {user && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold">Twoje zdjęcia</h3>
                <p className="text-sm text-muted-foreground">
                  {userPhotos.length}/{MAX_PHOTOS} zdjęć
                </p>
              </div>
              {canUpload && (
                <div>
                  <input
                    ref={inputRef}
                    type="file"
                    id="photo-upload"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                  <label htmlFor="photo-upload">
                    <Button
                      asChild
                      disabled={uploading}
                      className="cursor-pointer"
                    >
                      <span>
                        {uploading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Wysyłanie...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Dodaj zdjęcia
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              )}
            </div>

            {canUpload && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && inputRef.current?.click()}
                className={`
                  relative mb-4 border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                  transition-all duration-200
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                    : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
                  }
                  ${uploading ? 'pointer-events-none opacity-60' : ''}
                `}
              >
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                  <div className={`p-3 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <ImagePlus className={`h-6 w-6 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                  </div>
                  {uploading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Wysyłanie zdjęć...
                    </div>
                  ) : isDragging ? (
                    <p className="text-sm font-medium text-blue-600">Upuść zdjęcia tutaj</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-700">
                        Przeciągnij i upuść zdjęcia lub <span className="text-blue-600">kliknij</span>
                      </p>
                      <p className="text-xs text-muted-foreground">JPEG, PNG, WebP — maks. 5 MB każde</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {userPhotos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {userPhotos.map((photo) => (
                  <div key={photo.id} className="relative group overflow-hidden rounded-lg border border-gray-200 hover:border-blue-300 transition-all">
                    <button
                      onClick={() => window.open(photo.photo_url, '_blank')}
                      className="relative w-full h-48 bg-gray-100 cursor-pointer"
                    >
                      <img
                        src={photo.photo_url}
                        alt="Zdjęcie użytkownika"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                        {(photo.file_size / 1024).toFixed(0)} KB
                      </div>
                    </button>
                    <button
                      onClick={() => handleDelete(photo)}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                      title="Usuń zdjęcie"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {userPhotos.length === 0 && !canUpload && (
              <div className="text-center py-8 text-muted-foreground">
                Nie dodałeś jeszcze żadnych zdjęć tego ogłoszenia
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {otherPhotos.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">
              Zdjęcia innych użytkowników ({otherPhotos.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {otherPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => window.open(photo.photo_url, '_blank')}
                  className="relative overflow-hidden rounded-lg border border-gray-200 hover:border-blue-300 transition-all group cursor-pointer"
                >
                  <div className="relative w-full h-48 bg-gray-100">
                    <img
                      src={photo.photo_url}
                      alt="Zdjęcie użytkownika"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
