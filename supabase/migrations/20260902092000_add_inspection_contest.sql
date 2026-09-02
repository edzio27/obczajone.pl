/*
  # A weekly vote on which car gets inspected for free

  The site has content nobody else has - a partner's first-hand verdict on one
  specific advertised car - and produces roughly one a week, when a paying
  client happens to order one. Nothing about that is repeatable and nothing
  about it gives anyone a reason to come back on a Tuesday.

  The vote does both. One inspection a week is one piece of writing nobody else
  can publish, on a schedule people can follow.

  The important design choice is who submits the cars: **the seller does**, not
  a visitor pointing at a stranger's advert. Pointing at strangers cannot work -
  the partner needs the owner to open the car, and no owner agrees to a public
  technical verdict on something they are trying to sell, so the winning entry
  would simply never get inspected. Inverted, every constraint dissolves:
  consent comes with the entry, access is arranged by the person who wants us
  there, and an honest seller gets an independent verdict that sells the car
  faster than any description. It also makes entrants recruit the voters, which
  is the only mechanic here that brings traffic without the site owner doing it.

  1. `contest_rounds` — one week, one winner. Opening and closing a round is a
     commercial decision, so it belongs to the owner, not to a cron.
  2. `contest_entries` — a car put forward by whoever is selling it.
     - `consent_public` is CHECKed to be true rather than merely defaulted: the
       whole arrangement rests on that consent, and a row without it should be
       impossible to write, not just unusual.
     - `status` starts at 'pending' and the write guard pins it there for
       anyone but an admin, exactly like partner inspections. A form open to
       the internet that publishes straight to the page is a form that will
       publish something regrettable.
     - Contact details are for arranging the inspection and are readable only
       by admins - never through the anon key, and never on the public page.
  3. `contest_votes` — one vote per round per browser.
     - `voter_token` is a random id the browser keeps. It stops the same person
       clicking twice, and it stops nothing else: anyone determined can clear
       storage and vote again. That is the honest ceiling for voting without
       accounts, and the alternative - demanding registration - is the thing
       that made every other form on this site empty.
     - No SELECT policy. Counts live in `contest_entries.vote_count`,
       maintained by trigger, so the public page never needs to read tokens.
*/

CREATE TABLE IF NOT EXISTS contest_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  is_open boolean NOT NULL DEFAULT true,
  winner_entry_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contest_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES contest_rounds(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  listing_url text NOT NULL,
  title text NOT NULL,
  city text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  submitter_name text NOT NULL,
  submitter_contact text NOT NULL,
  consent_public boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  vote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT contest_entries_consent_required CHECK (consent_public = true),
  CONSTRAINT contest_entries_title_length CHECK (char_length(title) BETWEEN 3 AND 200),
  CONSTRAINT contest_entries_note_length CHECK (char_length(note) <= 1000),
  CONSTRAINT contest_entries_one_per_round UNIQUE (round_id, listing_url)
);

CREATE INDEX IF NOT EXISTS idx_contest_entries_round
  ON contest_entries (round_id, status, vote_count DESC);

CREATE TABLE IF NOT EXISTS contest_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES contest_rounds(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  voter_token uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT contest_votes_one_per_round UNIQUE (round_id, voter_token)
);

ALTER TABLE contest_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read rounds" ON contest_rounds;
CREATE POLICY "Everyone can read rounds"
  ON contest_rounds FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage rounds" ON contest_rounds;
CREATE POLICY "Admins manage rounds"
  ON contest_rounds FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

/*
  Publiczna lista pokazuje wyłącznie zgłoszenia zatwierdzone - i wyłącznie te
  kolumny, które są w widoku. Danych kontaktowych zgłaszającego nie widzi
  nikt poza administratorem, bo nie po to je podał.
*/
DROP POLICY IF EXISTS "Everyone can read approved entries" ON contest_entries;
CREATE POLICY "Everyone can read approved entries"
  ON contest_entries FOR SELECT TO anon, authenticated
  USING (status = 'approved');

