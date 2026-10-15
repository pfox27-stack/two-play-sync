import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { supabase } from "@/integrations/supabase/client";
import { gameAction, getMySeat, joinGame, makeMove } from "@/lib/game.functions";
import { loadName, loadSeat, saveName, saveSeat } from "@/lib/seats";
import { ChessBoard } from "@/components/ChessBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";

type Game = Database["public"]["Tables"]["games"]["Row"];

export const Route = createFileRoute("/game/$id")({
  head: () => ({
    meta: [
      { title: "Live chess game — Checkmate Online" },
      { name: "description", content: "Join or watch this live chess game." },
      { property: "og:title", content: "You're invited to a chess game" },
      { property: "og:description", content: "Open the link to play or watch live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GamePage,
});

function fmt(ms: number) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (ms < 10000) return `${m}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function GamePage() {
  const { id } = Route.useParams();
  const [game, setGame] = useState<Game | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<"white" | "black" | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flipped, setFlipped] = useState(false);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [showOver, setShowOver] = useState(true);

  // load + realtime
  useEffect(() => {
    supabase.from("games").select("*").eq("id", id).single().then(({ data }) => setGame(data));
    const ch = supabase
      .channel(`game-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` }, (p) =>
        setGame(p.new as Game),
      )
      .subscribe();
    // safety resync in case a realtime event is missed
    const poll = setInterval(() => {
      supabase.from("games").select("*").eq("id", id).single().then(({ data }) => data && setGame(data));
    }, 5000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [id]);

  useEffect(() => {
    setName(loadName());
    const t = loadSeat(id);
    if (t) {
      setToken(t);
      getMySeat({ data: { gameId: id, token: t } }).then((r) => setMyColor(r.color));
    }
  }, [id]);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);

  const chess = useMemo(() => {
    const c = new Chess();
    for (const san of (game?.moves as string[]) ?? []) c.move(san);
    return c;
  }, [game?.moves]);
  const history = chess.history({ verbose: true });
  const last = history[history.length - 1];
  const turn = chess.turn() === "w" ? "white" : "black";

  const clock = useCallback(
    (c: "white" | "black") => {
      if (!game) return 0;
      const base = c === "white" ? game.white_time_ms : game.black_time_ms;
      if (game.status === "active" && turn === c && game.last_move_at) return base - (now - new Date(game.last_move_at).getTime());
      return base;
    },
    [game, now, turn],
  );

  // ask server to verify flag when a clock hits zero
  const flagging = game?.status === "active" && clock(turn) <= 0;
  useEffect(() => {
    if (flagging) gameAction({ data: { gameId: id, action: "flag" } });
  }, [flagging, id]);

  async function join() {
    if (!name.trim()) return setErr("Enter your name");
    try {
      saveName(name.trim());
      const r = await joinGame({ data: { gameId: id, name: name.trim() } });
      saveSeat(id, r.token);
      setToken(r.token);
      setMyColor(r.color);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function move(from: string, to: string, promotion?: string) {
    if (!token || !game) return;
    // optimistic
    const c = new Chess(game.fen);
    try {
      const m = c.move({ from, to, promotion: promotion ?? "q" });
      setGame({ ...game, fen: c.fen(), moves: [...((game.moves as string[]) ?? []), m.san] });
    } catch {
      return;
    }
    try {
      await makeMove({ data: { gameId: id, token, from, to, promotion } });
    } catch (e) {
      setErr((e as Error).message);
      const { data } = await supabase.from("games").select("*").eq("id", id).single();
      if (data) setGame(data);
    }
  }

  const act = (action: "resign" | "offer_draw" | "accept_draw" | "decline_draw") =>
    token && gameAction({ data: { gameId: id, token, action } });

  if (!game) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading game…</div>;

  const base = myColor ?? "white";
  const orientation = flipped ? (base === "white" ? "black" : "white") : base;
  const top = orientation === "white" ? "black" : "white";
  const bottom = orientation;
  // Always share the published site URL — the editor preview URL requires a Lovable login.
  const inviteUrl =
    typeof window !== "undefined" ? `https://two-play-sync.lovable.app${window.location.pathname}` : "";
  const canJoin = !myColor && game.status === "waiting";
  const oppOfferedDraw = myColor && game.draw_offer && game.draw_offer !== myColor;

  const PlayerBar = ({ c }: { c: "white" | "black" }) => {
    const n = c === "white" ? game.white_name : game.black_name;
    const active = game.status === "active" && turn === c;
    return (
      <div className="flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded text-xl ${c === "white" ? "bg-piece-white text-piece-black" : "bg-piece-black text-piece-white"}`}>
            ♟
          </div>
          <span className="font-semibold">{n ?? "Waiting for opponent…"}</span>
          {myColor === c && <span className="rounded bg-secondary px-1.5 text-xs text-muted-foreground">you</span>}
        </div>
        <div
          className={`min-w-24 rounded px-3 py-1.5 text-right font-mono text-xl font-bold tabular-nums ${
            active ? "bg-clock-active text-clock-active-foreground" : "bg-secondary text-muted-foreground"
          }`}
        >
          {fmt(clock(c))}
        </div>
      </div>
    );
  };

  const rows: [string, string | undefined][] = [];
  const sans = (game.moves as string[]) ?? [];
  for (let i = 0; i < sans.length; i += 2) {
    const w = sans[i];
    if (w) rows.push([w, sans[i + 1]]);
  }

  const resultText =
    game.result === "1/2-1/2"
      ? `Draw by ${game.reason}`
      : `${game.result === "1-0" ? "White" : "Black"} won by ${game.reason}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-3 py-4 lg:flex-row lg:items-start lg:py-8">
      <div className="w-full lg:max-w-[min(80vh,640px)] lg:flex-1">
        <PlayerBar c={top} />
        <ChessBoard
          fen={game.fen}
          orientation={orientation}
          canMove={!!myColor && game.status === "active" && myColor === orientation}
          lastMove={last ? { from: last.from, to: last.to } : null}
          onMove={move}
        />
        <PlayerBar c={bottom} />
      </div>

      <aside className="flex w-full flex-col gap-4 rounded-xl bg-card p-4 lg:w-80">
        <Link to="/" className="text-sm font-bold text-primary">← New game</Link>

        {game.status === "waiting" && myColor && (
          <div className="space-y-2 rounded-lg bg-secondary p-3">
            <p className="text-sm font-semibold">Send this link to your opponent:</p>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" onFocus={(e) => e.target.select()} />
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(inviteUrl);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">The game starts as soon as they open it on their device.</p>
          </div>
        )}

        {canJoin && (
          <div className="space-y-2 rounded-lg bg-secondary p-3">
            <p className="text-sm font-semibold">You've been invited! Enter your name to join.</p>
            <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Button className="w-full font-bold" onClick={join}>Join game</Button>
          </div>
        )}

        {!myColor && game.status !== "waiting" && <p className="text-sm text-muted-foreground">Spectating live</p>}

        <div className="max-h-72 min-h-32 overflow-y-auto rounded-lg bg-background/40 p-2 font-mono text-sm">
          {rows.length === 0 && <p className="p-2 text-muted-foreground">No moves yet</p>}
          {rows.map(([w, b], i) => (
            <div key={i} className={`grid grid-cols-[2.5rem_1fr_1fr] px-2 py-0.5 ${i % 2 ? "bg-secondary/40" : ""}`}>
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className={i * 2 === sans.length - 1 ? "rounded bg-accent px-1 font-bold" : "px-1"}>{w}</span>
              <span className={i * 2 + 1 === sans.length - 1 ? "rounded bg-accent px-1 font-bold" : "px-1"}>{b}</span>
            </div>
          ))}
        </div>

        {oppOfferedDraw && game.status === "active" && (
          <div className="rounded-lg bg-secondary p-3 text-sm">
            <p className="font-semibold">Your opponent offers a draw</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => act("accept_draw")}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => act("decline_draw")}>Decline</Button>
            </div>
          </div>
        )}
        {myColor && game.draw_offer === myColor && game.status === "active" && (
          <p className="text-sm text-muted-foreground">Draw offer sent…</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" disabled={!myColor || game.status !== "active"} onClick={() => act("resign")}>Resign</Button>
          <Button variant="secondary" disabled={!myColor || game.status !== "active" || !!game.draw_offer} onClick={() => act("offer_draw")}>Draw</Button>
          <Button variant="secondary" onClick={() => setFlipped((f) => !f)}>Flip</Button>
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </aside>

      {game.status === "finished" && showOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
          <div className="w-full max-w-xs rounded-xl bg-card p-6 text-center">
            <h2 className="text-2xl font-extrabold">Game over</h2>
            <p className="mt-2 text-muted-foreground">{resultText}</p>
            <div className="mt-6 flex flex-col gap-2">
              <Button asChild><Link to="/">New Game</Link></Button>
              <Button variant="outline" onClick={() => setShowOver(false)}>View board</Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
