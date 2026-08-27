import { Badge } from '@/components/ui/badge';
import { BadgeCheck, Megaphone } from 'lucide-react';

/**
 * Odznaka "Zweryfikowany" znaczy tyle, ile znaczą jej kryteria - dlatego zawsze
 * linkuje do strony, która je wymienia. Odznaka bez wyjaśnienia jest ozdobą.
 */
export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <a href="/dla-firm#weryfikacja" className={`inline-flex ${className}`}>
      <Badge className="bg-success/10 text-success hover:bg-success/20 border-success/20 gap-1">
        <BadgeCheck className="h-3.5 w-3.5" />
        Zweryfikowany partner
      </Badge>
    </a>
  );
}

/**
 * Płatne wyróżnienie musi być oznaczone w miejscu, w którym daje przewagę.
 * Ukryte płatne pozycjonowanie w wynikach to nieuczciwa praktyka rynkowa.
 */
export function PromotedBadge({ className = '' }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      className={`gap-1 text-muted-foreground border-muted-foreground/30 ${className}`}
      title="Pozycja opłacona przez partnera"
    >
      <Megaphone className="h-3.5 w-3.5" />
      Promowane
    </Badge>
  );
}
