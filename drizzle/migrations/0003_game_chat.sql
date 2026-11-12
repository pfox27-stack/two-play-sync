CREATE TABLE public.game_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  color text NOT NULL,
  name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX game_chat_game_idx ON public.game_chat (game_id, created_at);
GRANT SELECT ON public.game_chat TO anon, authenticated;
GRANT ALL ON public.game_chat TO service_role;
ALTER TABLE public.game_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read game chat" ON public.game_chat FOR SELECT TO anon, authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_chat;