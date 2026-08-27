/*
  # Let buyers rate partners, and let partners answer

  A directory where every listed firm looks equally good is worth nothing to the
  buyer and, for exactly that reason, worth nothing to the good firms in it.
  Ratings are what make a place in the directory something a partner has an
  interest in keeping.

  1. New table `partner_reviews`
    - One review per user per partner (unique constraint), because the value of
      the average collapses the moment one person can post ten times.
    - `user_id` is NOT NULL: unlike listing reviews, these are opinions about a
      named business, and an anonymous write path for those is a liability.
    - `listing_id` (nullable) — the listing the inspection was about, when there
      was one. Gives the review context and links the two pages together.
    - `is_verified_customer` — set by trigger, not by the author: true only when
      this user actually sent this partner a lead through the site before
      writing. Under the Omnibus directive we may only claim reviews come from
      real customers if we can say how we check, so the flag is derived from a
      fact we hold rather than from a checkbox the author ticks.
    - `is_approved` defaults to false, matching how listing reviews already work.

  2. New table `partner_review_replies`
    - The partner's right of reply, one per review. Publishing criticism of a
      named business without giving that business a way to answer on the same
      page is both unfair and, under the DSA, an avoidable complaint.

  3. Aggregates on `partners`
    - `rating_avg`, `rating_count` maintained by trigger over approved reviews.
      Denormalised on purpose: every card, map popup and CTA tile wants the
      rating, and `partners` is already public-read, so a computed column beats
      a join or a view that RLS then has to be reasoned about separately.

  4. Security
    - Public reads see approved reviews only; an author always sees their own.
    - Insert requires authentication and is rate limited in the database.
    - Authors may edit their own review; approving and deleting stay with admins.
    - A partner can never write, edit or delete a review about itself. It can
      only add a reply, and only to a review that is already published.
*/

