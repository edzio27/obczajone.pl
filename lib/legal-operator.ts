/**
 * Dane operatora używane w regulaminie i polityce prywatności.
 *
 * To jedyne miejsce, w którym trzeba je podmienić. Dopóki `isExampleData`
 * ma wartość true, na obu stronach wyświetla się ostrzeżenie, że dokumenty
 * zawierają dane przykładowe - po wpisaniu prawdziwych danych ustaw false.
 */
export const OPERATOR = {
  isExampleData: true,

  /** Imię i nazwisko albo pełna firma operatora. */
  legalName: 'Jan Kowalski',
  /** Adres wykonywania działalności / siedziby. */
  address: 'ul. Przykładowa 12/3, 40-001 Katowice',
  nip: '1234567890',
  regon: '123456789',
  /** Numer KRS i sąd rejestrowy - tylko dla spółek, dla JDG zostaw null. */
  registryEntry: null as string | null,

  email: 'kontakt@obczajone.pl',

  /** Dane inspektora ochrony danych albo null, jeżeli nie został powołany. */
  dataProtectionOfficer: null as string | null,

  /** Region projektu Supabase - decyduje, czy dane są przechowywane w UE. */
  supabaseRegion: 'Frankfurt, Niemcy (eu-central-1)',
  /**
   * Faktycznie używany hosting - ustalone z nagłówków produkcji
   * (server: Vercel, x-vercel-id: arn1, czyli region sztokholmski).
   */
  hostingProvider: 'Vercel Inc. (USA), z serwerami brzegowymi w regionie UE',
} as const;

/** Pełne oznaczenie operatora w jednym zdaniu, gotowe do wstawienia w tekst. */
export function operatorIdentification(): string {
  // Bez zwrotu "z siedzibą" - pasuje zarowno do osoby fizycznej prowadzacej
  // dzialalnosc, jak i do spolki.
  const parts = [
    OPERATOR.legalName,
    OPERATOR.address,
    `NIP ${OPERATOR.nip}`,
    `REGON ${OPERATOR.regon}`,
  ];

  if (OPERATOR.registryEntry) {
    parts.push(OPERATOR.registryEntry);
  }

  return parts.join(', ');
}
