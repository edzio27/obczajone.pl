import { TrendingDown } from 'lucide-react';
import { ListingCard } from '@/components/listing-card';
import { SectionHeading } from '@/components/home/section-heading';
import { Reveal } from '@/components/motion/reveal';
import type { HomeListing } from '@/lib/home-data';

export function BiggestPriceDrops({ listings }: { listings: HomeListing[] }) {
  if (listings.length === 0) return null;

  return (
    <section className="mt-20" aria-labelledby="najwieksze-obnizki">
      <SectionHeading
        id="najwieksze-obnizki"
        eyebrow="Największe obniżki"
        icon={TrendingDown}
        title="Tu sprzedający już zszedł z ceny"
        description="Oferty, w których cena spadła najmocniej, odkąd je obserwujemy — czyli miejsca, gdzie jest o czym rozmawiać."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {listings.map((listing, index) => (
          <Reveal key={listing.id} delay={index * 80}>
            <ListingCard {...listing} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
