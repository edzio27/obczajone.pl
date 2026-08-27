import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PartnerApplicationForm } from '@/components/partner/partner-application-form';
import {
  BadgeCheck,
  ChartNoAxesColumn,
  ClipboardCheck,
  Globe,
  Handshake,
  MessageSquare,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dla firm sprawdzających auta i nieruchomości — współpraca | obczajone.pl',
  description:
    'Sprawdzasz auta lub mieszkania przed zakupem? Dostań własną podstronę z opiniami, zapytania od kupujących z konkretnych ogłoszeń i panel ze statystykami. Pierwsze 3 miesiące bez opłat.',
  alternates: { canonical: '/dla-firm' },
  openGraph: {
    title: 'Współpraca dla firm sprawdzających auta i nieruchomości',
    description:
      'Własna podstrona z opiniami, policzalne zapytania od kupujących i publikacja oględzin przy ogłoszeniu.',
    url: '/dla-firm',
    type: 'website',
    locale: 'pl_PL',
    siteName: 'obczajone.pl',
  },
};

const BENEFITS = [
  {
    icon: Globe,
    title: 'Własna podstrona w Google',
    body: 'obczajone.pl/partner/twoja-firma — indeksowana strona z opisem, zakresem usług, oceną i opiniami klientów. Dane strukturalne LocalBusiness, więc ocena ma szansę wyświetlić się już w wynikach wyszukiwania. To zostaje Twoje, nawet jeśli kiedyś zakończymy współpracę.',
  },
  {
    icon: MessageSquare,
    title: 'Zapytania, nie kliknięcia',
    body: 'Przycisk „Zamów sprawdzenie” stoi przy konkretnym ogłoszeniu i na Twoim profilu. Dostajesz imię, telefon i link do auta, którego zapytanie dotyczy — czyli kontakt do kogoś, kto właśnie ogląda konkretną ofertę, a nie anonimowy ruch.',
  },
  {
    icon: ClipboardCheck,
    title: 'Twoje oględziny widoczne publicznie',
    body: 'Raport, który dziś trafia do jednego klienta i tam umiera, możesz opublikować przy ogłoszeniu. Twój werdykt czyta każdy kolejny zainteresowany tym autem — z Twoją nazwą i linkiem do profilu.',
  },
  {
    icon: ChartNoAxesColumn,
    title: 'Liczby, nie deklaracje',
    body: 'W panelu widzisz wyświetlenia profilu, kliknięcia, zapytania i ich status — oraz ruch, który Ty wysyłasz do nas swoim linkiem czy kodem QR. Obie strony patrzą na te same liczby.',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Zgłaszasz firmę',
    body: 'Wypełniasz formularz na dole tej strony. Sprawdzamy dane firmy i obszar działania.',
  },
  {
    number: '2',
    title: 'Zakładamy profil i konto',
    body: 'Dostajesz podstronę z opisem, cennikiem „od” i zakresem usług oraz login do panelu partnera.',
  },
  {
    number: '3',
    title: 'Pojawiasz się przy ogłoszeniach',
    body: 'Twoja firma trafia do CTA przy ogłoszeniach z Twojego regionu i na mapę partnerów.',
  },
  {
    number: '4',
    title: 'Odbierasz zapytania i budujesz oceny',
    body: 'Kontakty lądują w panelu. Po usłudze klient wystawia opinię, a Ty możesz na nią odpowiedzieć.',
  },
];

const VERIFICATION_CRITERIA = [
  'Zarejestrowana działalność — sprawdzamy NIP w rejestrze.',
  'Potwierdzony kontakt: telefon i adres e-mail, które faktycznie odpowiadają.',
  'Jasno określony obszar działania i zakres usług.',
  'Co najmniej 3 opublikowane opinie od klientów.',
  'Brak nierozpatrzonych zgłoszeń dotyczących firmy.',
];

const FAQ = [
  {
    q: 'Ile to kosztuje?',
    a: 'Pierwsze trzy miesiące: nic. Chcemy, żebyś zobaczył realne liczby, zanim porozmawiamy o pieniądzach — a my potrzebujemy ich tak samo, bo bez nich nie mamy czego wyceniać. Po pilocie proponujemy rozliczenie za przekazany kontakt. Nie ma abonamentu, który trzeba płacić w miesiącu bez zapytań.',
  },
  {
    q: 'Co dostajecie w zamian w okresie pilotażu?',
    a: 'Link albo kod QR do obczajone.pl u Ciebie — w stopce strony, w opisie profilu, na wizytówce zostawianej klientowi. Mierzymy to osobno, więc widać, ile ruchu idzie w każdą stronę.',
  },
  {
    q: 'Czy mogę kupić lepszą pozycję w wynikach?',
    a: 'Tak, ale zawsze z widoczną etykietą „Promowane”. Nieoznaczone płatne pozycjonowanie w wynikach jest nieuczciwą praktyką rynkową i nie będziemy tego robić — również dlatego, że katalog, któremu nikt nie ufa, jest bezwartościowy także dla Ciebie.',
  },
  {
    q: 'Co, jeśli dostanę niesprawiedliwą opinię?',
    a: 'Każda opinia przechodzi moderację przed publikacją, a do każdej możesz dodać publiczną odpowiedź widoczną pod nią. Opinię naruszającą regulamin możesz zgłosić — rozpatrujemy takie zgłoszenia i usuwamy to, co nie powinno się ukazać. Nie usuwamy opinii tylko dlatego, że są negatywne.',
  },
  {
    q: 'Czy muszę publikować swoje raporty z oględzin?',
    a: 'Nie. To Twoja decyzja przy każdym pojedynczym zleceniu i wymaga zgody klienta, który za raport zapłacił. Publikacja skróconego werdyktu działa jednak lepiej niż jakakolwiek reklama, jaką moglibyśmy Ci sprzedać.',
  },
  {
    q: 'Kto sprawdza opinie o mojej firmie?',
    a: 'Opinie mogą wystawiać wyłącznie zalogowani użytkownicy, jedna osoba jedną opinię o danej firmie, i każda przechodzi moderację. Autorzy, którzy wcześniej wysłali do Ciebie zapytanie przez nasz serwis, dostają widoczne oznaczenie — to jedyna rzecz, którą potrafimy zweryfikować technicznie, więc tylko przy niej stawiamy taką etykietę.',
  },
];

