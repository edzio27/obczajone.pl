import { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SellerClient } from './seller-client';

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
