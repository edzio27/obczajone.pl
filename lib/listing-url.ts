/**
 * Adres ogłoszenia w postaci, w jakiej wolno go zapisać.
 *
 * Ludzie wklejają link stamtąd, gdzie go dostali, więc do bazy trafiał razem
 * z ogonem: 271 z 1757 ogłoszeń ma w adresie query string, a w nim `utm_*`,
 * `fbclid`, `session_olx`, `_gl` albo identyfikator sesji OLX. Do wskazania
 * oferty żaden z tych parametrów nie jest potrzebny - ofertę identyfikuje
 * `-ID<id>.html` w ścieżce - a przechowywanie cudzych identyfikatorów sesji
 * w publicznie czytelnej tabeli jest gorsze niż bezużyteczne.
 */
export function canonicalListingUrl(raw: string): string {
  const trimmed = raw.trim();

  try {
    const parsed = new URL(trimmed);
    // Zapytanie i kotwica nie niosą nic o ofercie, więc nie wchodzą do bazy.
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // Adres nie do sparsowania i tak nie przejdzie listings_url_matches_source;
    // oddajemy go bez zmian, żeby walidacja wyżej zgłosiła właściwy błąd.
    return trimmed;
  }
}

/**
 * Czy to link do podglądu oferty, a nie do samej oferty.
 *
 * Otomoto dokleja `isPreview=1`, kiedy sprzedający ogląda własne ogłoszenie
 * przed publikacją. Takich adresów zebrało się 31 i nie były niczym oznaczone,
 * więc trafiały do statystyk na równi z ogłoszeniami, które ktokolwiek mógł
 * zobaczyć - jedno z nich zostało nawet wykresem na stronie głównej. Sprawdzamy
 * przed kanonizacją, bo to ona usuwa parametr, po którym je poznajemy.
 */
export function isPreviewListingUrl(raw: string): boolean {
  try {
    return new URL(raw.trim()).searchParams.has('isPreview');
  } catch {
    return false;
  }
}

const MULTI_WORD_BRANDS = ['mercedes-benz', 'alfa-romeo', 'land-rover', 'aston-martin', 'rolls-royce'];

/**
 * Marka i model wyczytane z adresu oferty Otomoto, np.
 * `/osobowe/oferta/ford-mondeo-ID6I2KY4.html` → „Ford Mondeo”.
 *
 * Potrzebne tam, gdzie oferty już nie ma i nie mamy z niej ani jednego pola:
 * ktoś wkleił link do zdjętego ogłoszenia, a my możemy przynajmniej pokazać
 * podobne auta z archiwum. To zgadywanie z adresu, więc wynik służy wyłącznie
 * do wyszukiwania, nigdy do opisu konkretnego auta.
 */
export function carNameFromListingUrl(raw: string): string | null {
  let path: string;
  try {
    path = new URL(raw.trim()).pathname;
  } catch {
    return null;
  }
  const match = path.match(/\/oferta\/([a-z0-9-]+?)-ID[0-9A-Za-z]+\.html$/);
  if (!match) return null;

  const slug = match[1];
  const brand = MULTI_WORD_BRANDS.find((b) => slug.startsWith(`${b}-`));
  const rest = brand ? slug.slice(brand.length + 1) : slug.split('-').slice(1).join('-');
  const brandPart = brand ?? slug.split('-')[0];
  const model = rest.split('-')[0];
  if (!brandPart || !model) return null;

  const capitalize = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  return `${brandPart.split('-').map(capitalize).join('-')} ${capitalize(model)}`;
}
