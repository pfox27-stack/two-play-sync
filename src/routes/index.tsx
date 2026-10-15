import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createGame } from "@/lib/game.functions";
import { loadName, saveName, saveSeat } from "@/lib/seats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Checkmate Online — Play chess with a friend" },
      { name: "description", content: "Create a chess game, share the link, and play live against a friend on any device." },
      { property: "og:title", content: "Checkmate Online — Play chess with a friend" },
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
  const [tc, setTc] = useState(CONTROLS[2]);
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => setName(loadName()), []);

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
        <h1 className="text-center text-4xl font-extrabold tracking-tight">
          <span className="text-primary">♞</span> Checkmate Online
        </h1>
        <p className="mt-2 text-center text-muted-foreground">Create a game, send the link, play on two devices.</p>

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
            {busy ? "Creating…" : "Play a Friend"}
          </Button>
        </div>
      </div>
    </main>
  );
}
