'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SITE = 'https://obczajone.pl';

type BadgeSectionProps = {
  slug: string;
  name: string;
  /** Kod z linku partnera - dzięki niemu widzi w panelu, ilu ludzi nam przysłał. */
  referralSlug: string | null;
};

/**
 * Gotowiec do wklejenia na stronę partnera.
 *
 * Odznaka, a nie "wstaw gdzieś linka": firma chce mieć u siebie coś, co wygląda
 * jak wyróżnienie, a nie jak przysługa dla nas. Przy okazji każdy partner daje
 * wtedy ten sam, przewidywalny link - z jego kodem polecającym, więc obie
 * strony widzą, ile ruchu faktycznie od niego przyszło.
 */
export function BadgeSection({ slug, name, referralSlug }: BadgeSectionProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const profileUrl = referralSlug
    ? `${SITE}/partner/${slug}?ref=${referralSlug}`
    : `${SITE}/partner/${slug}`;
  const badgeUrl = `${SITE}/badge/${slug}${theme === 'dark' ? '?theme=dark' : ''}`;

  const snippet = `<a href="${profileUrl}" target="_blank" rel="noopener">
  <img src="${badgeUrl}"
       alt="${name} — partner obczajone.pl"
       width="320" height="84" loading="lazy">
</a>`;

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({
        title: 'Nie udało się skopiować',
        description: 'Zaznacz tekst i skopiuj ręcznie.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Odznaka na Twoją stronę</CardTitle>
        <CardDescription>
          Wklej ją na swojej stronie albo w stopce. Ocena i liczba werdyktów aktualizują się same —
          raz wklejona odznaka nie wymaga już żadnej pracy.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={theme === 'light' ? 'default' : 'outline'}
            onClick={() => setTheme('light')}
          >
            Na jasne tło
          </Button>
          <Button
            size="sm"
            variant={theme === 'dark' ? 'default' : 'outline'}
            onClick={() => setTheme('dark')}
          >
            Na ciemne tło
          </Button>
        </div>

        <div
          className={`rounded-lg border p-6 flex justify-center ${
            theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={badgeUrl} alt={`${name} — partner obczajone.pl`} width={320} height={84} />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">Kod do wklejenia</p>
          <pre className="text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre">
            {snippet}
          </pre>
          <Button size="sm" className="mt-2" onClick={() => copy(snippet, 'snippet')}>
            {copied === 'snippet' ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied === 'snippet' ? 'Skopiowane' : 'Skopiuj kod'}
          </Button>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">
            Sam link — do bio na Instagramie, stopki maila albo kodu QR
          </p>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-muted rounded-lg p-3 overflow-x-auto whitespace-nowrap">
              {profileUrl}
            </code>
            <Button size="sm" variant="outline" onClick={() => copy(profileUrl, 'link')}>
              {copied === 'link' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          {referralSlug && (
            <p className="text-xs text-muted-foreground mt-1.5">
              Końcówka <code>?ref={referralSlug}</code> liczy wejścia, które nam przysyłasz. Zobaczysz
              je w statystykach nad zakładkami — i to jest liczba, którą kładziemy na stole, gdy
              rozmawiamy o warunkach.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
