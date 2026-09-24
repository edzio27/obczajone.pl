/*
  # Sitemapa dostaje komplet ogłoszeń, a nie pierwszy tysiąc

  `sitemap_listings()` zwracało tabelę, a PostgREST tnie każdą odpowiedź do 1000
  wierszy - także z funkcji. Po wdrożeniu sitemapa miała 1064 adresy zamiast
  3504: tysiąc ogłoszeń plus sześćdziesiąt kilka stron stałych. Zniknęło 2500
  adresów, w większości archiwalnych, czyli dokładnie tych, po które ludzie
  tu przychodzą.

  Ten sam limit obszedł kiedyś pierwotny kod sitemapy - pętlą po stronach.
  Tutaj wystarczy oddać jeden wiersz: limit liczy wiersze, nie ich zawartość,
  więc tablica w jsonb przechodzi w całości. Przy 3504 ogłoszeniach to około
  350 kB, czyli mniej niż sama sitemapa, którą z tego składamy.

  Zabezpieczenie w route.ts (pusty wynik = awaria, nie publikujemy) zostaje bez
  zmian i łapie przypadek, w którym funkcja odda pustą tablicę.
*/

DROP FUNCTION IF EXISTS sitemap_listings();

CREATE OR REPLACE FUNCTION sitemap_listings()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('id', id, 'last_checked_at', last_checked_at, 'is_active', is_active)
      ORDER BY id
    ),
    '[]'::jsonb
  )
  FROM listings
  WHERE current_price > 0
    AND title <> ''
    AND (
      NOT is_active
      OR (first_price > 0 AND first_price <> current_price)
    );
$$;

GRANT EXECUTE ON FUNCTION sitemap_listings() TO anon, authenticated;
