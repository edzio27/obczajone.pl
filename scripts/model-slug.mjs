// Kopia lib/model-slug.ts dla skryptów node (bez kroku kompilacji TS).
export function slugifyModel(brand, model) {
  return `${brand} ${model}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
