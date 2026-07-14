import { Link2, LineChart, MessagesSquare } from 'lucide-react';

const steps = [
  {
    icon: Link2,
    title: '1. Wklej link',
    description: 'Skopiuj adres ogłoszenia z Otomoto lub Otodom i wklej go w pole wyszukiwania.',
  },
  {
    icon: LineChart,
    title: '2. Zobacz historię cen',
    description: 'Sprawdzamy, czy cena była zmieniana i czy ogłoszenie pojawiało się wcześniej.',
  },
  {
    icon: MessagesSquare,
    title: '3. Przeczytaj opinie',
    description: 'Zobacz, co napisali inni użytkownicy, którzy już obejrzeli tę ofertę.',
  },
];

export function HowItWorks() {
  return (
    <section className="mt-8" aria-labelledby="jak-to-dziala">
      <h2 id="jak-to-dziala" className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">
        Jak to działa
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {steps.map(({ icon: Icon, title, description }) => (
          <div key={title} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="inline-flex items-center justify-center w-[84px] h-[84px] bg-primary/10 rounded-xl mb-4">
              <Icon className="w-[42px] h-[42px] text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
