'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { logPartnerClick } from '@/lib/partner-clicks';

type Partner = {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  contact_url: string;
  description: string;
};

export function PartnerCta({ source, listingId }: { source: 'otomoto' | 'otodom'; listingId: string }) {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    async function fetchPartners() {
      const category = source === 'otomoto' ? 'car' : 'home';
      const { data } = await supabase
        .from('partners')
        .select('id, name, city, logo_url, contact_url, description')
        .eq('category', category)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(8);

      setPartners(data || []);
    }

    fetchPartners();
  }, [source]);

  if (partners.length === 0) return null;

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
          <h3 className="font-semibold text-gray-900">Chcesz mieć pewność przed zakupem?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Opinia AI to dobry pierwszy sygnał, ale nie zastąpi oględzin na żywo. Zamów profesjonalne
          sprawdzenie u jednego z naszych zaufanych partnerów.
        </p>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {partners.map((partner) => (
            <a
              key={partner.id}
              href={partner.contact_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logPartnerClick(partner.id, 'listing_cta', listingId)}
              className="flex-shrink-0 w-56 rounded-lg border bg-white p-3 hover:shadow-md hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                {partner.logo_url && (
                  <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={partner.logo_url} alt={partner.name} fill className="object-cover" />
                  </div>
                )}
                <p className="font-medium text-sm truncate">{partner.name}</p>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{partner.description}</p>
              {partner.city && <p className="text-xs text-gray-400 mt-1">{partner.city}</p>}
            </a>
          ))}
        </div>

        <Link href="/partnerzy">
          <Button variant="outline" size="sm" className="mt-3">
            Zobacz więcej z Twojej okolicy
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
