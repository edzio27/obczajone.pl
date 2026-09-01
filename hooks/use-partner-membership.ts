'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

export type PartnerMembership = {
  partnerId: string;
  partnerName: string;
};

/**
 * Czy zalogowany użytkownik prowadzi firmę partnerską - i którą.
 *
 * Potrzebne poza panelem partnera, bo o tym, czy ktoś pisze werdykt firmy czy
 * własną opinię, decyduje formularz przy ogłoszeniu, a nie miejsce w serwisie,
 * do którego partner i tak nie zagląda w trakcie oględzin.
 *
 * `partner_users` czyta wyłącznie swój wiersz (polityka RLS), więc to zapytanie
 * nie zdradza nic o innych firmach.
 */
export function usePartnerMembership() {
  const { user } = useAuth();
  const [membership, setMembership] = useState<PartnerMembership | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setMembership(null);
        setLoaded(true);
        return;
      }

      const { data } = await supabase
        .from('partner_users')
        .select('partner_id, partners(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;

      const partner = data?.partners as { name: string } | { name: string }[] | null | undefined;
      const name = Array.isArray(partner) ? partner[0]?.name : partner?.name;

      setMembership(
        data?.partner_id && name
          ? { partnerId: data.partner_id as string, partnerName: name }
          : null
      );
      setLoaded(true);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return { membership, loaded };
}
