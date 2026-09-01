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
import { ClipboardCheck, MapPin, ShieldCheck } from 'lucide-react';
import { VOIVODESHIPS } from '@/lib/geo';
import { PartnerStars } from '@/components/partner/partner-stars';
import { PromotedBadge, VerifiedBadge } from '@/components/partner/partner-badges';
import { ListingThumbnail } from '@/components/listing-thumbnail';
import {
  inspectionCountLabel,
  VERDICT_LABELS,
  type Partner,
  type PartnerInspection,
} from '@/lib/partner-data';

const POLAND_CENTER: [number, number] = [52.0, 19.0];

const VERDICT_STYLES: Record<string, string> = {
  recommended: 'text-success',
  reservations: 'text-yellow-700',
  not_recommended: 'text-destructive',
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Wszystkie kategorie' },
  { value: 'car', label: 'Sprawdzanie aut' },
  { value: 'home', label: 'Sprawdzanie nieruchomości' },
];

type PartnersMapClientProps = {
  initialPartners: Partner[];
  latestInspections: Record<string, PartnerInspection>;
};

export function PartnersMapClient({ initialPartners, latestInspections }: PartnersMapClientProps) {
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
    popupHtml:
      `<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.city || '')}<br/>` +
      (p.inspection_count > 0
        ? `${escapeHtml(inspectionCountLabel(p.inspection_count))}<br/>`
        : '') +
      `<a href="/partner/${escapeHtml(p.slug)}">Zobacz profil i opinie</a>`,
  }));

  const inspectionTotal = initialPartners.reduce((sum, p) => sum + p.inspection_count, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/*
        Przycisk „Zamów inspekcję” z paska prowadzi właśnie tutaj, więc ta strona
        jest pierwszym, co widzi ktoś zdecydowany zapłacić - a witała go sama
        lista firm z dwoma filtrami, bez słowa o tym, co się właściwie zamawia
        i ile to trwa. Ten pas mówi to w trzech zdaniach, zanim zacznie się
        przewijanie.
      */}
      <section className="surface-ink relative isolate overflow-hidden">
        <div aria-hidden className="absolute inset-0 mesh-ink" />
        <div aria-hidden className="absolute inset-0 grid-lines mask-fade-b opacity-70" />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-transparent to-background"
        />

        <div className="container mx-auto px-4 relative">
          <div className="max-w-6xl mx-auto py-12 md:py-16">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/15 px-3 py-1.5 text-xs font-bold text-signal">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Oględziny przed zakupem
                </div>
                <h1 className="mt-4 text-[2.1rem] md:text-5xl leading-[1.06] font-extrabold text-white text-balance">
                  Ktoś pojedzie i obejrzy to za Ciebie
                </h1>
                <p className="mt-4 text-[15px] md:text-base leading-relaxed text-white/70 text-pretty">
                  Firmy poniżej sprawdzają auta i nieruchomości na miejscu — z jazdą próbną,
                  diagnostyką i werdyktem na piśmie. Wybierz region, wyślij zapytanie,
                  a resztę ustalasz bezpośrednio z firmą.
                </p>

                <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-white/35" />
                    Bez prowizji od ceny oględzin
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-white/35" />
                    Dobór po odległości od ogłoszenia
                  </li>
                  {inspectionTotal > 0 && (
                    <li className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-white/35" />
                      {inspectionCountLabel(inspectionTotal)}
                    </li>
                  )}
                </ul>
              </div>

              <Button variant="outline" asChild className="flex-shrink-0">
                <Link href="/dla-firm">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Prowadzisz taką firmę?
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-8 space-y-4">
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
                          {/* Firma bez ocen, ale z werdyktami, nie zaczyna się
                              od "Brak opinii" - ma co pokazać, tylko czym innym. */}
                          <PartnerStars
                            rating={partner.rating_avg}
                            count={partner.rating_count}
                            size="sm"
                            showEmptyLabel={partner.inspection_count === 0}
                          />
                          {partner.inspection_count > 0 && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              {inspectionCountLabel(partner.inspection_count)}
                            </span>
                          )}
                          {partner.city && (
                            <span className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              {partner.city}
                              {partner.voivodeship ? `, ${partner.voivodeship}` : ''}
                            </span>
                          )}
                        </div>

                        {latestInspections[partner.id] && (
                          <LatestInspection inspection={latestInspections[partner.id]} />
                        )}
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

/**
 * Ostatni werdykt firmy na karcie w katalogu. Katalog bez ocen jest pusty w
 * najgorszym możliwym momencie - kiedy kupujący pierwszy raz sprawdza, czy w
 * ogóle warto komuś z tej listy zapłacić. Konkretne zdanie o konkretnym aucie
 * mówi o firmie więcej niż gwiazdki, których jeszcze nie ma.
 */
function LatestInspection({ inspection }: { inspection: PartnerInspection }) {
  return (
    <div className="mt-2.5 rounded-lg border bg-muted/40 px-3 py-2 flex gap-3">
      {/* Bez linku: cała karta jest już linkiem do profilu, a <a> w <a> to
          nieprawidłowy HTML - przeglądarka rozbija wtedy zagnieżdżenie. */}
      <div className="w-14 h-14 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden flex items-center justify-center">
        <ListingThumbnail
          src={inspection.listing?.image_url ?? null}
          alt={inspection.listing?.title || 'Zdjęcie ogłoszenia'}
        />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          <span className={`font-semibold ${VERDICT_STYLES[inspection.verdict]}`}>
            {VERDICT_LABELS[inspection.verdict]}
          </span>
          {inspection.listing?.title ? ` · ${inspection.listing.title}` : ''}
        </p>
        <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{inspection.summary}</p>
      </div>
    </div>
  );
}
