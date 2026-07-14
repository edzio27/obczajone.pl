import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <CardTitle>Ocena wiarygodności</CardTitle>
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
            <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${DOT_CLASS[row.level]}`} />
              {row.label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
