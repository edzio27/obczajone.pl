import { Fragment } from 'react';
import { OPERATOR } from '@/lib/legal-operator';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] };

export type LegalSection = {
  title: string;
  blocks: LegalBlock[];
};

const PLACEHOLDER = /(\[UZUPEŁNIĆ:[^\]]*\])/g;

/**
 * Gdyby w tekście został jeszcze jakiś fragment do uzupełnienia, podświetlamy go,
 * żeby niedokończony dokument nie przeszedł niezauważony na produkcję.
 */
function withPlaceholders(text: string) {
  return text.split(PLACEHOLDER).map((part, i) =>
    part.startsWith('[UZUPEŁNIĆ:') ? (
      <mark key={i} className="bg-amber-100 text-amber-900 font-medium px-1 rounded">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    )
  );
}

function ExampleDataNotice() {
  return (
    <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">
        <strong>Dokument zawiera dane przykładowe.</strong> Oznaczenie operatora, NIP, REGON
        oraz informacje o hostingu i regionie bazy danych są wypełnione wartościami
        testowymi. Przed publikacją podmień je w pliku{' '}
        <code className="rounded bg-amber-100 px-1">lib/legal-operator.ts</code> i ustaw tam{' '}
        <code className="rounded bg-amber-100 px-1">isExampleData: false</code>, żeby ten
        komunikat zniknął.
      </p>
    </div>
  );
}

export function LegalDocument({
  title,
  lastUpdated,
  intro,
  sections,
}: {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Ostatnia aktualizacja: {lastUpdated}
      </p>

      {OPERATOR.isExampleData && <ExampleDataNotice />}
      <p className="text-gray-700 leading-relaxed mb-10">{withPlaceholders(intro)}</p>

      <div className="space-y-8">
        {sections.map(({ title: sectionTitle, blocks }) => (
          <section key={sectionTitle}>
            <h2 className="text-xl font-bold text-foreground mb-3">{sectionTitle}</h2>
            <div className="space-y-3">
              {blocks.map((block, i) =>
                block.type === 'p' ? (
                  <p key={i} className="text-gray-700 leading-relaxed">
                    {withPlaceholders(block.text)}
                  </p>
                ) : (
                  <ul key={i} className="list-disc pl-6 space-y-2 text-gray-700 leading-relaxed">
                    {block.items.map((item, j) => (
                      <li key={j}>{withPlaceholders(item)}</li>
                    ))}
                  </ul>
                )
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
