import { Link2, LineChart, MessagesSquare, ShieldCheck } from 'lucide-react';
import { SectionHeading } from '@/components/home/section-heading';
import { Reveal } from '@/components/motion/reveal';

const steps = [
  {
    icon: Link2,
    title: 'Wklej link',
    description: 'Skopiuj adres oferty z Otomoto lub Otodom. Bez konta, bez opłat.',
  },
  {
    icon: LineChart,
    title: 'Zobacz historię ceny',
    description: 'Sprawdzamy, czy cena była zmieniana i czy ogłoszenie wisiało tu wcześniej.',
  },
  {
    icon: MessagesSquare,
    title: 'Przeczytaj opinie',
    description: 'Zobacz, co napisali ci, którzy tę ofertę już oglądali na żywo.',
  },
  {
    icon: ShieldCheck,
    title: 'Wyślij kogoś na miejsce',
    description: 'Jeśli oferta wygląda poważnie — firma z okolicy obejrzy ją przed Tobą.',
  },
];

export function HowItWorks() {
  return (
    <section className="mt-20" aria-labelledby="jak-to-dziala">
      <SectionHeading
        id="jak-to-dziala"
        eyebrow="Krok po kroku"
        title="Od linku do decyzji w cztery kroki"
        align="center"
      />

      <div className="relative">
        {/* Linia łącząca kroki - rysowana za kafelkami, tylko na szerokim
            ekranie, bo w kolumnie prowadziłaby donikąd. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 top-[2.15rem] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
        />

        <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <Reveal as="li" key={title} delay={index * 90} className="text-center">
              <div className="mx-auto mb-4 flex h-[4.3rem] w-[4.3rem] items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
                <Icon className="h-7 w-7 text-primary" />
              </div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Krok {index + 1}
              </div>
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="mx-auto mt-1.5 max-w-[16rem] text-sm leading-relaxed text-muted-foreground text-pretty">
                {description}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