export default function ForBusinessPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto space-y-16">
          <section className="text-center">
            <Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
              <Handshake className="h-3.5 w-3.5 mr-1.5" />
              Program partnerski
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 text-balance">
              Kupujący sprawdza ogłoszenie u nas.<br className="hidden md:block" /> Następny telefon
              niech wykona do Ciebie.
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Do obczajone.pl trafiają ludzie w jednym konkretnym momencie: znaleźli ofertę, chcą ją
              obejrzeć i boją się, że coś przeoczą. Dokładnie wtedy potrzebują kogoś takiego jak Ty.
            </p>
            <Button size="lg" asChild className="shadow-md">
              <a href="#zgloszenie">Zgłoś swoją firmę</a>
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Pierwsze 3 miesiące bez opłat. Bez umowy na czas określony.
            </p>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">Co dostajesz</h2>
            <p className="text-gray-600 text-center max-w-2xl mx-auto mb-8">
              Nie sprzedajemy banera. Każdy z tych czterech punktów zostawia u Ciebie coś, co da się
              policzyć albo pokazać klientowi.
            </p>
            <div className="grid md:grid-cols-2 gap-5">
              {BENEFITS.map(({ icon: Icon, title, body }) => (
                <Card key={title} className="h-full">
                  <CardContent className="pt-6">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Jak to działa</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {STEPS.map((step) => (
                <div key={step.number} className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center mb-3">
                    {step.number}
                  </div>
                  <h3 className="font-semibold mb-1.5">{step.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{step.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-primary rounded-3xl p-8 md:p-12 text-white">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Zasady, na których się umawiamy</h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div>
                <p className="text-3xl font-bold mb-2">0 zł</p>
                <p className="font-medium mb-1">Pierwsze 3 miesiące</p>
                <p className="text-sm text-white/75 leading-relaxed">
                  Pełny profil, zapytania i panel. W zamian prosimy o link lub kod QR do nas — u
                  siebie, tam gdzie to naturalne.
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-2">Za kontakt</p>
                <p className="font-medium mb-1">Po pilotażu</p>
                <p className="text-sm text-white/75 leading-relaxed">
                  Rozliczenie za przekazane zapytanie, ustalone na podstawie tego, ile ich realnie
                  było. Bez abonamentu płaconego w martwym miesiącu.
                </p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-2">Zawsze</p>
                <p className="font-medium mb-1">Jawność</p>
                <p className="text-sm text-white/75 leading-relaxed">
                  Płatne wyróżnienie jest oznaczone jako promowane. Opinii nie kasujemy za to, że są
                  negatywne — ani Twoich, ani konkurencji.
                </p>
              </div>
            </div>
          </section>

          <section id="weryfikacja" className="scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <BadgeCheck className="h-6 w-6 text-success" />
              <h2 className="text-2xl md:text-3xl font-bold">Odznaka „Zweryfikowany partner”</h2>
            </div>
            <p className="text-gray-600 mb-6">
              Odznaka bez kryteriów jest ozdobą, więc kryteria są tutaj i każdy może je przeczytać.
              Firma dostaje ją, gdy spełnia wszystkie poniższe warunki:
            </p>

            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {VERIFICATION_CRITERIA.map((criterion) => (
                    <li key={criterion} className="flex items-start gap-3 text-sm text-gray-700">
                      <ShieldCheck className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
                      {criterion}
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                  <TriangleAlert className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Czego odznaka <strong>nie</strong> oznacza: nie jest gwarancją jakości usługi,
                    ubezpieczeniem ani poręczeniem za wynik oględzin. Mówi wyłącznie o tym, że
                    sprawdziliśmy istnienie i dane firmy oraz że ma opinie od klientów.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Najczęstsze pytania</h2>
            <div className="space-y-4">
              {FAQ.map(({ q, a }) => (
                <Card key={q}>
                  <CardContent className="pt-6">
                    <h3 className="font-semibold mb-2 flex items-start gap-2">
                      <Search className="h-4 w-4 text-primary flex-shrink-0 mt-1" />
                      {q}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed pl-6">{a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section id="zgloszenie" className="scroll-mt-24">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Zgłoś swoją firmę</h2>
            <p className="text-gray-600 mb-6">
              Odezwiemy się w ciągu kilku dni roboczych. Jeśli wolisz e-mail, napisz na{' '}
              <a href="mailto:kontakt@obczajone.pl" className="text-primary hover:underline">
                kontakt@obczajone.pl
              </a>
              .
            </p>
            <PartnerApplicationForm />
          </section>

          <section className="text-center">
            <p className="text-gray-600">
              Chcesz najpierw zobaczyć, jak wygląda profil partnera?{' '}
              <Link href="/partnerzy" className="text-primary font-medium hover:underline">
                Zobacz katalog partnerów
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
