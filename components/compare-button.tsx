'use client';

import Link from 'next/link';
import { Columns3, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MAX_COMPARE, useCompareList } from '@/lib/compare-store';

/** „Dodaj do porównania” na stronie ogłoszenia, z linkiem do porównania, gdy coś już tam jest. */
export function CompareButton({ listingId }: { listingId: string }) {
  const { ids, add, remove } = useCompareList();
  const { toast } = useToast();
  const inList = ids.includes(listingId);

  function toggle() {
    if (inList) {
      remove(listingId);
      return;
    }
    if (!add(listingId)) {
      toast({ title: `Najwyżej ${MAX_COMPARE} aut`, description: 'Usuń któreś z porównania, żeby dodać to.' });
    }
  }

  return (
    <div className="space-y-1.5">
      <Button onClick={toggle} variant={inList ? 'default' : 'outline'} className="w-full">
        {inList ? <Check className="h-4 w-4 mr-2" /> : <Columns3 className="h-4 w-4 mr-2" />}
        {inList ? 'W porównaniu' : 'Dodaj do porównania'}
      </Button>
      {ids.length > 0 && (
        <Link
          href={`/porownaj?ids=${ids.join(',')}`}
          className="block text-center text-sm font-medium text-primary hover:underline"
        >
          Porównaj {ids.length} {ids.length === 1 ? 'auto' : ids.length < 5 ? 'auta' : 'aut'} →
        </Link>
      )}
    </div>
  );
}
