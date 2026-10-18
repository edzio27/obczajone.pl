'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const LISTING_PATH = /^\/listing\/([0-9a-f-]{36})/i;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse/i;

/** Ścieżka bez identyfikatorów, żeby „/listing/[id]” liczyło się jako jedna strona. */
function pageOf(path: string): string {
  return path
    .replace(LISTING_PATH, '/listing/[id]')
    .replace(/^\/(partner|seller|podsumowanie|wypisz)\/[^/]+/, '/$1/[id]')
    .slice(0, 120);
}

function listingOf(path: string): string | null {
  return path.match(LISTING_PATH)?.[1] ?? null;
}

/** Sekcja strony, w której kliknięto: id nagłówka sekcji albo najbliższy element z id. */
function sectionOf(el: Element): string | null {
  const labelled = el.closest('section[aria-labelledby]')?.getAttribute('aria-labelledby');
  if (labelled) return labelled.slice(0, 60);
  const withId = el.closest('[id]')?.id;
  return withId ? withId.slice(0, 60) : null;
}

/**
 * Cel kliknięcia. Dla linków wewnętrznych ścieżka (bez identyfikatorów
 * ogłoszeń), dla zewnętrznych sama domena - nie zapisujemy pełnych adresów
 * cudzych stron.
 */
function targetOf(el: Element): string | null {
  const href = el.getAttribute('href');
  if (!href) return null;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin ? pageOf(url.pathname) : url.hostname;
  } catch {
    return null;
  }
}

function send(row: Record<string, unknown>) {
  // Panel admina i partnera to my i firmy, nie kupujący - nie liczymy ich.
  if (/^\/(admin|panel-partnera)/.test(window.location.pathname)) return;
  // Bez czekania i bez komunikatów: analityka nie może psuć strony.
  supabase.from('ui_events').insert(row).then(() => {});
}

/**
 * Anonimowy zapis kliknięć i wejść na strony (tabela ui_events).
 *
 * Jeden nasłuch na cały dokument zamiast podpinania kodu pod każdy przycisk:
 * nowe elementy liczą się same, a podpis bierzemy z tego, co widzi
 * człowiek (albo z `data-track`, gdy tekst jest za długi lub się zmienia).
 * Nie zapisujemy niczego, co wpisano w pola, ani nic, co identyfikuje osobę.
 */
export function ClickTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || navigator.webdriver || BOT.test(navigator.userAgent)) return;
    send({ kind: 'view', page: pageOf(pathname), listing_id: listingOf(pathname) });
  }, [pathname]);

  useEffect(() => {
    if (navigator.webdriver || BOT.test(navigator.userAgent)) return;

    function onClick(event: MouseEvent) {
      const el = (event.target as Element | null)?.closest('a, button, [role="button"], summary');
      if (!el) return;
      const label =
        el.getAttribute('data-track') ||
        el.getAttribute('aria-label') ||
        (el as HTMLElement).innerText?.trim().replace(/\s+/g, ' ');
      const path = window.location.pathname;
      send({
        kind: 'click',
        page: pageOf(path),
        listing_id: listingOf(path),
        section: sectionOf(el),
        label: label ? label.slice(0, 80) : null,
        target: targetOf(el),
      });
    }

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
}
