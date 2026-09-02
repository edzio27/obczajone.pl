import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ContestClient } from './konkurs-client';
import { fetchCurrentRound, fetchRoundEntries } from '@/lib/contest-data';

export const metadata: Metadata = {
  title: 'Które auto sprawdzamy w tym tygodniu — głosowanie | obczajone.pl',
  description:
    'Co tydzień jedno zgłoszone auto jedzie na bezpłatne oględziny u partnera obczajone.pl. Wy wybieracie które, a werdykt trafia publicznie przy ogłoszeniu.',
  alternates: { canonical: '/konkurs' },
};

// Głosy dochodzą przez cały tydzień, ale strona ma być tania - minuta
// nieaktualnego licznika nikomu nie szkodzi, a klient i tak dolicza własny głos.
export const revalidate = 60;

export default async function ContestPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const round = await fetchCurrentRound(supabase);
  const entries = round ? await fetchRoundEntries(supabase, round.id) : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-10 flex-1">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">
              Które auto sprawdzamy w tym tygodniu?
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Sprzedający zgłaszają swoje auta, Wy głosujecie, a zwycięzcę odwiedza partner
              obczajone.pl — bezpłatnie, z pomiarem lakieru, diagnostyką komputerową i jazdą
              próbną. Werdykt publikujemy przy ogłoszeniu, tak samo jak każdy inny: bez
              względu na to, czy wypadnie dobrze.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <Step number="1" title="Sprzedający zgłasza auto">
              Razem ze zgodą na publikację werdyktu. Bez niej nie ma zgłoszenia.
            </Step>
            <Step number="2" title="Głosujecie przez tydzień">
              Jeden głos na osobę, bez zakładania konta.
            </Step>
            <Step number="3" title="Partner jedzie i sprawdza">
              Werdykt trafia przy ogłoszeniu i na profil firmy, z datą i nazwiskiem.
            </Step>
          </div>

          <ContestClient round={round} initialEntries={entries} />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center mb-2">
        {number}
      </div>
      <h2 className="font-semibold mb-1">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
