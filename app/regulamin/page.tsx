import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { LegalDocument, type LegalSection } from '@/components/legal-document';
import { OPERATOR, operatorIdentification } from '@/lib/legal-operator';

export const metadata: Metadata = {
  title: 'Regulamin serwisu — obczajone.pl',
  description:
    'Regulamin korzystania z serwisu obczajone.pl: zakres usług, zasady dodawania opinii, zgłaszanie treści bezprawnych, reklamacje.',
  alternates: { canonical: '/regulamin' },
};

const LAST_UPDATED = '22 sierpnia 2026';

const sections: LegalSection[] = [
  {
    title: '1. Postanowienia ogólne',
    blocks: [
      {
        type: 'p',
        text: `Operatorem serwisu obczajone.pl (dalej: „Serwis") jest ${operatorIdentification()} (dalej: „Operator").`,
      },
      {
        type: 'p',
        text: `Kontakt z Operatorem jest możliwy pod adresem e-mail: ${OPERATOR.email}.`,
      },
      {
        type: 'p',
        text: 'Regulamin określa zasady korzystania z Serwisu, rodzaje i zakres świadczonych usług, warunki zakładania i usuwania konta, zasady dodawania opinii, tryb zgłaszania treści bezprawnych oraz tryb postępowania reklamacyjnego.',
      },
      {
        type: 'p',
        text: 'Rozpoczęcie korzystania z Serwisu oznacza akceptację Regulaminu. Korzystanie z Serwisu jest nieodpłatne.',
      },
    ],
  },
  {
    title: '2. Definicje',
    blocks: [
      {
        type: 'ul',
        items: [
          'Użytkownik — osoba fizyczna korzystająca z Serwisu, zarówno zalogowana, jak i niezalogowana.',
          'Konto — zbiór danych powiązanych z Użytkownikiem, umożliwiający dodawanie opinii i zapisywanie ogłoszeń.',
          'Ogłoszenie — oferta sprzedaży opublikowana w zewnętrznym serwisie ogłoszeniowym (m.in. Otomoto, Otodom), której dotyczą dane prezentowane w Serwisie.',
          'Sprzedający — podmiot lub osoba wskazana w Ogłoszeniu jako oferujący przedmiot sprzedaży, w tym pośrednik lub komis.',
          'Opinia — treść dodana przez Użytkownika, dotycząca Ogłoszenia lub kontaktu ze Sprzedającym, wraz z oceną liczbową i ewentualnymi zdjęciami.',
          'Opinia AI — automatycznie wygenerowane podsumowanie Ogłoszenia, oznaczone w Serwisie jako pochodzące od systemu sztucznej inteligencji.',
          'Partner — podmiot świadczący usługi sprawdzania pojazdów lub nieruchomości, prezentowany w Serwisie.',
        ],
      },
    ],
  },
  {
    title: '3. Rodzaje i zakres usług',
    blocks: [
      { type: 'p', text: 'W ramach Serwisu Operator udostępnia:' },
      {
        type: 'ul',
        items: [
          'możliwość sprawdzenia Ogłoszenia przez podanie jego adresu URL,',
          'historię zmian ceny Ogłoszenia od momentu dodania go do Serwisu,',
          'Opinię AI dotyczącą Ogłoszenia,',
          'możliwość czytania i dodawania Opinii innych Użytkowników,',
          'mapę Sprzedających i pośredników wraz z ocenami,',
          'Konto wraz z listą zapisanych Ogłoszeń.',
        ],
      },
      {
        type: 'p',
        text: 'Wszystkie informacje prezentowane w Serwisie mają charakter wyłącznie informacyjny. Nie stanowią one rekomendacji zakupu, wyceny, opinii rzeczoznawcy, porady prawnej ani doradztwa inwestycyjnego, a decyzję o zawarciu transakcji Użytkownik podejmuje samodzielnie i na własne ryzyko.',
      },
    ],
  },
  {
    title: '4. Wymagania techniczne',
    blocks: [
      {
        type: 'p',
        text: 'Do korzystania z Serwisu niezbędne jest urządzenie z dostępem do internetu i aktualną przeglądarką z włączoną obsługą JavaScript i plików cookie. Do założenia Konta wymagany jest aktywny adres e-mail albo konto Google lub Facebook.',
      },
      {
        type: 'p',
        text: 'Operator informuje, że korzystanie z usług świadczonych drogą elektroniczną wiąże się z typowym ryzykiem, w szczególności możliwością działania szkodliwego oprogramowania oraz prób nieuprawnionego dostępu do danych. Zalecane jest korzystanie z aktualnego oprogramowania antywirusowego i unikalnego hasła.',
      },
    ],
  },
  {
    title: '5. Konto Użytkownika',
    blocks: [
      {
        type: 'ul',
        items: [
          'Konto zakłada się przez podanie adresu e-mail i hasła albo przez zalogowanie się kontem Google lub Facebook.',
          'Konto może założyć osoba, która ukończyła 16 lat.',
          'Użytkownik nie może udostępniać Konta osobom trzecim ani zakładać wielu Kont w celu wpływania na oceny.',
          `Użytkownik może w każdej chwili usunąć Konto, wysyłając żądanie na adres ${OPERATOR.email}. Usunięcie Konta nie powoduje automatycznego usunięcia opublikowanych Opinii, które mogą pozostać w Serwisie w formie pozbawionej powiązania z Kontem — chyba że Użytkownik zażąda również ich usunięcia.`,
          'Operator może zawiesić lub usunąć Konto w razie istotnego naruszenia Regulaminu, informując o tym Użytkownika wraz z uzasadnieniem.',
        ],
      },
    ],
  },
  {
    title: '6. Zasady dodawania Opinii',
    blocks: [
      {
        type: 'p',
        text: 'Opinia musi opierać się na rzeczywistym doświadczeniu Użytkownika związanym z danym Ogłoszeniem lub kontaktem ze Sprzedającym. Zakazane jest dodawanie Opinii na zlecenie, w zamian za korzyść oraz Opinii dotyczących własnych Ogłoszeń.',
      },
      { type: 'p', text: 'Opinia nie może zawierać:' },
      {
        type: 'ul',
        items: [
          'treści bezprawnych, wulgarnych, gróźb ani nawoływania do nienawiści,',
          'danych osobowych osób trzecich, w szczególności numerów telefonu, adresów, numerów rejestracyjnych, numerów kont bankowych i wizerunku osób,',
          'twierdzeń o popełnieniu przestępstwa przez konkretną osobę, jeżeli nie zostało to stwierdzone prawomocnym orzeczeniem,',
          'treści reklamowych i odesłań do konkurencyjnych ofert,',
          'materiałów naruszających prawa autorskie osób trzecich.',
        ],
      },
      {
        type: 'p',
        text: 'Opinie podlegają moderacji i mogą zostać opublikowane po sprawdzeniu przez Operatora. Operator może odmówić publikacji albo usunąć Opinię naruszającą Regulamin lub przepisy prawa, informując o tym autora wraz z uzasadnieniem.',
      },
      {
        type: 'p',
        text: 'Dodając Opinię lub zdjęcie, Użytkownik oświadcza, że przysługują mu prawa do tej treści, i udziela Operatorowi nieodpłatnej, niewyłącznej licencji na jej publikację w Serwisie oraz prezentowanie w wynikach wyszukiwania. Użytkownik zachowuje prawa do swoich treści i może w każdej chwili żądać ich usunięcia.',
      },
    ],
  },
  {
    title: '7. Dane pochodzące z serwisów ogłoszeniowych',
    blocks: [
      {
        type: 'p',
        text: 'Serwis prezentuje dane dotyczące Ogłoszeń pochodzące z zewnętrznych serwisów ogłoszeniowych. Operator nie jest powiązany z Otomoto, Otodom ani z żadnym innym serwisem ogłoszeniowym, nie jest stroną prezentowanych transakcji i nie odpowiada za treść ani aktualność Ogłoszeń.',
      },
      {
        type: 'p',
        text: 'Dane w Serwisie mogą być nieaktualne lub niepełne, w szczególności gdy Ogłoszenie zostało zmienione albo usunięte w serwisie źródłowym. Przed podjęciem decyzji Użytkownik powinien zweryfikować informacje bezpośrednio w Ogłoszeniu.',
      },
    ],
  },
  {
    title: '8. Opinia AI',
    blocks: [
      {
        type: 'p',
        text: 'Opinia AI jest generowana automatycznie przez system sztucznej inteligencji na podstawie treści Ogłoszenia i jest oznaczona w Serwisie odpowiednią etykietą. Powstaje bez udziału człowieka i może zawierać błędy, uproszczenia lub wnioski nieodpowiadające stanowi faktycznemu.',
      },
      {
        type: 'p',
        text: 'Opinia AI nie stanowi wyceny, ekspertyzy technicznej ani oceny wiarygodności Sprzedającego i nie może być jedyną podstawą decyzji zakupowej.',
      },
    ],
  },
  {
    title: '9. Zgłaszanie treści bezprawnych',
    blocks: [
      {
        type: 'p',
        text: `Każdy może zgłosić treść dostępną w Serwisie, którą uważa za bezprawną lub naruszającą Regulamin, wysyłając wiadomość na adres ${OPERATOR.email}. Dotyczy to również Sprzedających, których dotyczy Opinia.`,
      },
      { type: 'p', text: 'Zgłoszenie powinno zawierać:' },
      {
        type: 'ul',
        items: [
          'adres URL strony, na której znajduje się zgłaszana treść,',
          'wskazanie zgłaszanej treści i wyjaśnienie, dlaczego jest ona bezprawna lub narusza Regulamin,',
          'dane kontaktowe zgłaszającego umożliwiające udzielenie odpowiedzi,',
          'oświadczenie, że informacje zawarte w zgłoszeniu są zgodne z prawdą.',
        ],
      },
      {
        type: 'p',
        text: 'Operator potwierdza otrzymanie zgłoszenia, rozpatruje je bez zbędnej zwłoki, nie później niż w terminie 14 dni, i informuje zgłaszającego o podjętej decyzji wraz z jej uzasadnieniem. O usunięciu treści i przyczynach tej decyzji Operator informuje również jej autora, któremu przysługuje prawo odwołania na ten sam adres e-mail w terminie 14 dni.',
      },
      {
        type: 'p',
        text: 'W przypadku uzasadnionych wątpliwości co do zgodności Opinii z prawem Operator może wstrzymać jej publikację do czasu wyjaśnienia sprawy.',
      },
    ],
  },
  {
    title: '10. Odpowiedzialność',
    blocks: [
      {
        type: 'ul',
        items: [
          'Operator nie jest stroną transakcji zawieranych między Użytkownikami a Sprzedającymi i nie odpowiada za ich przebieg.',
          'Operator nie gwarantuje, że Ogłoszenie ocenione pozytywnie jest wiarygodne, ani że ocenione negatywnie jest nieuczciwe.',
          'Operator nie odpowiada za treść Opinii dodanych przez Użytkowników, z zastrzeżeniem obowiązków wynikających z trybu opisanego w punkcie 9.',
          'Operator dokłada starań, aby Serwis działał nieprzerwanie, zastrzega jednak możliwość przerw technicznych oraz czasowego ograniczenia funkcji.',
          'Powyższe ograniczenia nie wyłączają ani nie ograniczają odpowiedzialności Operatora w zakresie, w jakim przepisy bezwzględnie obowiązujące, w szczególności przepisy o ochronie konsumentów, tego zabraniają.',
        ],
      },
    ],
  },
  {
    title: '11. Reklamacje',
    blocks: [
      {
        type: 'p',
        text: `Reklamacje dotyczące działania Serwisu można składać na adres ${OPERATOR.email}. Reklamacja powinna zawierać opis problemu oraz dane umożliwiające kontakt.`,
      },
      {
        type: 'p',
        text: 'Operator rozpatruje reklamację w terminie 14 dni od jej otrzymania i informuje o wyniku na podany adres e-mail.',
      },
    ],
  },
  {
    title: '12. Zmiany Regulaminu',
    blocks: [
      {
        type: 'p',
        text: 'Operator może zmienić Regulamin z ważnych przyczyn, w szczególności w razie zmiany przepisów prawa albo zakresu świadczonych usług. O zmianie Użytkownicy posiadający Konto są informowani na adres e-mail przypisany do Konta oraz przez komunikat w Serwisie, z co najmniej 14-dniowym wyprzedzeniem.',
      },
      {
        type: 'p',
        text: 'Brak akceptacji zmian uprawnia Użytkownika do usunięcia Konta przed dniem wejścia zmian w życie.',
      },
    ],
  },
  {
    title: '13. Postanowienia końcowe',
    blocks: [
      {
        type: 'p',
        text: 'W sprawach nieuregulowanych Regulaminem zastosowanie mają przepisy prawa polskiego, w szczególności Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą elektroniczną.',
      },
      {
        type: 'p',
        text: 'Konsument może skorzystać z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w tym z platformy internetowego rozstrzygania sporów dostępnej pod adresem ec.europa.eu/consumers/odr.',
      },
      {
        type: 'p',
        text: 'Zasady przetwarzania danych osobowych opisuje Polityka prywatności dostępna w Serwisie.',
      },
    ],
  },
];

export default function RegulaminPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <LegalDocument
        title="Regulamin serwisu"
        lastUpdated={LAST_UPDATED}
        intro="Regulamin określa zasady korzystania z serwisu obczajone.pl. Prosimy o zapoznanie się z nim przed rozpoczęciem korzystania z Serwisu."
        sections={sections}
      />
      <Footer />
    </div>
  );
}
