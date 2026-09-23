/*
  # Indeks po marce i modelu z `specs`

  Marka i model mieszkają w kolumnie jsonb, więc każde zapytanie, które po nich
  filtruje, wyciąga je wyrażeniem `btrim(coalesce(specs->>'brand',''))` - a tego
  nie pokrywa żaden indeks. Postgres przechodzi wtedy całą tabelę.

  Przy bezczynnej bazie mieściło się to w sekundę i nie rzucało się w oczy.
  Dopiero gdy `pending_model_alerts` zaczęło być wołane w trakcie przelotu po
  modelach (18 sekund pracy), skan przekroczył ośmiosekundowy limit PostgREST
  i alerty modelowe padały z "canceling statement due to statement timeout".

  Indeks częściowy - tylko żywe oferty z ceną - bo wszystkie zapytania, które
  po tym szukają (alerty, trendy modeli, listy na stronach modelowych),
  interesują się wyłącznie nimi. Węższy indeks to mniej do przejścia i mniej
  do utrzymania przy każdym zapisie scrapera, co na tej instancji jest osobnym
  kosztem.

  CONCURRENTLY, żeby budowanie nie zablokowało zapisów scrapera, który chodzi
  co godzinę.
*/

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_listings_brand_model
  ON listings (
    (btrim(coalesce(specs->>'brand', ''))),
    (btrim(coalesce(specs->>'model', '')))
  )
  WHERE is_active AND current_price > 0;
