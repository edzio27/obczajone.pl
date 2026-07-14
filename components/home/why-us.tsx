import { TrendingDown, Users, Shield } from 'lucide-react';

const reasons = [
  {
    icon: TrendingDown,
    title: 'Historia cen',
    description: 'Śledź zmiany cen w czasie i wykrywaj podejrzane manipulacje wartością oferty.',
  },
  {
    icon: Users,
    title: 'Opinie kupujących',
    description: 'Przeczytaj prawdziwe doświadczenia osób, które już obejrzały ofertę na żywo.',
  },
  {
    icon: Shield,
    title: 'Bezpieczeństwo',
    description: 'Weryfikowane opinie i moderacja treści przez nasz zespół.',
  },
];

export function WhyUs() {
  return (
    <section className="mt-12" aria-labelledby="dlaczego-warto">
      <h2 id="dlaczego-warto" className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
        Dlaczego warto
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {reasons.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="group bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-shadow duration-300"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary rounded-xl mb-4">
              <Icon className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
