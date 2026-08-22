'use client';

import { useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListingCard } from '@/components/listing-card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import type { HomeListing } from '@/lib/home-data';

const VISIBLE_BY_DEFAULT = 3;

type RecentReviewsProps = {
  listings: HomeListing[];
  showMoreButton?: boolean;
};

export function RecentReviews({ listings, showMoreButton = false }: RecentReviewsProps) {
  const [showAll, setShowAll] = useState(false);

  if (listings.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="text-center py-12">
          <CardTitle className="text-2xl">Brak skomentowanych ogłoszeń</CardTitle>
          <CardDescription className="text-base mt-2">
            Bądź pierwszym, który zostawi komentarz
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const collapsible = showMoreButton && listings.length > VISIBLE_BY_DEFAULT;
  const visible = collapsible ? listings.slice(0, VISIBLE_BY_DEFAULT) : listings;
  const rest = collapsible ? listings.slice(VISIBLE_BY_DEFAULT) : [];

  return (
    <div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((listing) => (
          <ListingCard key={listing.id} {...listing} />
        ))}
      </div>

      {/*
        Ukryte pozycje renderujemy zawsze i tylko chowamy je stylem. Gdyby
        powstawały dopiero po kliknięciu, linki do tych ogłoszeń nie istniałyby
        w HTML-u - a to jedne z niewielu linków wewnętrznych, jakie ma serwis.
      */}
      {rest.length > 0 && (
        <div
          className={
            showAll ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6' : 'hidden'
          }
        >
          {rest.map((listing) => (
            <ListingCard key={listing.id} {...listing} />
          ))}
        </div>
      )}

      {rest.length > 0 && !showAll && (
        <div className="flex justify-center mt-6">
          <Button
            onClick={() => setShowAll(true)}
            variant="outline"
            size="lg"
            className="flex items-center gap-2"
          >
            Pokaż więcej
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
