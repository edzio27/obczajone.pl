/**
 * Większa wersja zdjęcia z CDN-u Otomoto/Otodom (olxcdn).
 *
 * Przeloty zapisują w `listings.image_url` miniaturę z listy wyników, czyli
 * `;s=320x240` (w praktyce 180×240 px). Na stronie ogłoszenia rozciągnięta
 * na całą szerokość wyglądała jak rozmazany kafelek. CDN oddaje ten sam plik
 * w innym rozmiarze po samej zmianie parametru `s`.
 */
export function largePhotoUrl(url: string): string {
  if (!url.includes('olxcdn.com')) return url;
  return url.replace(/;s=\d+x\d+/, ';s=1280x960');
}
