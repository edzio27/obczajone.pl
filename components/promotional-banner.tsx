'use client';

import Image from 'next/image';
import { Instagram, Mail } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function PartnersSection() {
  return (
    <section aria-labelledby="partnerzy">
      <div className="text-center mb-8">
        <h2 id="partnerzy" className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          Zaufani partnerzy
        </h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Dla nas samochody sprawdzają takie firmy — profesjonalna diagnostyka techniczna przed zakupem.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-primary/5 border-primary/20 overflow-hidden">
          <div className="p-6 flex items-center justify-between gap-4 flex-wrap h-full">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-lg flex-shrink-0">
                <Image
                  src="/partners/drivecheck-performance.jpg"
                  alt="DriveCheck Performance"
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">DriveCheck Performance</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Ekspert techniczny – sprawdzanie auta przed zakupem | Wrocław
                </p>
              </div>
            </div>
            <a
              href="https://www.instagram.com/drivecheckperformance"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90 transition-all font-medium shadow-md hover:shadow-lg"
            >
              Zobacz na Instagram
              <Instagram className="h-4 w-4" />
            </a>
          </div>
        </Card>

        <Card className="border-2 border-dashed border-gray-200 bg-white/50">
          <div className="p-6 flex items-center justify-between gap-4 flex-wrap h-full">
            <div>
              <h3 className="font-semibold text-gray-900">Zostań naszym partnerem</h3>
              <p className="text-sm text-gray-600 mt-1">
                Prowadzisz firmę zajmującą się diagnostyką lub sprawdzaniem aut przed zakupem? Napisz do nas i nawiążmy współpracę.
              </p>
            </div>
            <a
              href="mailto:kontakt@obczajone.pl"
              className="inline-flex items-center gap-2 border-2 border-primary text-primary px-6 py-3 rounded-lg hover:bg-primary hover:text-white transition-all font-medium flex-shrink-0"
            >
              Napisz do nas
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </Card>
      </div>
    </section>
  );
}
