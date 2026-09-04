/*
  Limit dodawania ogłoszeń nie dotyczy naszego własnego backendu.

  trg_enforce_listing_rate_limit broni tabeli przed klientem: zalogowany dostaje
  5 ogłoszeń na godzinę, a wpisy bez `created_by` - czyli anonimowe - łącznie 30
  na 10 minut. Sens tego jest oczywisty i zostaje bez zmian.

  Problem w tym, że przelot po modelach (funkcja sweep-model-listings) też
  zapisuje ogłoszenia bez `created_by`, bo nie stoi za nimi żaden użytkownik.
  Wstawia ich kilkaset w jednym przebiegu i odbijał się od limitu przy pierwszej
  partii: 15 modeli pobranych poprawnie, zero zapisanych wierszy.

  Kluczem jest rola z tokenu, a nie `current_user`: funkcja jest SECURITY
  DEFINER, więc `current_user` to jej właściciel niezależnie od tego, kto
  wywołał zapis. `request.jwt.claims` ustawia PostgREST i to ono mówi prawdę
  o dzwoniącym. Klucz service_role nigdy nie trafia do przeglądarki, więc
  zwolnienie z limitu nie otwiera niczego po stronie klienta.
*/

CREATE OR REPLACE FUNCTION enforce_listing_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Zapis z backendu: limit klienta go nie dotyczy.
  IF coalesce(
       current_setting('request.jwt.claims', true)::jsonb ->> 'role',
       ''
     ) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.created_by IS NOT NULL THEN
    IF NOT public.check_rate_limit(NEW.created_by, 'add_listing', 5, 60) THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many listings created recently'
        USING ERRCODE = 'P0001';
    END IF;
    -- Record the action ourselves so enforcement does not depend on the
    -- client separately (and honestly) calling recordAction() afterwards.
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (NEW.created_by, 'add_listing');
  ELSE
    -- Anonymous writers have no stable identity to key on; apply a coarse
    -- global cap on anonymous listing creation per time window instead of no
    -- limit at all.
    IF (
      SELECT COUNT(*) FROM public.listings
      WHERE created_by IS NULL
        AND created_at > now() - interval '10 minutes'
    ) >= 30 THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many anonymous listings created recently'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
