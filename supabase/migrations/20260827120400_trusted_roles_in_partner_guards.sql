/*
  # Stop the partner guards from silently ignoring writes made outside the app

  The guard triggers decide what a caller may change by asking `is_admin()`,
  which reads `auth.uid()`. A connection that is not a PostgREST request - the
  dashboard SQL editor, psql, a maintenance script - has no `auth.uid()`, so
  `is_admin()` is false and every guard quietly pinned the columns back to their
  previous values. Approving a review that way looked like it worked and did
  nothing: no error, no change, no clue.

  Verified against the live database before this migration: an `UPDATE
  partner_reviews SET is_approved = true` issued over a direct connection
  returned the row with `is_approved` still false.

  The app itself was never affected - the admin panel sends the moderator's JWT,
  so `is_admin()` is true there. This only bites the owner working directly on
  the database, which is exactly when a silent no-op is hardest to diagnose.

  Fix: recognise the roles that are already trusted by construction. PostgREST
  switches to `anon` or `authenticated` for public traffic, so neither can reach
  this branch; `service_role` and `postgres` mean the caller has bypassed the
  API entirely and holds credentials that could rewrite these tables anyway.

  Nothing about the public attack surface changes: a partner logging in through
  the app is still `authenticated` and still cannot touch its own rating,
  verification or promotion.
*/

CREATE OR REPLACE FUNCTION public.is_trusted_writer()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT current_user IN ('postgres', 'service_role', 'supabase_admin');
$$;

CREATE OR REPLACE FUNCTION public.partner_self_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('app.partner_aggregate_refresh', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF public.is_trusted_writer() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.slug := OLD.slug;
  NEW.category := OLD.category;
  NEW.is_active := OLD.is_active;
  NEW.is_verified := OLD.is_verified;
  NEW.verified_at := OLD.verified_at;
  NEW.is_promoted := OLD.is_promoted;
  NEW.partner_since := OLD.partner_since;
  NEW.referral_slug := OLD.referral_slug;
  NEW.created_at := OLD.created_at;
  NEW.rating_avg := OLD.rating_avg;
  NEW.rating_count := OLD.rating_count;
  NEW.inspection_count := OLD.inspection_count;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_review_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();

  IF public.is_trusted_writer() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.partner_id := OLD.partner_id;
  NEW.user_id := OLD.user_id;
  NEW.is_verified_customer := OLD.is_verified_customer;
  NEW.created_at := OLD.created_at;

  IF NEW.rating IS DISTINCT FROM OLD.rating
     OR NEW.comment IS DISTINCT FROM OLD.comment
     OR NEW.service_type IS DISTINCT FROM OLD.service_type THEN
    NEW.is_approved := false;
  ELSE
    NEW.is_approved := OLD.is_approved;
  END IF;

  NEW.is_reported := OLD.is_reported;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_inspection_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();

  IF public.is_trusted_writer() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.author_user_id := (SELECT auth.uid());
    NEW.is_approved := false;
    RETURN NEW;
  END IF;

  NEW.partner_id := OLD.partner_id;
  NEW.listing_id := OLD.listing_id;
  NEW.author_user_id := OLD.author_user_id;
  NEW.created_at := OLD.created_at;

  IF NEW.verdict IS DISTINCT FROM OLD.verdict
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.findings IS DISTINCT FROM OLD.findings
     OR NEW.price_opinion IS DISTINCT FROM OLD.price_opinion THEN
    NEW.is_approved := false;
  ELSE
    NEW.is_approved := OLD.is_approved;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_lead_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_trusted_writer() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.id := OLD.id;
  NEW.partner_id := OLD.partner_id;
  NEW.listing_id := OLD.listing_id;
  NEW.user_id := OLD.user_id;
  NEW.name := OLD.name;
  NEW.phone := OLD.phone;
  NEW.email := OLD.email;
  NEW.message := OLD.message;
  NEW.context := OLD.context;
  NEW.created_at := OLD.created_at;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'new' THEN
    NEW.contacted_at := COALESCE(OLD.contacted_at, now());
  END IF;

  RETURN NEW;
END;
$$;

/*
  The insert guard keeps enforcing the rate limit and the "a partner cannot
  review itself" rule for everyone - those are facts about the data, not about
  who is asking. Only the forced `is_approved := false` is lifted for trusted
  writers, so seeding a pre-approved review from a script stays possible.
*/
CREATE OR REPLACE FUNCTION public.partner_review_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_trusted_writer() THEN
    IF NOT public.check_rate_limit(NEW.user_id, 'partner_review', 5, 60) THEN
      RAISE EXCEPTION 'Rate limit exceeded: too many partner reviews recently'
        USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.rate_limits (user_id, action_type)
    VALUES (NEW.user_id, 'partner_review');

    NEW.is_approved := false;
    NEW.is_reported := false;
  END IF;

  IF public.is_partner_member(NEW.partner_id) THEN
    RAISE EXCEPTION 'A partner cannot review itself'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.is_verified_customer := EXISTS (
    SELECT 1 FROM public.partner_leads
    WHERE partner_id = NEW.partner_id
      AND user_id = NEW.user_id
  );
  RETURN NEW;
END;
$$;
