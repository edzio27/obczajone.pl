import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Info } from 'lucide-react';
import type { ListingScore, ScoreLevel } from '@/lib/listing-score';

const DOT_CLASS: Record<ScoreLevel, string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-destructive',
};

const TEXT_CLASS: Record<ScoreLevel, string> = {
  green: 'text-success',
  yellow: 'text-warning',
  red: 'text-destructive',
};

const HEADLINE: Record<ScoreLevel, string> = {
  green: 'Wysoka wiarygodność',
  yellow: 'Przeciętna wiarygodność',
  red: 'Niska wiarygodność',
};

export function ListingScoreCard({ score }: { score: ListingScore }) {
  const rows = [score.rows.price, score.rows.reviews, score.rows.activity];

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <CardTitle>Ocena wiarygodności</CardTitle>
          <Popover>
            <PopoverTrigger className="text-muted-foreground hover:text-foreground transition-colors">
              <Info className="h-4 w-4" />
              <span className="sr-only">Jak liczymy tę ocenę?</span>
            </PopoverTrigger>
            <PopoverContent className="text-sm space-y-2">
              <p className="font-semibold">Jak liczymy tę ocenę?</p>
              <p>Suma trzech elementów, maksymalnie 100 punktów:</p>
              <ul className="space-y-1.5">
                <li>
                  <span className="font-medium">Cena (do 40 pkt)</span> — spadek ceny podnosi
                  wynik, wzrost obniża; brak zmiany daje wynik neutralny.
                </li>
                <li>
                  <span className="font-medium">Opinie (do 40 pkt)</span> — im wyższa średnia ocena
                  użytkowników, tym więcej punktów; brak opinii to wynik neutralny (nie karzemy
                  nowych ogłoszeń); zgłoszona opinia odejmuje punkty.
                </li>
                <li>
                  <span className="font-medium">Aktywność (do 20 pkt)</span> — ogłoszenie wciąż
                  widoczne na Otomoto/Otodom daje pełną pulę, zdjęte z rynku — połowę.
                </li>
              </ul>
              <p className="text-muted-foreground">
                70+ pkt = wysoka wiarygodność, 40–69 = przeciętna, poniżej 40 = niska.
              </p>
            </PopoverContent>
          </Popover>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-4">
          <span className={`text-4xl font-bold ${TEXT_CLASS[score.level]}`}>{score.total}</span>
          <span className="text-gray-400 text-lg">/100</span>
          <span className={`text-sm font-medium ${TEXT_CLASS[score.level]}`}>
            {HEADLINE[score.level]}
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_CLASS[row.level]}`} />
                {row.label}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {row.points}/{row.maxPoints} pkt
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
