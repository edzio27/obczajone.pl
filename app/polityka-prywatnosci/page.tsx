import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { LegalDocument, type LegalSection } from '@/components/legal-document';
import { OPERATOR, operatorIdentification } from '@/lib/legal-operator';

export const metadata: Metadata = {
  title: 'Polityka prywatności — obczajone.pl',
  description:
    'Jakie dane zbiera obczajone.pl, w jakim celu, komu je powierzamy i jakie prawa przysługują użytkownikom oraz sprzedającym.',
  alternates: { canonical: '/polityka-prywatnosci' },
};

const LAST_UPDATED = '22 sierpnia 2026';

const sections: LegalSection[] = [
  {
    title: '1. Administrator danych',
    blocks: [
      {
        type: 'p',
        text: `Administratorem danych osobowych przetwarzanych w serwisie obczajone.pl jest ${operatorIdentification()} (dalej: „Administrator").`,
      },
      {
        type: 'p',
        text: `We wszystkich sprawach dotyczących danych osobowych można kontaktować się pod adresem: ${OPERATOR.email}.`,
      },
      ...(OPERATOR.dataProtectionOfficer
        ? [
            {
              type: 'p' as const,
              text: `Administrator wyznaczył inspektora ochrony danych: ${OPERATOR.dataProtectionOfficer}.`,
            },
          ]
        : []),
    ],
  },
  {
    title: '2. Jakie dane przetwarzamy i w jakim celu',
    blocks: [
      { type: 'p', text: 'Dane użytkowników serwisu:' },
      {
        type: 'ul',
        items: [
          'Adres e-mail i hasło — w celu założenia i obsługi konta. Podstawa: art. 6 ust. 1 lit. b RODO (wykonanie umowy o świadczenie usług). Hasła przechowujemy wyłącznie w postaci skrótu i nie mamy do nich dostępu.',
          'Nazwa wyświetlana, a w przypadku kont partnerskich także logo — w celu podpisania opinii. Podstawa: art. 6 ust. 1 lit. b RODO.',
          'Dane z konta Google lub Facebook (adres e-mail, identyfikator konta) — jeżeli użytkownik wybierze logowanie przez te serwisy. Podstawa: art. 6 ust. 1 lit. b RODO.',
          'Treść opinii, ocena liczbowa oraz dodane zdjęcia — w celu publikacji w serwisie. Podstawa: art. 6 ust. 1 lit. b RODO. Opinie są publicznie dostępne, w tym w wynikach wyszukiwarek.',
          'Lista zapisanych ogłoszeń — w celu udostępnienia funkcji ulubionych. Podstawa: art. 6 ust. 1 lit. b RODO.',
          'Zgłoszenia opinii wraz z podaną przyczyną — w celu moderacji treści. Podstawa: art. 6 ust. 1 lit. c oraz lit. f RODO (obowiązek prawny i prawnie uzasadniony interes polegający na zapewnieniu zgodności treści z prawem).',
          'Dane techniczne przetwarzane przez dostawcę infrastruktury, w tym adres IP i informacje o przeglądarce zapisywane w logach serwera — w celu zapewnienia bezpieczeństwa i przeciwdziałania nadużyciom. Podstawa: art. 6 ust. 1 lit. f RODO.',
        ],
      },
      {
        type: 'p',
        text: 'Nie prowadzimy profilowania użytkowników w celach marketingowych, nie sprzedajemy danych i nie przekazujemy ich brokerom danych.',
      },
    ],
  },
  {
    title: '3. Dane sprzedających i pośredników pochodzące z ogłoszeń',
    blocks: [
      {
        type: 'p',
        text: 'Ta sekcja dotyczy osób, które nie są użytkownikami serwisu, ale których dane mogą się w nim znaleźć.',
      },
      {
        type: 'p',
        text: 'W serwisie prezentujemy dane sprzedających i pośredników pochodzące z publicznie dostępnych ogłoszeń w zewnętrznych serwisach ogłoszeniowych. Zakres tych danych może obejmować: nazwę lub imię wskazane w ogłoszeniu, numer telefonu, adres oraz miejscowość, a także przybliżone współrzędne geograficzne ustalane na podstawie adresu.',
      },
      {
        type: 'p',
        text: 'Źródłem tych danych są ogłoszenia opublikowane przez sprzedających w serwisach ogłoszeniowych, a w zakresie współrzędnych — usługa geokodowania Nominatim (OpenStreetMap Foundation).',
      },
      {
        type: 'p',
        text: 'Podstawą przetwarzania jest art. 6 ust. 1 lit. f RODO — prawnie uzasadniony interes polegający na umożliwieniu kupującym weryfikacji ofert i ograniczeniu ryzyka nieuczciwych transakcji. Informację tę udostępniamy publicznie na podstawie art. 14 ust. 5 lit. b RODO, ponieważ indywidualne poinformowanie każdej osoby, której dane pochodzą z ogłoszenia, wymagałoby niewspółmiernie dużego wysiłku.',
      },
      {
        type: 'p',
        text: `Każdej z tych osób przysługuje prawo wniesienia sprzeciwu wobec przetwarzania oraz prawo żądania usunięcia danych. Żądanie można zgłosić na adres ${OPERATOR.email}. Rozpatrujemy je bez zbędnej zwłoki, nie później niż w terminie miesiąca. W razie uwzględnienia sprzeciwu usuwamy dane wraz z powiązanymi z nimi ocenami.`,
      },
    ],
  },
  {
    title: '4. Komu powierzamy dane',
    blocks: [
      {
        type: 'p',
        text: 'Korzystamy z usług podmiotów przetwarzających dane w naszym imieniu oraz odbiorców danych:',
      },
      {
        type: 'ul',
        items: [
          `Supabase — baza danych, uwierzytelnianie i przechowywanie zdjęć. Projekt uruchomiono w regionie: ${OPERATOR.supabaseRegion}.`,
          `Hosting serwisu — ${OPERATOR.hostingProvider}.`,
          'Anthropic — dostawca modelu językowego generującego opinię AI. Przekazujemy mu treść ogłoszenia; nie przekazujemy danych konta ani treści opinii użytkowników.',
          'OpenStreetMap Foundation — kafelki map oraz geokodowanie adresów. Wyświetlenie mapy powoduje połączenie przeglądarki użytkownika z serwerami tej organizacji, której udostępniany jest adres IP.',
          'Google Ireland Limited i Meta Platforms Ireland Limited — wyłącznie w zakresie obsługi logowania, jeżeli użytkownik wybierze tę metodę.',
        ],
      },
      {
        type: 'p',
        text: 'Dane mogą być przekazywane poza Europejski Obszar Gospodarczy, w szczególności do Stanów Zjednoczonych. Przekazanie odbywa się na podstawie decyzji Komisji Europejskiej o odpowiednim stopniu ochrony albo standardowych klauzul umownych.',
      },
    ],
  },
  {
    title: '5. Jak długo przechowujemy dane',
    blocks: [
      {
        type: 'ul',
        items: [
          'Dane konta — przez czas jego istnienia, a po usunięciu konta przez okres niezbędny do ustalenia lub dochodzenia roszczeń, nie dłużej niż 3 lata.',
          'Opinie i zdjęcia — do czasu ich usunięcia przez autora lub przez nas, przy czym po usunięciu konta mogą pozostać w serwisie bez powiązania z kontem, o ile autor nie zażąda ich usunięcia.',
          'Zgłoszenia treści i korespondencja reklamacyjna — 3 lata od zakończenia sprawy.',
          'Logi techniczne — zgodnie z polityką dostawcy infrastruktury, standardowo nie dłużej niż 12 miesięcy.',
        ],
      },
    ],
  },
  {
    title: '6. Prawa osób, których dane dotyczą',
    blocks: [
      { type: 'p', text: 'Przysługuje Ci prawo do:' },
      {
        type: 'ul',
        items: [
          'dostępu do swoich danych i otrzymania ich kopii,',
          'sprostowania danych nieprawidłowych,',
          'usunięcia danych,',
          'ograniczenia przetwarzania,',
          'przenoszenia danych przetwarzanych na podstawie umowy,',
          'wniesienia sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,',
          'cofnięcia zgody w każdej chwili, jeżeli przetwarzanie odbywa się na jej podstawie — bez wpływu na zgodność z prawem przetwarzania sprzed cofnięcia.',
        ],
      },
      {
        type: 'p',
        text: `Żądania realizujemy po zgłoszeniu na adres ${OPERATOR.email}, bez zbędnej zwłoki i nie później niż w terminie miesiąca.`,
      },
      {
        type: 'p',
        text: 'Przysługuje Ci również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193 Warszawa.',
      },
    ],
  },
  {
    title: '7. Pliki cookie i pamięć przeglądarki',
    blocks: [
      {
        type: 'p',
        text: 'Serwis korzysta wyłącznie z rozwiązań niezbędnych do jego działania. Nie stosujemy cookies analitycznych, reklamowych ani narzędzi śledzących, dlatego nie prosimy o zgodę na ich wykorzystanie.',
      },
      {
        type: 'ul',
        items: [
          'Dane sesji logowania zapisywane przez mechanizm uwierzytelniania Supabase w pamięci przeglądarki — niezbędne do utrzymania zalogowania.',
          'Wpis „cookie-consent-ack" w pamięci lokalnej przeglądarki — zapamiętuje, że komunikat o plikach cookie został potwierdzony, dzięki czemu nie pojawia się ponownie.',
        ],
      },
      {
        type: 'p',
        text: 'Zawartość pamięci przeglądarki można w każdej chwili usunąć w jej ustawieniach. Usunięcie danych sesji spowoduje wylogowanie.',
      },
    ],
  },
  {
    title: '8. Zautomatyzowane przetwarzanie',
    blocks: [
      {
        type: 'p',
        text: 'Opinia AI oraz ocena ogłoszenia są generowane automatycznie na podstawie treści ogłoszenia i historii jego ceny. Dotyczą one ogłoszenia, a nie oceny osoby, i nie wywołują wobec nikogo skutków prawnych ani nie wpływają w podobnie istotny sposób na sytuację osób, których dane dotyczą, w rozumieniu art. 22 RODO.',
      },
    ],
  },
  {
    title: '9. Bezpieczeństwo',
    blocks: [
      {
        type: 'p',
        text: 'Stosujemy środki techniczne i organizacyjne odpowiadające ryzyku, w tym szyfrowanie połączeń, uwierzytelnianie dostępu do bazy danych oraz zasady dostępu ograniczające widoczność danych na poziomie bazy. Żaden środek nie zapewnia jednak pełnego bezpieczeństwa, dlatego zalecamy stosowanie unikalnego hasła.',
      },
    ],
  },
  {
    title: '10. Zmiany polityki',
    blocks: [
      {
        type: 'p',
        text: 'Politykę możemy aktualizować w razie zmiany zakresu usług, dostawców lub przepisów prawa. Aktualna wersja jest zawsze dostępna pod tym adresem, a datę ostatniej zmiany podajemy na początku dokumentu. O istotnych zmianach informujemy posiadaczy kont pocztą elektroniczną.',
      },
    ],
  },
];

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LegalDocument
        title="Polityka prywatności"
        lastUpdated={LAST_UPDATED}
        intro="Poniżej opisujemy, jakie dane zbiera serwis obczajone.pl, po co, komu je powierzamy i jakie prawa przysługują użytkownikom oraz osobom, których dane pochodzą z ogłoszeń."
        sections={sections}
      />
      <Footer />
    </div>
  );
}
