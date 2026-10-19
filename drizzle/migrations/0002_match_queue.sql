CREATE TABLE public.match_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_min int NOT NULL,
  inc_sec int NOT NULL,
  secret text NOT NULL,
  game_id uuid,
  seat_token text,
  color text,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.match_queue TO service_role;
ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX match_queue_waiting ON public.match_queue (base_min, inc_sec, created_at) WHERE game_id IS NULL;