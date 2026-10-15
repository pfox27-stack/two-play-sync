CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  white_name text,
  black_name text,
  fen text NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text NOT NULL DEFAULT '',
  moves jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'waiting',
  result text,
  reason text,
  base_ms integer NOT NULL DEFAULT 300000,
  increment_ms integer NOT NULL DEFAULT 0,
  white_time_ms integer NOT NULL DEFAULT 300000,
  black_time_ms integer NOT NULL DEFAULT 300000,
  last_move_at timestamptz,
  draw_offer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO anon, authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view games" ON public.games FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.game_seats (
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  color text NOT NULL,
  token text NOT NULL,
  PRIMARY KEY (game_id, color)
);
GRANT ALL ON public.game_seats TO service_role;
ALTER TABLE public.game_seats ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.games REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;