DROP POLICY IF EXISTS "Admins can read every entry" ON contest_entries;
CREATE POLICY "Admins can read every entry"
  ON contest_entries FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Anyone can submit a car" ON contest_entries;
CREATE POLICY "Anyone can submit a car"
  ON contest_entries FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins moderate entries" ON contest_entries;
CREATE POLICY "Admins moderate entries"
  ON contest_entries FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins delete entries" ON contest_entries;
CREATE POLICY "Admins delete entries"
  ON contest_entries FOR DELETE TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "Anyone can vote" ON contest_votes;
CREATE POLICY "Anyone can vote"
  ON contest_votes FOR INSERT TO anon, authenticated WITH CHECK (true);

/* Bez polityki SELECT: liczniki są w contest_entries.vote_count. */

DROP POLICY IF EXISTS "Admins can read votes" ON contest_votes;
CREATE POLICY "Admins can read votes"
  ON contest_votes FOR SELECT TO authenticated USING (is_admin());

/*
  Zgłaszający nie decyduje o tym, czy jego auto jest już na liście - tak samo
  jak autor oględzin nie decyduje o zatwierdzeniu wpisu. Bez tego formularz
  otwarty dla całego internetu publikuje prosto na stronę.
*/
CREATE OR REPLACE FUNCTION public.contest_entry_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  /*
    Licznik głosów przepisuje własny wyzwalacz, działający pod tożsamością
    głosującego - czyli kogoś, kto adminem nie jest. Bez tego wyjątku strażnik
    cofałby każdą aktualizację licznika i głosy nigdy by się nie policzyły.
    Ten sam wzorzec co przy agregatach partnera.
  */
  IF coalesce(current_setting('app.contest_aggregate_refresh', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.vote_count := 0;
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_entry_write_guard ON contest_entries;
CREATE TRIGGER trg_contest_entry_write_guard
  BEFORE INSERT OR UPDATE ON contest_entries
  FOR EACH ROW EXECUTE FUNCTION public.contest_entry_write_guard();

/* Głos można oddać tylko w otwartej rundzie i tylko na zatwierdzone zgłoszenie. */
CREATE OR REPLACE FUNCTION public.contest_vote_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry_round uuid;
  entry_status text;
  round_open boolean;
BEGIN
  SELECT round_id, status INTO entry_round, entry_status
  FROM public.contest_entries WHERE id = NEW.entry_id;

  IF entry_status IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'contest_entry_not_votable';
  END IF;

  NEW.round_id := entry_round;

  SELECT is_open AND now() BETWEEN starts_at AND ends_at INTO round_open
  FROM public.contest_rounds WHERE id = entry_round;

  IF round_open IS NOT TRUE THEN
    RAISE EXCEPTION 'contest_round_closed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contest_vote_guard ON contest_votes;
CREATE TRIGGER trg_contest_vote_guard
  BEFORE INSERT ON contest_votes
  FOR EACH ROW EXECUTE FUNCTION public.contest_vote_guard();

CREATE OR REPLACE FUNCTION public.refresh_contest_vote_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target uuid := COALESCE(NEW.entry_id, OLD.entry_id);
BEGIN
  PERFORM set_config('app.contest_aggregate_refresh', '1', true);

  UPDATE public.contest_entries
  SET vote_count = (SELECT count(*) FROM public.contest_votes WHERE entry_id = target)
  WHERE id = target;

  PERFORM set_config('app.contest_aggregate_refresh', '', true);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_contest_vote_count ON contest_votes;
CREATE TRIGGER trg_refresh_contest_vote_count
  AFTER INSERT OR DELETE ON contest_votes
  FOR EACH ROW EXECUTE FUNCTION public.refresh_contest_vote_count();

ALTER TABLE contest_rounds
  ADD CONSTRAINT contest_rounds_winner_fk
  FOREIGN KEY (winner_entry_id) REFERENCES contest_entries(id) ON DELETE SET NULL;
