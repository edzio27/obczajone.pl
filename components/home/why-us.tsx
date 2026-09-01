import Link from 'next/link';
import { ArrowRight, Eye, ScanSearch, ShieldCheck, TrendingDown, Users } from 'lucide-react';
import { SectionHeading } from '@/components/home/section-heading';
import { Reveal } from '@/components/motion/reveal';

const reasons = [
  {
    icon: TrendingDown,
    title: 'Historia ceny, nie tylko dzisiejsza',
    description:
      'Widzisz, ile ta oferta kosztowała miesiąc temu i ile razy sprzedający schodził z ceny. To najtańszy argument w negocjacji, jaki możesz mieć.',
  },
  {
    icon: Users,
    title: 'Opinie tych, którzy tam byli',
    description:
      'Nie recenzje portalu — relacje ludzi, którzy pojechali obejrzeć dokładnie to auto albo to mieszkanie i opisali, co zastali.',
  },
  {
    icon: ScanSearch,
    title: 'Opinia AI ze zdjęć i opisu',
    description:
      'Automatyczna analiza wyłapuje sprzeczności w ogłoszeniu i wypisuje, czego ze zdjęć po prostu nie da się ocenić.',
  },
  {
    icon: ShieldCheck,
    title: 'Moderacja i prawo do odpowiedzi',
    description:
      'Każda opinia przechodzi przez moderację, a firma, której dotyczy, ma prawo publicznie odpowiedzieć.',
  },
];

export function WhyUs() {
  return (
    <section className="mt-20" aria-labelledby="dlaczego-warto">
      <SectionHeading
        id="dlaczego-warto"
        eyebrow="Dlaczego warto"
        title="Cztery rzeczy, których nie ma w samym ogłoszeniu"
        description="Sprzedający pokazuje to, co chce pokazać. Reszta jest tutaj."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {reasons.map(({ icon: Icon, title, description }, index) => (
          <Reveal key={title} delay={index * 80}>
            <div className="group h-full rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 ease-spring hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift">
              <span className="icon-tile mb-4 h-11 w-11 bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="text-base font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                {description}
              </p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={160}>
        <Link
          href="/partnerzy"
          className="group mt-4 flex items-center gap-4 rounded-2xl border border-dashed border-border bg-card/60 p-6 transition-colors hover:border-primary/40 hover:bg-card"
        >
          <span className="icon-tile h-11 w-11 flex-shrink-0 bg-signal/15 text-signal-foreground">
            <Eye className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">
              A czego nie zobaczysz nawet tutaj?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Stanu podwozia, dźwięku silnika na zimno, wilgoci w rogu sypialni. To musi
              zobaczyć człowiek — i po to jest katalog firm.
            </p>
          </div>
          <ArrowRight className="hidden h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-300 ease-spring group-hover:translate-x-1 group-hover:text-primary sm:block" />
        </Link>
      </Reveal>
    </section>
  );
}
