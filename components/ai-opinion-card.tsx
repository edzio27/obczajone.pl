import { Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export type AiOpinion = {
  rating: number;
  summary: string;
  priceNote: string;
  watchOutFor: string[];
};

/**
 * Opinia AI o ogłoszeniu. Wydzielona z listy opinii, bo jej miejsce jest tuż
 * pod ogłoszeniem, a nie na dole strony wśród opinii użytkowników - to jedyna
 * rzecz, którą mamy do powiedzenia o tym konkretnym aucie w momencie, gdy
 * ktoś je ogląda, i większość odwiedzających nie doscrolluje do sekcji opinii.
 *
 * Zastrzeżenie na dole nie jest ozdobnikiem: to tekst wygenerowany maszynowo,
 * prezentowany na stronie handlowej, więc musi być wprost oznaczony jako taki.
 */
export function AiOpinionCard({ opinion }: { opinion: AiOpinion }) {
  return (
    <Card id="opinia-ai" className="mb-6 scroll-mt-20 border-blue-200 bg-blue-50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Badge className="bg-blue-600 text-white hover:bg-blue-600">Opinia AI</Badge>
          <div className="flex">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-5 w-5 ${
                  i < opinion.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-700">{opinion.summary}</p>
        {opinion.priceNote && (
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-1">Cena</h4>
            <p className="text-gray-600">{opinion.priceNote}</p>
          </div>
        )}
        {opinion.watchOutFor.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm text-gray-700 mb-1">Na co zwrócić uwagę</h4>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              {opinion.watchOutFor.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-xs text-gray-500 pt-2 border-t">
          Opinia wygenerowana automatycznie przez AI na podstawie opisu ogłoszenia. Może się mylić —
          nie zastępuje oceny na żywo.
        </p>
      </CardContent>
    </Card>
  );
}
