'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Jedna wizyta liczy sie raz na sesje przegladarki. Bez tego odswiezenie strony
// albo powrot przyciskiem "wstecz" zawyzalby liczby, ktore potem kladziemy na
// stole w rozmowie z partnerem.
const SESSION_KEY_PREFIX = 'ref-logged:';

/**
 * Zlicza wejscia z linkow i kodow QR partnerow (np. obczajone.pl/?ref=drivecheck).
 * Czytamy adres przez window zamiast useSearchParams, zeby nie wymuszac
 * granicy <Suspense> ani renderowania dynamicznego na stronach statycznych.
 */
export function ReferralTracker() {
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('ref')?.trim();
    if (!slug) return;

    const sessionKey = `${SESSION_KEY_PREFIX}${slug}`;
    if (window.sessionStorage.getItem(sessionKey)) return;
    window.sessionStorage.setItem(sessionKey, '1');

    async function logVisit(referralSlug: string) {
      const { data: partner } = await supabase
        .from('partners')
        .select('id')
        .eq('referral_slug', referralSlug)
        .maybeSingle();

      if (!partner) return;

      const { error } = await supabase.from('partner_referrals').insert({
        partner_id: partner.id,
        landing_path: window.location.pathname,
      });

      if (error) console.error('Nie udało się zapisać wejścia od partnera:', error);
    }

    logVisit(slug);
  }, []);

  return null;
}
