import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { SectionHeading } from '@/components/home/section-heading';

export const faqs = [
  {
    question: 'Czy korzystanie z obczajone.pl jest płatne?',
    answer: 'Nie, sprawdzanie ogłoszeń i przeglądanie opinii jest całkowicie darmowe.',
  },
  {
    question: 'Czy muszę zakładać konto, żeby sprawdzić ogłoszenie?',
    answer:
      'Nie, wklejenie linku i sprawdzenie historii ogłoszenia nie wymaga konta. Konto jest potrzebne tylko do dodawania opinii i zarządzania ulubionymi ogłoszeniami.',
  },
  {
    question: 'Jak zamówić oględziny auta lub mieszkania na żywo?',
    answer:
      'Przy każdym sprawdzonym ogłoszeniu jest przycisk „Zamów inspekcję” — pokazujemy wtedy firmy z okolicy tej oferty. Można też wejść prosto do katalogu partnerów i wybrać firmę samodzielnie.',
  },
  {
    question: 'Ile kosztują oględziny i czy doliczacie prowizję?',
    answer:
      'Cenę ustala firma, która jedzie obejrzeć ofertę — zapytanie trafia do niej bezpośrednio, a obczajone.pl nie pobiera prowizji od ceny oględzin.',
  },
  {
    question: 'Skąd bierzecie historię cen?',
    answer:
      'Automatycznie śledzimy zmiany w dodanych ogłoszeniach z Otomoto i Otodom i zapisujemy historię cen oraz zmiany tytułu i zdjęcia ogłoszenia.',
  },
  {
    question: 'Kto moderuje opinie?',
    answer: 'Każda opinia przechodzi przez panel moderacji zespołu obczajone.pl, zanim pojawi się publicznie na stronie.',
  },
  {
    question: 'Co zrobić, jeśli opinia wygląda na nieprawdziwą?',
    answer:
      'Przy każdej opinii znajduje się opcja zgłoszenia — trafia ono do zespołu obczajone.pl, który weryfikuje zgłoszone treści.',
  },
];

/**
 * Rozwijane pytania na natywnym <details>, a nie na akordeonie Radixa.
 *
 * Powód jest jeden i nie estetyczny: Radix odmontowuje zwiniętą treść z DOM-u,
 * a te odpowiedzi są dosłownie tym samym tekstem, który wysyłamy do Google
 * w danych strukturalnych FAQPage. Tekst, którego nie ma w HTML-u, a jest
 * w schema.org, to rozjazd, za który leci kara. <details> trzyma odpowiedź
 * w dokumencie niezależnie od tego, czy jest rozwinięta.
 */
export function Faq() {
  return (
    <section className="mt-20" aria-labelledby="faq">
      <SectionHeading
        id="faq"
        eyebrow="FAQ"
        title="Najczęstsze pytania"
        align="center"
      />

      <div className="mx-auto max-w-3xl space-y-2.5">
        {faqs.map(({ question, answer }) => (
          <details
            key={question}
            className="group rounded-2xl border border-border bg-card px-5 shadow-soft transition-colors open:border-primary/25 hover:border-foreground/15"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-bold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
              {question}
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-300 ease-spring group-open:rotate-180 group-open:text-primary" />
            </summary>
            <p className="pb-5 pr-8 text-sm leading-relaxed text-muted-foreground text-pretty">
              {answer}
            </p>
          </details>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-muted-foreground">
        Nie ma tu Twojego pytania?{' '}
        <a
          href="mailto:kontakt@obczajone.pl"
          className="font-semibold text-primary underline underline-offset-4 hover:no-underline"
        >
          Napisz do nas
        </a>{' '}
        albo zajrzyj do{' '}
        <Link
          href="/regulamin"
          className="font-semibold text-primary underline underline-offset-4 hover:no-underline"
        >
          regulaminu
        </Link>
        .
      </p>
    </section>
  );
}
