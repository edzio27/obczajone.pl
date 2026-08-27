'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { LeafletMapView, escapeHtml, type MapMarker } from '@/components/leaflet-map';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ShieldCheck } from 'lucide-react';
import { VOIVODESHIPS } from '@/lib/geo';
import { PartnerStars } from '@/components/partner/partner-stars';
import { PromotedBadge, VerifiedBadge } from '@/components/partner/partner-badges';
import type { Partner } from '@/lib/partner-data';

const POLAND_CENTER: [number, number] = [52.0, 19.0];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Wszystkie kategorie' },
  { value: 'car', label: 'Sprawdzanie aut' },
  { value: 'home', label: 'Sprawdzanie nieruchomości' },
];

export function PartnersMapClient({ initialPartners }: { initialPartners: Partner[] }) {
  const [category, setCategory] = useState('all');
  const [voivodeship, setVoivodeship] = useState('all');

  const filteredPartners = initialPartners.filter((p) => {
    const matchesCategory = category === 'all' ? true : p.category === category;
    const matchesVoivodeship = voivodeship === 'all' ? true : p.voivodeship === voivodeship;
    return matchesCategory && matchesVoivodeship;
  });

  const mappablePartners = filteredPartners.filter((p) => p.lat != null && p.lng != null);

  const markers: MapMarker[] = mappablePartners.map((p) => ({
    id: p.id,
    lat: p.lat as number,
    lng: p.lng as number,
    popupHtml: `<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.city || '')}<br/><a href="/partner/${escapeHtml(
      p.slug
    )}">Zobacz profil i opinie</a>`,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Partnerzy sprawdzający auta i nieruchomości</h1>
            <p className="text-muted-foreground mt-1">
              Firmy, które polecamy do profesjonalnych oględzin przed zakupem — z ocenami od
              kupujących.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dla-firm">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Prowadzisz taką firmę?
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Kategoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={voivodeship} onValueChange={setVoivodeship}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Województwo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie województwa</SelectItem>
              {VOIVODESHIPS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredPartners.length === 0 ? (
          <p className="text-muted-foreground">Brak partnerów spełniających kryteria.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {mappablePartners.length > 0 && (
              <LeafletMapView
                markers={markers}
                center={POLAND_CENTER}
                zoom={6}
                heightClassName="h-[600px]"
              />
            )}

            <div
              className={`lg:h-[600px] lg:overflow-y-auto space-y-3 pr-1 ${
                mappablePartners.length === 0 ? 'lg:col-span-2' : ''
              }`}
            >
              {filteredPartners.map((partner) => (
                <Link key={partner.id} href={`/partner/${partner.slug}`} className="block">
                  <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex items-start gap-4">
                      {partner.logo_url && (
                        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={partner.logo_url}
                            alt={partner.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{partner.name}</p>
                          {partner.is_verified && <VerifiedBadge />}
                          {partner.is_promoted && <PromotedBadge />}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5">{partner.description}</p>
                        <div className="flex items-center gap-3 flex-wrap mt-1.5">
                          <PartnerStars
                            rating={partner.rating_avg}
                            count={partner.rating_count}
                            size="sm"
                          />
                          {partner.city && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {partner.city}
                              {partner.voivodeship ? `, ${partner.voivodeship}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
