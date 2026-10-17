'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Lista aut do porównania, trzymana w przeglądarce.
 *
 * Bez konta, bo porównanie to wygoda jednej osoby w trakcie szukania auta,
 * a nie dane, które ktoś inny ma zobaczyć. Udostępnia się je adresem
 * (/porownaj?ids=...), nie kontem. localStorage potrafi być niedostępny
 * (tryb prywatny, zablokowane dane strony), więc każdy odczyt i zapis jest
 * w try/catch, a strona działa wtedy po prostu bez zapamiętywania.
 */

const KEY = 'obczajone-compare';
const EVENT = 'obczajone-compare-changed';
export const MAX_COMPARE = 5;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string').slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_COMPARE)));
  } catch {
    // Bez zapisu porównanie działa do zamknięcia karty - nic więcej nie da się zrobić.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useCompareList() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setIds(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const add = useCallback((id: string) => {
    const current = read();
    if (current.includes(id)) return true;
    if (current.length >= MAX_COMPARE) return false;
    write([...current, id]);
    return true;
  }, []);

  const remove = useCallback((id: string) => write(read().filter((x) => x !== id)), []);
  const replace = useCallback((next: string[]) => write(next), []);

  return { ids, add, remove, replace, isFull: ids.length >= MAX_COMPARE };
}
