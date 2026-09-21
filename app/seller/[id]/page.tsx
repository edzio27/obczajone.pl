import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SellerClient } from './seller-client';


/*
  Profil sprzedawcy nie mial ani `revalidate`, ani `generateStaticParams`, wiec
  szedl jako trasa w pelni dynamiczna: kazde wejscie crawlera - a linkuje tu
  kazde z 12 771 ogloszen - renderowalo strone od nowa i pytalo baze. Godzina
  wystarczy, bo profil zmienia sie tylko wtedy, gdy scraper dolozy temu
  sprzedawcy ogloszenie.
*/
export const revalidate = 3600;

export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}


type Props = {
  params: { id: string };
};

async function getSellerName(id: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: seller } = await supabase
    .from('sellers')
    .select('name, city')
    .eq('id', id)
    .maybeSingle();

  return seller;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const seller = await getSellerName(params.id);

  if (!seller) {
    return {
      title: 'Sprzedawca nie znaleziony | obczajone.pl',
      description: 'Profil sprzedawcy nie istnieje w bazie danych obczajone.pl',
    };
  }

  return {
    title: `${seller.name} - ${seller.city} | obczajone.pl`,
    description: `Zobacz oferty i opinie o sprzedawcy ${seller.name} w ${seller.city} na obczajone.pl.`,
  };
}

export default function SellerPage({ params }: Props) {
  return <SellerClient sellerId={params.id} />;
}
