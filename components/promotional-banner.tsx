"use client";

import { ExternalLink, Instagram, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

export function PromotionalBanner() {
  return (
    <Card className="bg-primary/5 border-primary/20 overflow-hidden">
      <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full shadow-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              DriveCheck Performance
            </h3>
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
  );
}
