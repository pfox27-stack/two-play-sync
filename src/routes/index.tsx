import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { createGame, joinQueue, leaveQueue, pollQueue } from "@/lib/game.functions";
import { loadName, saveName, saveSeat } from "@/lib/seats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gambiteer — Play chess with a friend" },
      { name: "description", content: "Create a chess game, share the link, and play live against a friend on any device." },
      { property: "og:title", content: "Gambiteer — Play chess with a friend" },
      { property: "og:description", content: "Real-time two-device chess with clocks and invite links." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CONTROLS = [
  { label: "1 | 0", group: "Bullet", base: 1, inc: 0 },
  { label: "3 | 2", group: "Blitz", base: 3, inc: 2 },
  { label: "5 | 0", group: "Blitz", base: 5, inc: 0 },
  { label: "10 | 0", group: "Rapid", base: 10, inc: 0 },
  { label: "15 | 10", group: "Rapid", base: 15, inc: 10 },
];

function Index() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [tc, setTc] = useState(CONTROLS[2] ?? { label: "5 | 0", group: "Blitz", base: 5, inc: 0 });
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setName(loadName()), []);

  // ---- random matchmaking ----
  const [queue, setQueue] = useState<{ queueId: string; secret: string } | null>(null);
  const [waitSec, setWaitSec] = useState(0);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  async function findMatch() {
    if (!name.trim()) return setErr("Enter your name first");
    setErr("");
    setBusy(true);
    try {
      saveName(name.trim());
      const r = await joinQueue({ data: { name: name.trim(), baseMin: tc.base, incSec: tc.inc } });
      if (r.matched) {
        saveSeat(r.gameId, r.token);
        navigate({ to: "/game/$id", params: { id: r.gameId } });
        return;
      }
      setWaitSec(0);
      setQueue({ queueId: r.queueId, secret: r.secret });
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }

  useEffect(() => {
    if (!queue) return;
    const started = Date.now();
    const i = setInterval(async () => {
      setWaitSec(Math.floor((Date.now() - started) / 1000));
      try {
        const r = await pollQueue({ data: queue });
        if (r.gameId && r.token) {
          clearInterval(i);
          saveSeat(r.gameId, r.token);
          setQueue(null);
          navigate({ to: "/game/$id", params: { id: r.gameId } });
        }
      } catch {
        /* keep trying */
      }
    }, 1500);
    return () => clearInterval(i);
  }, [queue, navigate]);

  // leave the queue if the page is closed while waiting
  useEffect(() => {
    const bye = () => queueRef.current && leaveQueue({ data: queueRef.current });
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, []);

  function cancelQueue() {
    if (queue) leaveQueue({ data: queue });
    setQueue(null);
  }

  async function start() {
    if (!name.trim()) return setErr("Enter your name first");
    setBusy(true);
    setErr("");
    try {
      saveName(name.trim());
      const r = await createGame({ data: { name: name.trim(), color, baseMin: tc.base, incSec: tc.inc } });
      saveSeat(r.gameId, r.token);
      navigate({ to: "/game/$id", params: { id: r.gameId } });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <h1 className="text-center text-4xl font-extrabold tracking-normal">
          <span className="text-primary">♞</span> Gambiteer
        </h1>
        <p className="mt-2 text-center text-muted-foreground">Play a friend with a link, or get matched with a random opponent.</p>

        <div className="mt-8 space-y-6 rounded-xl bg-card p-6">
          <div>
            <label className="text-sm font-semibold text-muted-foreground">Your name</label>
            <Input className="mt-2" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="e.g. Magnus" />
          </div>
          <div>
            <label className="text-sm font-semibold text-muted-foreground">Time control</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {CONTROLS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => setTc(c)}
                  className={`rounded-md px-2 py-3 text-sm font-bold transition-colors ${
                    tc === c ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"
                  }`}
                >
                  {c.label}
                  <div className="text-[10px] font-medium opacity-70">{c.group}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-muted-foreground">Play as</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["white", "random", "black"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`rounded-md py-2 text-sm font-semibold capitalize ${color === c ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button size="lg" className="w-full text-lg font-bold" disabled={busy} onClick={start}>
            {busy ? "Please wait…" : "Play a Friend"}
          </Button>
          {queue ? (
            <div className="space-y-2 rounded-lg bg-secondary p-3 text-center">
              <p className="font-semibold">Searching for an opponent… {waitSec}s</p>
              <p className="text-xs text-muted-foreground">{tc.label} · you'll get a random color</p>
              <Button variant="outline" className="w-full" onClick={cancelQueue}>Cancel</Button>
            </div>
          ) : (
            <Button size="lg" variant="secondary" className="w-full text-lg font-bold" disabled={busy} onClick={findMatch}>
              Play a Random Opponent
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
