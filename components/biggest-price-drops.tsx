import { ListingCard } from '@/components/listing-card';
import type { HomeListing } from '@/lib/home-data';

export function BiggestPriceDrops({ listings }: { listings: HomeListing[] }) {
  if (listings.length === 0) return null;

  return (
    <section aria-labelledby="najwieksze-obnizki">
      <h2
        id="najwieksze-obnizki"
        className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left"
      >
        Największe obniżki
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </section>
  );
}
