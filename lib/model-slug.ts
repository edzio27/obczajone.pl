/**
 * Adres strony modelu. Wydzielone z `price-trends`, bo tej jednej funkcji
 * potrzebuje też sitemapa, a nie ma powodu ciągnąć tam całego liczenia.
 */
export function slugifyModel(brand: string, model: string): string {
  return `${brand} ${model}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
