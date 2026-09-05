import { BadgeCheck } from 'lucide-react';
import { SectionHeading } from '@/components/home/section-heading';
import { Reveal } from '@/components/motion/reveal';
import { InspectedCard } from '@/components/inspected-card';
import type { InspectedListing } from '@/lib/home-data';

/**
 * Auta, które partner faktycznie obejrzał na żywo.
 *
 * To jedyna treść w serwisie, której nie ma nikt inny w internecie - i jedyna,
 * przy której da się powiedzieć czytelnikowi coś więcej niż to, co stoi
 * w ogłoszeniu. Dlatego stoi na stronie głównej, a nie tylko na profilach firm.
 *
 * Link w nagłówku prowadzi do pełnej listy, a nie do zamówienia oględzin:
 * zaproszenie handlowe stoi w osobnej sekcji tuż pod spodem, więc slot
 * w nagłówku był zajęty przez drugi raz to samo, a czytelnik, który chciał
 * zobaczyć pozostałe werdykty, nie miał dokąd kliknąć.
 */
export function RecentlyInspected({ listings }: { listings: InspectedListing[] }) {
  if (listings.length === 0) return null;

  return (
    <section className="mt-20" aria-labelledby="ostatnio-obejrzane">
      <SectionHeading
        id="ostatnio-obejrzane"
        eyebrow="Obejrzane na żywo"
        icon={BadgeCheck}
        title="Ktoś tam pojechał i wystawił werdykt"
        description="Oferty, przy których nasz partner był osobiście — z oceną tego, co zastał na miejscu."
        action={{ href: '/werdykty', label: 'Zobacz wszystkie werdykty' }}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {listings.map((listing, index) => (
          <Reveal key={listing.id} delay={index * 80}>
            <InspectedCard listing={listing} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
