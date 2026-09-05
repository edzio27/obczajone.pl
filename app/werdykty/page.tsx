import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { InspectedCard } from '@/components/inspected-card';
import { fetchRecentlyInspected } from '@/lib/home-data';

export const metadata: Metadata = {
  title: 'Werdykty po oględzinach — auta obejrzane na żywo | obczajone.pl',
  description:
    'Pełna lista ogłoszeń, przy których partner obczajone.pl pojechał obejrzeć auto osobiście i wystawił werdykt: polecam, z zastrzeżeniami albo odradzam.',
  alternates: { canonical: '/werdykty' },
};

/*
  Werdyktów przybywa rzadko - kilka tygodniowo w najlepszym razie - więc
  godzinne odświeżanie jest i tak częstsze, niż wynika z tempa zmian.
*/
export const revalidate = 3600;

/** Wszystkie, a nie trzy jak na stronie głównej. Limit jest tylko bezpiecznikiem. */
const MAX_VERDICTS = 200;

export default async function VerdictsPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const inspections = await fetchRecentlyInspected(supabase, MAX_VERDICTS);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Werdykty po oględzinach
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Auta, przy których ktoś fizycznie pojechał na miejsce i napisał, co zastał.
              To jedyna treść w tym serwisie, której nie da się przepisać z ogłoszenia ani
              wygenerować — bo bierze się z obejrzenia konkretnego egzemplarza.
            </p>
          </div>

          {inspections.length === 0 ? (
            <p className="text-muted-foreground">
              Nie mamy jeszcze ani jednego werdyktu.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {inspections.length}{' '}
                {inspections.length === 1 ? 'obejrzane auto' : 'obejrzanych aut'}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {inspections.map((listing) => (
                  <InspectedCard key={listing.id} listing={listing} />
                ))}
              </div>
            </>
          )}

          <p className="text-xs text-muted-foreground">
            Werdykt jest opinią firmy, która auto obejrzała, a nie naszą oceną. Partner
            odpowiada za to, co napisał, i ma prawo do odpowiedzi, jeśli ktoś się z nim
            nie zgadza.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
