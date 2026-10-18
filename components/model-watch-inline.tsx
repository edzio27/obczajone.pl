'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { ModelWatchForm } from '@/components/model-watch-form';

/**
 * Alert na model schowany za jednym przyciskiem.
 *
 * Do 18.10.2026 formularz stał tylko na stronach modeli i przy zdjętych
 * ogłoszeniach - i miał zero zapisów, bo tam prawie nikt nie trafia. Ruch jest
 * na stronach aktywnych ogłoszeń, w porównaniu i w archiwum, ale tam obok stoją
 * już inne formularze, więc ten rozwija się dopiero na kliknięcie.
 */
export function ModelWatchInline({
  brand,
  model,
  medianPrice,
}: {
  brand: string;
  model: string;
  medianPrice: number | null;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return <ModelWatchForm brand={brand} model={model} medianPrice={medianPrice} stacked />;
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
    >
      <BellRing className="h-4 w-4" />
      Obserwuj wszystkie {brand} {model}
    </button>
  );
}
