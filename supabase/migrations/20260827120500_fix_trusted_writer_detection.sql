/*
  # Fix is_trusted_writer(): it trusted everybody

  The previous migration identified trusted callers with `current_user`. Every
  guard that calls it is SECURITY DEFINER, and inside a SECURITY DEFINER
  function `current_user` is the function *owner* - `postgres` - regardless of
  who made the request. So `is_trusted_writer()` returned true for anonymous and
  authenticated API traffic alike, and each guard returned NEW unchanged.

  Confirmed against the live database: acting as `authenticated` with a partner
  member's JWT, an UPDATE set the partner's own `rating_avg` to 5.00,
  `is_verified` and `is_promoted` to true, and rewrote `slug`. Every one of
  those is a column the guard exists to protect.

  `session_user` is no better: PostgREST logs in as `authenticator` and switches
  role per request, so it is the same value for anon, authenticated and
  service_role.

  The reliable signal is the request context itself. PostgREST sets
  `request.jwt.claims` from the verified token on every API call, and a client
  cannot set a GUC. No claims at all means the caller never came through the
  API - a direct connection holding the database password.

  Exposure window: the flaw existed only between the previous migration and this
  one, and `partner_users` had no rows in that time, so no account could reach
  the branch through the API.
*/

CREATE OR REPLACE FUNCTION public.is_trusted_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    -- Brak kontekstu PostgREST: połączenie bezpośrednie (SQL editor, psql,
    -- skrypt migracyjny) - czyli ktoś, kto ma hasło do bazy i tak może zapisać
    -- w tych tabelach cokolwiek.
    'direct_connection'
  ) IN ('service_role', 'direct_connection');
$$;
