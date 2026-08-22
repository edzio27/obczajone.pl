import { ListingCard } from '@/components/listing-card';
import type { HomeListing } from '@/lib/home-data';

export function RecentlyChecked({ listings }: { listings: HomeListing[] }) {
  if (listings.length === 0) return null;

  return (
    <section aria-labelledby="ostatnio-sprawdzane">
      <h2
        id="ostatnio-sprawdzane"
        className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-left"
      >
        Ostatnio sprawdzane
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>
    </section>
  );
}
