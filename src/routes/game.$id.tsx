import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadSoundSettings, playSound, setSoundEnabled, setSoundVolume, unlockAudio } from "@/lib/sounds";
import { Chess } from "chess.js";
import { supabase } from "@/integrations/supabase/client";
import { gameAction, getMySeat, joinGame, makeMove, sendChat } from "@/lib/game.functions";
import { loadName, loadSeat, saveName, saveSeat } from "@/lib/seats";
import { ChessBoard } from "@/components/ChessBoard";
import { Confetti } from "@/components/Confetti";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Piece } from "@/components/Pieces";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Flag, Play, Repeat, Send, SquarePlus, Timer, Volume2, VolumeX } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Game = Database["public"]["Tables"]["games"]["Row"];

export const Route = createFileRoute("/game/$id")({
  head: () => ({
    meta: [
      { title: "Live chess game — Gambiteer" },
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
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [tab, setTab] = useState<"moves" | "chat" | "info">("moves");
  const [chat, setChat] = useState<{ id: string; color: string; name: string; body: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    supabase.from("game_chat").select("id,color,name,body").eq("game_id", id).order("created_at").then(({ data }) => data && setChat(data));
    const ch = supabase
      .channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_chat", filter: `game_id=eq.${id}` }, (p) => {
        const m = p.new as { id: string; color: string; name: string; body: string };
        setChat((c) => (c.some((x) => x.id === m.id) ? c : [...c, m]));
        if (tabRef.current !== "chat") setUnread((u) => u + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

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
  const lastMove = useMemo(() => (last ? { from: last.from, to: last.to } : null), [last?.from, last?.to, history.length]);
  const onPremoveSet = useCallback(() => playSound("premove"), []);

  // sounds: one per move count, never stacked
  const [soundOn, setSoundOn] = useState(true);
  const [vol, setVol] = useState(0.7);
  useEffect(() => {
    const s = loadSoundSettings();
    setSoundOn(s.enabled);
    setVol(s.volume);
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const soundCount = useRef<number | null>(null);
  const endPlayed = useRef(false);
  useEffect(() => {
    if (!game) return;
    const n = history.length;
    if (soundCount.current === null) {
      soundCount.current = n;
      endPlayed.current = game.status === "finished";
      return;
    }
    if (n > soundCount.current && last) {
      const mine = !!myColor && (last.color === "w" ? "white" : "black") === myColor;
      if (last.san.includes("+") || last.san.includes("#")) playSound("check");
      else if (last.promotion) playSound("promote");
      else if (last.captured) playSound("capture");
      else if (last.flags.includes("k") || last.flags.includes("q")) playSound("castle");
      else playSound(mine ? "move" : "move-opponent");
    }
    soundCount.current = n;
    if (game.status === "finished" && !endPlayed.current) {
      endPlayed.current = true;
      setTimeout(() => playSound("end"), 150);
    }
  }, [game, history.length, last, myColor]);

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

  const gameRef = useRef(game);
  gameRef.current = game;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const move = useCallback(async (from: string, to: string, promotion?: string) => {
    const game = gameRef.current;
    const token = tokenRef.current;
    if (!token || !game) return;
    setViewPly(null);
    // optimistic
    const c = new Chess(game.fen);
    try {
      const m = c.move({ from, to, promotion: promotion ?? "q" });
      setGame({ ...game, fen: c.fen(), moves: [...((game.moves as string[]) ?? []), m.san] });
    } catch {
      return;
    }
    try {
      await makeMove({ data: { gameId: id, token, from, to, ...(promotion ? { promotion } : {}) } });
    } catch (e) {
      setErr((e as Error).message);
      const { data } = await supabase.from("games").select("*").eq("id", id).single();
      if (data) setGame(data);
    }
  }, [id]);

  const act = (action: "resign" | "offer_draw" | "accept_draw" | "decline_draw") =>
    token && gameAction({ data: { gameId: id, token, action } });

  if (!game) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading game…</div>;

  const base = myColor ?? "white";
  const orientation = flipped ? (base === "white" ? "black" : "white") : base;
  const top = orientation === "white" ? "black" : "white";
  const bottom = orientation;
  // Always share the published site URL — the editor preview URL requires a Lovable login.
  const inviteUrl = typeof window !== "undefined" ? `https://gambiteer.lovable.app${window.location.pathname}` : "";
  const canJoin = !myColor && game.status === "waiting";
  const oppOfferedDraw = myColor && game.draw_offer && game.draw_offer !== myColor;
  const sans = (game.moves as string[]) ?? [];
  const times = (game.move_times as number[] | null) ?? [];
  const total = sans.length;
  const ply = viewPly === null ? total : Math.min(viewPly, total);
  const reviewing = ply !== total;
  let viewFen = game.fen;
  let viewLast: { from: string; to: string } | null = lastMove;
  if (reviewing) {
    const c = new Chess();
    let lm: { from: string; to: string } | null = null;
    for (const san of sans.slice(0, ply)) { const m = c.move(san); lm = { from: m.from, to: m.to }; }
    viewFen = c.fen();
    viewLast = lm;
  }
  const go = (n: number) => setViewPly(Math.max(0, Math.min(total, n)) === total ? null : Math.max(0, Math.min(total, n)));

  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < sans.length; i += 2) { const w = sans[i]; if (w) rows.push([w, sans[i + 1]]); }
  const tfmt = (ms: number | undefined) => (ms === undefined ? "" : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : fmt(ms));
  const iWon = game.status === "finished" && game.reason === "checkmate" && !!myColor &&
    ((game.result === "1-0" && myColor === "white") || (game.result === "0-1" && myColor === "black"));
  const resultText = game.result === "1/2-1/2" ? `Draw by ${game.reason}` : `${game.result === "1-0" ? "White" : "Black"} won by ${game.reason}`;

  const playerBar = (c: "white" | "black", pos: "top" | "bottom") => {
    const n = c === "white" ? game.white_name : game.black_name;
    const active = game.status === "active" && turn === c;
    return (
      <div className={`flex items-center justify-between ${pos === "top" ? "pb-2" : "pt-2"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded ${c === "white" ? "bg-piece-white" : "bg-secondary"}`}>
            <Piece type="p" color={c === "white" ? "b" : "w"} className="size-8" />
          </div>
          <span className="truncate text-sm font-bold">{n ?? "Waiting for opponent…"}</span>
          {myColor === c && <span className="text-xs text-muted-foreground">(you)</span>}
        </div>
        <div className={`flex min-w-32 items-center justify-between gap-3 rounded px-3 py-1.5 font-mono text-2xl font-bold tabular-nums ${active ? "bg-clock-active text-clock-active-foreground" : "bg-sidebar text-muted-foreground"}`}>
          <Timer className={`size-5 ${active ? "" : "opacity-0"}`} />
          {fmt(clock(c))}
        </div>
      </div>
    );
  };

  async function send() {
    const body = draft.trim();
    if (!body || !token) return;
    setDraft("");
    try { await sendChat({ data: { gameId: id, token, body } }); } catch (e) { setErr((e as Error).message); }
  }

  const tabBtn = (t: "moves" | "chat" | "info", label: string) => (
    <button onClick={() => { setTab(t); if (t === "chat") setUnread(0); }} className={`relative flex-1 py-3 text-sm font-semibold ${tab === t ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {label}{t === "chat" && unread > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread}</span>}
    </button>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-4 lg:flex-row lg:items-stretch lg:py-6">
      <div className="w-full lg:max-w-[min(calc(100vh-9rem),680px)] lg:flex-1">
        {playerBar(top, "top")}
        <ChessBoard
          fen={viewFen}
          orientation={orientation}
          playerColor={myColor ? (myColor === "white" ? "w" : "b") : null}
          active={game.status === "active" && !reviewing}
          lastMove={viewLast}
          onMove={move}
          onPremoveSet={onPremoveSet}
        />
        {playerBar(bottom, "bottom")}
      </div>

      <aside className="flex w-full flex-col overflow-hidden rounded-md bg-card lg:h-[min(calc(100vh-3rem),760px)] lg:w-80">
        <div className="grid grid-cols-4 bg-sidebar text-xs">
          <span className="flex flex-col items-center gap-1 bg-card py-2 font-semibold"><Timer className="size-5" />Play</span>
          <Link to="/" className="flex flex-col items-center gap-1 py-2 text-muted-foreground hover:text-foreground"><SquarePlus className="size-5" />New Game</Link>
          <button onClick={() => setFlipped((f) => !f)} className="flex flex-col items-center gap-1 py-2 text-muted-foreground hover:text-foreground"><Repeat className="size-5" />Flip</button>
          <button onClick={() => { const v = !soundOn; setSoundOn(v); setSoundEnabled(v); }} className="flex flex-col items-center gap-1 py-2 text-muted-foreground hover:text-foreground">{soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}Sound</button>
        </div>
        <div className="flex border-b border-border">{tabBtn("moves", "Moves")}{tabBtn("chat", "Chat")}{tabBtn("info", "Info")}</div>

        {game.status === "waiting" && myColor && (
          <div className="space-y-2 border-b border-border p-3">
            <p className="text-sm font-semibold">Send this link to your opponent:</p>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="text-xs" onFocus={(e) => e.target.select()} />
              <Button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); }}>{copied ? "Copied" : "Copy"}</Button>
            </div>
          </div>
        )}
        {canJoin && (
          <div className="space-y-2 border-b border-border p-3">
            <p className="text-sm font-semibold">You've been invited! Enter your name to join.</p>
            <Input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <Button className="w-full font-bold" onClick={join}>Join game</Button>
          </div>
        )}

        <div className="min-h-48 flex-1 overflow-y-auto">
          {tab === "moves" && (
            <div className="text-sm">
              <button onClick={() => go(0)} className={`flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-left ${ply === 0 ? "bg-accent" : ""}`}>Starting Position</button>
              {rows.map(([w, b], i) => (
                <div key={i} className={`grid grid-cols-[2.5rem_1fr_1fr] px-2 py-1 font-mono ${i % 2 ? "bg-secondary/40" : ""}`}>
                  <span className="pl-2 text-muted-foreground">{i + 1}.</span>
                  <button onClick={() => go(i * 2 + 1)} className="flex items-baseline gap-1.5 text-left">
                    <span className={`rounded px-1 ${ply === i * 2 + 1 ? "bg-accent font-bold" : ""}`}>{w}</span>
                    <span className="text-[11px] text-muted-foreground">{tfmt(times[i * 2])}</span>
                  </button>
                  {b && (
                    <button onClick={() => go(i * 2 + 2)} className="flex items-baseline gap-1.5 text-left">
                      <span className={`rounded px-1 ${ply === i * 2 + 2 ? "bg-accent font-bold" : ""}`}>{b}</span>
                      <span className="text-[11px] text-muted-foreground">{tfmt(times[i * 2 + 1])}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {tab === "chat" && (
            <div className="flex h-full flex-col">
              <div className="flex-1 space-y-1.5 p-3 text-sm">
                {chat.length === 0 && <p className="text-muted-foreground">No messages yet. Say hi!</p>}
                {chat.map((m) => (
                  <p key={m.id}><span className={`font-bold ${m.color === myColor ? "text-primary" : ""}`}>{m.name}:</span> <span className="break-words">{m.body}</span></p>
                ))}
              </div>
              <form className="flex gap-2 border-t border-border p-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <Input value={draft} maxLength={300} disabled={!myColor} onChange={(e) => setDraft(e.target.value)} placeholder={myColor ? "Send a message…" : "Only players can chat"} />
                <Button type="submit" size="icon" disabled={!myColor || !draft.trim()} aria-label="Send"><Send className="size-4" /></Button>
              </form>
            </div>
          )}
          {tab === "info" && (
            <div className="space-y-3 p-4 text-sm">
              <p><span className="text-muted-foreground">Time control:</span> {Math.round(game.base_ms / 60000)} | {Math.round(game.increment_ms / 1000)}</p>
              <p><span className="text-muted-foreground">White:</span> {game.white_name ?? "—"}</p>
              <p><span className="text-muted-foreground">Black:</span> {game.black_name ?? "—"}</p>
              <p><span className="text-muted-foreground">Status:</span> {game.status === "finished" ? resultText : game.status === "active" ? `${turn === "white" ? "White" : "Black"} to move` : "Waiting for opponent"}</p>
              {!myColor && game.status !== "waiting" && <p className="text-muted-foreground">Spectating live</p>}
              <label className="flex items-center gap-3">Volume
                <input type="range" min={0} max={1} step={0.05} value={vol} disabled={!soundOn} aria-label="Volume" className="flex-1 accent-primary"
                  onChange={(e) => { const v = parseFloat(e.target.value); setVol(v); setSoundVolume(v); }} />
              </label>
            </div>
          )}
        </div>

        {oppOfferedDraw && game.status === "active" && (
          <div className="border-t border-border p-3 text-sm">
            <p className="font-semibold">Your opponent offers a draw</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => act("accept_draw")}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => act("decline_draw")}>Decline</Button>
            </div>
          </div>
        )}
        {err && <p className="px-3 pb-1 text-sm text-destructive">{err}</p>}

        <div className="space-y-2 bg-sidebar p-3">
          <div className="grid grid-cols-5 gap-2">
            {[
              { icon: ChevronFirst, label: "First move", on: () => go(0) },
              { icon: ChevronLeft, label: "Previous move", on: () => go(ply - 1) },
              { icon: Play, label: "Live position", on: () => setViewPly(null) },
              { icon: ChevronRight, label: "Next move", on: () => go(ply + 1) },
              { icon: ChevronLast, label: "Last move", on: () => setViewPly(null) },
            ].map(({ icon: I, label, on }) => (
              <Button key={label} variant="secondary" aria-label={label} title={label} className="h-11" onClick={on}><I className="size-5" /></Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="font-bold" disabled={!myColor || game.status !== "active" || !!game.draw_offer} onClick={() => act("offer_draw")}>½ Draw</Button>
            <Button variant="ghost" size="sm" className="font-bold" disabled={!myColor || game.status !== "active"} onClick={() => act("resign")}><Flag className="size-4" />Resign</Button>
            {myColor && game.draw_offer === myColor && game.status === "active" && <span className="text-xs text-muted-foreground">Offer sent</span>}
            <Button variant="ghost" size="icon" className="ml-auto" aria-label="Flip board" onClick={() => setFlipped((f) => !f)}><Repeat className="size-4" /></Button>
          </div>
        </div>
      </aside>

      {iWon && <Confetti />}
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