ALTER TABLE partners ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2);
ALTER TABLE partners ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS partner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  service_type text NOT NULL DEFAULT '',
  is_verified_customer boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  is_reported boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT partner_reviews_comment_length CHECK (char_length(comment) <= 3000),
  CONSTRAINT partner_reviews_one_per_user UNIQUE (partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_reviews_partner
  ON partner_reviews (partner_id, is_approved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_reviews_user
  ON partner_reviews (user_id);

ALTER TABLE partner_reviews ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS partner_review_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL UNIQUE REFERENCES partner_reviews(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT partner_review_replies_body_length
    CHECK (char_length(body) BETWEEN 1 AND 3000)
);

CREATE INDEX IF NOT EXISTS idx_partner_review_replies_partner
  ON partner_review_replies (partner_id);

ALTER TABLE partner_review_replies ENABLE ROW LEVEL SECURITY;

/*
  Recompute the partner's public rating from approved reviews only. Runs as
  SECURITY DEFINER because `partners` grants UPDATE to the partner itself and
  to admins - the trigger has to be able to write the aggregate regardless of
  who caused the change, including an anonymous read path that never can.
*/
CREATE OR REPLACE FUNCTION public.refresh_partner_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target uuid := COALESCE(NEW.partner_id, OLD.partner_id);
BEGIN
  -- Ta aktualizacja przechodzi przez `partner_self_update_guard`, który dla
  -- niebędącego adminem przypina kolumny z ocenami do poprzednich wartości.
  -- Flaga transakcyjna mówi strażnikowi, że to zapis systemowy, a nie próba
  -- podkręcenia sobie oceny przez partnera.
  PERFORM set_config('app.partner_aggregate_refresh', '1', true);

  UPDATE public.partners p
  SET rating_avg = agg.avg_rating,
      rating_count = agg.total
  FROM (
    SELECT
      ROUND(AVG(rating)::numeric, 2) AS avg_rating,
      COUNT(*)::integer AS total
    FROM public.partner_reviews
    WHERE partner_id = target AND is_approved = true
  ) agg
  WHERE p.id = target;

  PERFORM set_config('app.partner_aggregate_refresh', '', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_partner_rating ON partner_reviews;
CREATE TRIGGER trg_refresh_partner_rating
  AFTER INSERT OR UPDATE OR DELETE ON partner_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_partner_rating();

/*
  Everything the author does not get to decide about their own review: whether
  it is published, and whether we vouch for them having been a customer.
*/
CREATE OR REPLACE FUNCTION public.partner_review_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.check_rate_limit(NEW.user_id, 'partner_review', 5, 60) THEN
    RAISE EXCEPTION 'Rate limit exceeded: too many partner reviews recently'
      USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.rate_limits (user_id, action_type)
  VALUES (NEW.user_id, 'partner_review');

  IF public.is_partner_member(NEW.partner_id) THEN
    RAISE EXCEPTION 'A partner cannot review itself'
      USING ERRCODE = 'P0001';
  END IF;

  NEW.is_approved := false;
  NEW.is_reported := false;
  NEW.is_verified_customer := EXISTS (
    SELECT 1 FROM public.partner_leads
    WHERE partner_id = NEW.partner_id
      AND user_id = NEW.user_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_review_insert_guard ON partner_reviews;
CREATE TRIGGER trg_partner_review_insert_guard
  BEFORE INSERT ON partner_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.partner_review_insert_guard();

/*
  An edited review goes back through moderation. Without this, "post something
  bland, get approved, then rewrite it" is the obvious way round the queue.
*/
CREATE OR REPLACE FUNCTION public.partner_review_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();

  IF public.is_admin() THEN
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

DROP TRIGGER IF EXISTS trg_partner_review_update_guard ON partner_reviews;
CREATE TRIGGER trg_partner_review_update_guard
  BEFORE UPDATE ON partner_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.partner_review_update_guard();

DROP POLICY IF EXISTS "Everyone can read approved partner reviews" ON partner_reviews;
CREATE POLICY "Everyone can read approved partner reviews"
  ON partner_reviews FOR SELECT
  TO anon, authenticated
  USING (is_approved = true);

DROP POLICY IF EXISTS "Authors partners and admins can read pending reviews" ON partner_reviews;
CREATE POLICY "Authors partners and admins can read pending reviews"
  ON partner_reviews FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR is_partner_member(partner_id)
    OR is_admin()
  );

DROP POLICY IF EXISTS "Authenticated users can review a partner" ON partner_reviews;
CREATE POLICY "Authenticated users can review a partner"
  ON partner_reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authors and admins can update partner reviews" ON partner_reviews;
CREATE POLICY "Authors and admins can update partner reviews"
  ON partner_reviews FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR is_admin());

DROP POLICY IF EXISTS "Authors and admins can delete partner reviews" ON partner_reviews;
CREATE POLICY "Authors and admins can delete partner reviews"
  ON partner_reviews FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR is_admin());

/*
  Replies are only public once the review they answer is public - otherwise a
  reply would leak the contents of a review still sitting in moderation.
*/
DROP POLICY IF EXISTS "Everyone can read replies to published reviews" ON partner_review_replies;
CREATE POLICY "Everyone can read replies to published reviews"
  ON partner_review_replies FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM partner_reviews r
      WHERE r.id = review_id AND r.is_approved = true
    )
  );

DROP POLICY IF EXISTS "Partners and admins can read own replies" ON partner_review_replies;
CREATE POLICY "Partners and admins can read own replies"
  ON partner_review_replies FOR SELECT
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Partners can reply to reviews about them" ON partner_review_replies;
CREATE POLICY "Partners can reply to reviews about them"
  ON partner_review_replies FOR INSERT
  TO authenticated
  WITH CHECK (
    (is_partner_member(partner_id) OR is_admin())
    AND EXISTS (
      SELECT 1 FROM partner_reviews r
      WHERE r.id = review_id AND r.partner_id = partner_review_replies.partner_id
    )
  );

DROP POLICY IF EXISTS "Partners can edit their reply" ON partner_review_replies;
CREATE POLICY "Partners can edit their reply"
  ON partner_review_replies FOR UPDATE
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin())
  WITH CHECK (is_partner_member(partner_id) OR is_admin());

DROP POLICY IF EXISTS "Partners and admins can delete a reply" ON partner_review_replies;
CREATE POLICY "Partners and admins can delete a reply"
  ON partner_review_replies FOR DELETE
  TO authenticated
  USING (is_partner_member(partner_id) OR is_admin());
