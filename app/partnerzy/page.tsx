'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Header } from '@/components/header';
import { supabase } from '@/lib/supabase';
import { LeafletMapView, escapeHtml, type MapMarker } from '@/components/leaflet-map';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

const POLAND_CENTER: [number, number] = [52.0, 19.0];

const VOIVODESHIPS = [
  'dolnośląskie',
  'kujawsko-pomorskie',
  'lubelskie',
  'lubuskie',
  'łódzkie',
  'małopolskie',
  'mazowieckie',
  'opolskie',
  'podkarpackie',
  'podlaskie',
  'pomorskie',
  'śląskie',
  'świętokrzyskie',
  'warmińsko-mazurskie',
  'wielkopolskie',
  'zachodniopomorskie',
];

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'Wszystkie kategorie' },
  { value: 'car', label: 'Sprawdzanie aut' },
  { value: 'home', label: 'Sprawdzanie nieruchomości' },
];

type Partner = {
  id: string;
  name: string;
  category: 'car' | 'home';
  city: string | null;
  voivodeship: string | null;
  lat: number | null;
  lng: number | null;
  logo_url: string | null;
  contact_url: string;
  description: string;
};

export default function PartnersMapPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [voivodeship, setVoivodeship] = useState('all');

  useEffect(() => {
    async function fetchPartners() {
      const { data } = await supabase
        .from('partners')
        .select('id, name, category, city, voivodeship, lat, lng, logo_url, contact_url, description')
        .eq('is_active', true);

      setPartners(data || []);
      setLoading(false);
    }

    fetchPartners();
  }, []);

  const filteredPartners = partners.filter((p) => {
    const matchesCategory = category === 'all' ? true : p.category === category;
    const matchesVoivodeship = voivodeship === 'all' ? true : p.voivodeship === voivodeship;
    return matchesCategory && matchesVoivodeship;
  });

  const mappablePartners = filteredPartners.filter((p) => p.lat != null && p.lng != null);

  const markers: MapMarker[] = mappablePartners.map((p) => ({
    id: p.id,
    lat: p.lat as number,
    lng: p.lng as number,
    popupHtml: `<strong>${escapeHtml(p.name)}</strong><br/>${escapeHtml(p.city || '')}<br/><a href="${escapeHtml(
      p.contact_url
    )}" target="_blank" rel="noopener noreferrer">Zobacz ofertę</a>`,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Partnerzy sprawdzający auta i nieruchomości</h1>
          <p className="text-muted-foreground mt-1">
            Firmy, które polecamy do profesjonalnych oględzin przed zakupem.
          </p>
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

        {loading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : filteredPartners.length === 0 ? (
          <p className="text-muted-foreground">Brak partnerów spełniających kryteria.</p>
        ) : (
          <div className="grid lg:grid-cols-2 gap-4">
            {mappablePartners.length > 0 && (
              <LeafletMapView markers={markers} center={POLAND_CENTER} zoom={6} heightClassName="h-[600px]" />
            )}

            <div
              className={`h-[600px] overflow-y-auto space-y-3 pr-1 ${
                mappablePartners.length === 0 ? 'lg:col-span-2' : ''
              }`}
            >
              {filteredPartners.map((partner) => (
                <a
                  key={partner.id}
                  href={partner.contact_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                    <div className="flex items-start gap-4">
                      {partner.logo_url && (
                        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                          <Image src={partner.logo_url} alt={partner.name} fill className="object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{partner.name}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{partner.description}</p>
                        {partner.city && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {partner.city}
                            {partner.voivodeship ? `, ${partner.voivodeship}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
