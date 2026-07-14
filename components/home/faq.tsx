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

export function Faq() {
  return (
    <section className="mt-12" aria-labelledby="faq">
      <h2 id="faq" className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
        Najczęstsze pytania
      </h2>
      <div className="max-w-3xl mx-auto space-y-4">
        {faqs.map(({ question, answer }) => (
          <div key={question} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-foreground mb-2">{question}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
