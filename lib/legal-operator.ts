/**
 * Dane operatora używane w regulaminie i polityce prywatności.
 *
 * To jedyne miejsce, w którym trzeba je podmienić. Pola wymagane, które zostaną
 * puste, wypisuje `missingOperatorData()` - a oba dokumenty wyświetlają wtedy
 * ostrzeżenie, żeby niekompletna wersja nie przeszła niezauważona na produkcję.
 */
export const OPERATOR = {
  /** Imię i nazwisko albo pełna firma operatora. */
  legalName: 'Kamil Kowalski',
  /** Nazwa, pod którą prowadzona jest działalność. Dla spółki zostaw null. */
  tradeName: 'EloPomelo' as string | null,
  /** Adres wykonywania działalności / siedziby. */
  address: 'ul. Kłodzka 32/9, 50-536 Wrocław',

  nip: '6572799496' as string | null,
  /** Opcjonalny - ustawa o świadczeniu usług drogą elektroniczną go nie wymaga. */
  regon: null as string | null,
  /** Numer KRS i sąd rejestrowy - tylko dla spółek, dla JDG zostaw null. */
  registryEntry: null as string | null,

  email: 'kontakt@obczajone.pl',

  /** Dane inspektora ochrony danych albo null, jeżeli nie został powołany. */
  dataProtectionOfficer: null as string | null,

  /** Region projektu Supabase - decyduje, czy dane są przechowywane w UE. */
  supabaseRegion: 'Frankfurt, Niemcy (eu-central-1)' as string | null,
  /**
   * Faktycznie używany hosting - ustalone z nagłówków produkcji
   * (server: Vercel, x-vercel-id: arn1, czyli region sztokholmski).
   */
  hostingProvider: 'Vercel Inc. (USA), z serwerami brzegowymi w regionie UE',
};

/**
 * Pola, bez których dokumenty nie powinny trafić na produkcję. NIP wynika wprost
 * z ustawy o świadczeniu usług drogą elektroniczną (REGON już nie, dlatego go tu
 * nie ma), a region bazy danych decyduje o tym, co możemy napisać o
 * przechowywaniu danych w UE.
 */
const REQUIRED_FIELDS: Array<[keyof typeof OPERATOR, string]> = [
  // Etykiety w dopełniaczu - wchodzą do zdania "Brakuje: ...".
  ['legalName', 'oznaczenia operatora'],
  ['address', 'adresu'],
  ['nip', 'numeru NIP'],
  ['supabaseRegion', 'regionu bazy danych'],
];

export function missingOperatorData(): string[] {
  return REQUIRED_FIELDS.filter(([key]) => !OPERATOR[key]).map(([, label]) => label);
}

/** Pełne oznaczenie operatora w jednym zdaniu, gotowe do wstawienia w tekst. */
export function operatorIdentification(): string {
  const parts: string[] = [OPERATOR.legalName];

  if (OPERATOR.tradeName) {
    parts.push(`prowadzący działalność gospodarczą pod firmą ${OPERATOR.tradeName}`);
  }

  parts.push(OPERATOR.address);

  // Brakujące numery pomijamy w zdaniu zamiast wstawiać puste miejsca - o tym,
  // że dokument jest niekompletny, informuje osobny komunikat na stronie.
  if (OPERATOR.nip) parts.push(`NIP ${OPERATOR.nip}`);
  if (OPERATOR.regon) parts.push(`REGON ${OPERATOR.regon}`);
  if (OPERATOR.registryEntry) parts.push(OPERATOR.registryEntry);

  return parts.join(', ');
}
