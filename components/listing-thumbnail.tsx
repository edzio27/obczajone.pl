'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Miniatura ogłoszenia wydzielona do komponentu klienckiego.
 *
 * Zdjęcia pochodzą ze scrapowanych ogłoszeń i potrafią zniknąć razem z ofertą,
 * więc potrzebny jest onError - a ten wymaga komponentu klienckiego. Wydzielenie
 * samej miniatury pozwala zostawić całą resztę karty (tytuł, cena, link) po
 * stronie serwera, gdzie ma trafić do HTML-a bez kosztu w JS.
 */
export function ListingThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <ImageOff className="h-6 w-6 text-gray-300" />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      onError={() => setFailed(true)}
    />
  );
}
