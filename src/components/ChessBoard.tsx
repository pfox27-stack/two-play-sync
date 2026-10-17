import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { Piece } from "./Pieces";

const FILES = "abcdefgh";

type Props = {
  fen: string;
  orientation: "white" | "black";
  /** Color this viewer plays, or null for spectators. */
  playerColor: "w" | "b" | null;
  /** Whether the game is in progress (moves/premoves allowed). */
  active: boolean;
  lastMove?: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
  onPremoveSet?: () => void;
};

type ArrowColor = "green" | "red" | "yellow" | "blue";
type Arrow = { from: Square; to: Square; color: ArrowColor };

function colorFor(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): ArrowColor {
  if (e.shiftKey) return "red";
  if (e.ctrlKey || e.metaKey) return "green";
  if (e.altKey) return "blue";
  return "yellow";
}

/** Pseudo-legal destinations for my piece as if it were my turn. */
function premoveTargets(fen: string, sq: Square, color: "w" | "b") {
  const parts = fen.split(" ");
  parts[1] = color;
  parts[3] = "-";
  try {
    const c = new Chess(parts.join(" "), { skipValidation: true });
    return new Set(c.moves({ square: sq, verbose: true }).map((m) => m.to as string));
  } catch {
    return new Set<string>();
  }
}

export function ChessBoard({ fen, orientation, playerColor, active, lastMove, onMove, onPremoveSet }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number; moved: boolean } | null>(null);
  const [premove, setPremove] = useState<{ from: Square; to: Square } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [highlights, setHighlights] = useState<Map<string, ArrowColor>>(new Map());
  const [rdrag, setRdrag] = useState<{ from: Square; to: Square; color: ArrowColor } | null>(null);
  const skipSlide = useRef<string | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  // held-piece sway: tracks cursor velocity and tilts the dragged piece
  const swayEl = useRef<HTMLDivElement>(null);
  const sway = useRef({ lastX: 0, lastT: 0, vx: 0, rot: 0 });

  const myTurn = !!playerColor && chess.turn() === playerColor;
  const flip = orientation === "black";

  // ---- previous position (for animations) ----
  const [fens, setFens] = useState<{ cur: string; prev: string | null }>({ cur: fen, prev: null });
  if (fens.cur !== fen) setFens({ cur: fen, prev: fens.cur });

  const anim = useMemo(() => {
    if (!fens.prev || !lastMove || fens.cur !== fen) return null;
    const prev = new Chess(fens.prev);
    const from = lastMove.from as Square;
    const to = lastMove.to as Square;
    const before = prev.get(from);
    const after = chess.get(to);
    if (!before || !after || before.color !== after.color) return null;
    let captured: { sq: Square; type: string; color: "w" | "b" } | null = null;
    const victim = prev.get(to);
    if (victim) captured = { sq: to, type: victim.type, color: victim.color };
    else if (before.type === "p" && from[0] !== to[0]) {
      const epSq = `${to[0]}${from[1]}` as Square;
      const ep = prev.get(epSq);
      if (ep) captured = { sq: epSq, type: ep.type, color: ep.color };
    }
    let rook: { from: Square; to: Square } | null = null;
    if (before.type === "k" && Math.abs(FILES.indexOf(from[0]!) - FILES.indexOf(to[0]!)) === 2) {
      const kingSide = to[0] === "g";
      rook = { from: `${kingSide ? "h" : "a"}${from[1]}` as Square, to: `${kingSide ? "f" : "d"}${from[1]}` as Square };
    }
    return {
      from,
      to,
      slide: skipSlide.current !== to,
      captured,
      rook,
      promoted: before.type === "p" && after.type !== "p",
    };
  }, [fens, fen, chess, lastMove]);

  useEffect(() => {
    skipSlide.current = null;
  }, [fen]);

  // ---- premove execution ----
  useEffect(() => {
    if (!premove || !myTurn || !active) return;
    const pm = premove;
    const t = setTimeout(() => {
      setPremove(null);
      const m = chess.moves({ square: pm.from, verbose: true }).find((mv) => mv.to === pm.to);
      if (m) onMoveRef.current(pm.from, pm.to, m.promotion ? "q" : undefined);
    }, 50);
    return () => clearTimeout(t);
  }, [fen, myTurn, premove, active, chess]);

  useEffect(() => {
    if (!active) setPremove(null);
  }, [active]);

  const targets = useMemo(() => {
    const src = drag?.from ?? selected;
    if (!src || !playerColor) return new Map<string, boolean>();
    if (myTurn) return new Map(chess.moves({ square: src, verbose: true }).map((m) => [m.to as string, !!m.captured]));
    return new Map([...premoveTargets(fen, src, playerColor)].map((s) => [s, false]));
  }, [chess, fen, selected, drag?.from, playerColor, myTurn]);

  const checkSquare = chess.inCheck()
    ? chess.board().flat().find((p) => p && p.type === "k" && p.color === chess.turn())?.square
    : undefined;

  function isMine(sq: Square) {
    const p = chess.get(sq);
    return !!(active && playerColor && p && p.color === playerColor);
  }

  function squareAt(x: number, y: number): Square | null {
    const r = boardRef.current?.getBoundingClientRect();
    if (!r) return null;
    const c = Math.floor(((x - r.left) / r.width) * 8);
    const row = Math.floor(((y - r.top) / r.height) * 8);
    if (c < 0 || c > 7 || row < 0 || row > 7) return null;
    const file = flip ? 7 - c : c;
    const rank = flip ? row + 1 : 8 - row;
    return `${FILES[file]}${rank}` as Square;
  }

  function attempt(from: Square, to: Square, viaDrag: boolean) {
    if (from === to) return false;
    if (myTurn) {
      const move = chess.moves({ square: from, verbose: true }).find((m) => m.to === to);
      if (!move) return false;
      if (viaDrag) skipSlide.current = to;
      if (move.promotion) setPromo({ from, to });
      else onMove(from, to);
      return true;
    }
    if (playerColor && premoveTargets(fen, from, playerColor).has(to)) {
      setPremove({ from, to });
      onPremoveSet?.();
      return true;
    }
    return false;
  }

  function onPointerDown(e: React.PointerEvent) {
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (e.button === 2) {
      setRdrag({ from: sq, to: sq, color: colorFor(e) });
      return;
    }
    if (e.button !== 0) return;
    setArrows([]);
    setHighlights(new Map());
    if (selected && selected !== sq && attempt(selected, sq, false)) {
      setSelected(null);
      return;
    }
    if (isMine(sq)) {
      e.preventDefault();
      setSelected(sq);
      setDrag({ from: sq, x: e.clientX, y: e.clientY, moved: false });
    } else setSelected(null);
  }

  useEffect(() => {
    if (!drag && !rdrag) return;
    const move = (e: PointerEvent) => {
      if (drag) {
        const s = sway.current;
        const dt = Math.max(1, e.timeStamp - s.lastT);
        s.vx = s.vx * 0.6 + ((e.clientX - s.lastX) / dt) * 0.4; // px/ms, smoothed
        s.lastX = e.clientX;
        s.lastT = e.timeStamp;
        setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY, moved: true });
      }
      if (rdrag) {
        const sq = squareAt(e.clientX, e.clientY);
        if (sq) setRdrag((r) => r && { ...r, to: sq });
      }
    };
    const up = (e: PointerEvent) => {
      if (drag && e.button === 0) {
        const sq = squareAt(e.clientX, e.clientY);
        if (sq && sq !== drag.from && attempt(drag.from, sq, true)) setSelected(null);
        setDrag(null);
      }
      if (rdrag && e.button === 2) {
        const r = rdrag;
        if (r.from === r.to) {
          if (premove) setPremove(null);
          else
            setHighlights((h) => {
              const n = new Map(h);
              if (n.get(r.from) === r.color) n.delete(r.from);
              else n.set(r.from, r.color);
              return n;
            });
        } else {
          setArrows((a) => {
            const i = a.findIndex((x) => x.from === r.from && x.to === r.to);
            if (i >= 0 && a[i]!.color === r.color) return a.filter((_, j) => j !== i);
            return [...a.filter((_, j) => j !== i), r];
          });
        }
        setRdrag(null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  // ---- sway animation loop: tilt with cursor speed, spring back to upright ----
  useEffect(() => {
    if (!drag?.moved) return;
    const s = sway.current;
    s.lastX = drag.x;
    s.lastT = performance.now();
    s.vx = 0;
    s.rot = 0;
    let raf = 0;
    const tick = () => {
      // velocity decays when the cursor stops, so target eases back to 0
      s.vx *= 0.9;
      const target = Math.max(-15, Math.min(15, s.vx * 22));
      // springy approach: slight overshoot via underdamped lerp
      s.rot += (target - s.rot) * 0.16;
      if (swayEl.current) swayEl.current.style.transform = `rotate(${s.rot}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      s.rot = 0;
      if (swayEl.current) swayEl.current.style.transform = "";
    };
  }, [drag?.moved, drag]);

  // ---- coordinates helpers for arrows ----
  function center(sq: string): [number, number] {
    const f = FILES.indexOf(sq[0]!);
    const r = parseInt(sq[1]!, 10);
    const c = flip ? 7 - f : f;
    const row = flip ? r - 1 : 8 - r;
    return [c + 0.5, row + 0.5];
  }

  function arrowShape(a: { from: string; to: string }) {
    const [x1, y1] = center(a.from);
    const [x2, y2] = center(a.to);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const knight = (Math.abs(dx) === 1 && Math.abs(dy) === 2) || (Math.abs(dx) === 2 && Math.abs(dy) === 1);
    const head = 0.42;
    let pts: [number, number][];
    if (knight) {
      const corner: [number, number] = Math.abs(dx) === 2 ? [x2, y1] : [x1, y2];
      pts = [[x1, y1], corner, [x2, y2]];
    } else pts = [[x1, y1], [x2, y2]];
    const [px, py] = pts[pts.length - 2]!;
    const len = Math.hypot(x2 - px, y2 - py);
    const ux = (x2 - px) / len;
    const uy = (y2 - py) / len;
    const tip: [number, number] = [x2 - ux * 0.12, y2 - uy * 0.12];
    const base: [number, number] = [tip[0] - ux * head, tip[1] - uy * head];
    const start = pts[0]!;
    const sLen = Math.hypot(pts[1]![0] - start[0], pts[1]![1] - start[1]);
    const s: [number, number] = [
      start[0] + ((pts[1]![0] - start[0]) / sLen) * 0.3,
      start[1] + ((pts[1]![1] - start[1]) / sLen) * 0.3,
    ];
    const line = [s, ...pts.slice(1, -1), base].map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
    const w = 0.25;
    const headPts = [
      tip,
      [base[0] + -uy * w, base[1] + ux * w],
      [base[0] - -uy * w, base[1] - ux * w],
    ]
      .map((p) => p.join(","))
      .join(" ");
    return { line, headPts };
  }

  const ranks = flip ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flip ? FILES.split("").reverse() : FILES.split("");
  // No live preview: arrows only appear after the right button is released.
  const allArrows: Arrow[] = arrows;

  function slideStyle(from: string, to: string): React.CSSProperties {
    const [fx, fy] = center(from);
    const [tx, ty] = center(to);
    return { ["--dx" as string]: `${(fx - tx) * 100}%`, ["--dy" as string]: `${(fy - ty) * 100}%` };
  }

  return (
    <div
      ref={boardRef}
      onPointerDown={onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-md shadow-board"
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {ranks.map((r, ri) =>
          files.map((f, fi) => {
            const sq = `${f}${r}` as Square;
            const light = (FILES.indexOf(f) + r) % 2 === 1;
            const piece = chess.get(sq);
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isPre = premove && (premove.from === sq || premove.to === sq);
            const target = targets.get(sq);
            const hl = highlights.get(sq);
            const dragging = drag?.moved && drag.from === sq;
            const isMover = anim && anim.to === sq;
            const isRook = anim?.rook && anim.rook.to === sq;
            const cap = anim?.captured && anim.captured.sq === sq ? anim.captured : null;
            return (
              <div key={sq} className={`relative flex items-center justify-center ${light ? "bg-square-light" : "bg-square-dark"}`}>
                {isLast && <div className="absolute inset-0 bg-square-last" />}
                {selected === sq && <div className="absolute inset-0 bg-square-last" />}
                {isPre && <div className="absolute inset-0 bg-square-premove" />}
                {hl && <div className={`absolute inset-0 hl-${hl}`} />}
                {checkSquare === sq && <div className="check-glow absolute inset-0" />}
                {fi === 0 && (
                  <span className={`absolute left-0.5 top-0 text-[10px] font-bold sm:text-xs ${light ? "text-square-dark" : "text-square-light"}`}>{r}</span>
                )}
                {ri === 7 && (
                  <span className={`absolute bottom-0 right-1 text-[10px] font-bold sm:text-xs ${light ? "text-square-dark" : "text-square-light"}`}>{f}</span>
                )}
                {cap && (
                  <div key={`cap-${fen}`} className="piece-vanish pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <Piece type={cap.type} color={cap.color} className="h-[88%] w-[88%]" />
                  </div>
                )}
                {piece && (
                  <div
                    key={isMover || isRook ? `a-${fen}` : "p"}
                    style={
                      isMover && anim!.slide ? slideStyle(anim!.from, sq) : isRook ? slideStyle(anim!.rook!.from, sq) : undefined
                    }
                    className={`absolute inset-0 z-10 flex items-center justify-center ${
                      (isMover && anim!.slide) || isRook ? "piece-slide z-20" : ""
                    } ${dragging ? "opacity-30" : ""} ${isMine(sq) ? "cursor-grab" : ""}`}
                  >
                    <div className={`flex h-full w-full items-center justify-center ${isMover && (anim!.captured || anim!.promoted) ? "piece-pop" : ""}`}>
                      <Piece type={piece.type} color={piece.color} className="h-[88%] w-[88%]" />
                    </div>
                  </div>
                )}
                {target === false && <div className="absolute z-20 h-1/3 w-1/3 rounded-full bg-move-dot" />}
                {target === true && <div className="absolute inset-0 z-20 rounded-full border-[5px] border-move-dot" />}
              </div>
            );
          }),
        )}
      </div>

      <svg viewBox="0 0 8 8" className="pointer-events-none absolute inset-0 z-30 h-full w-full">
        {allArrows.map((a, i) => {
          const { line, headPts } = arrowShape(a);
          return (
            <g key={`${a.from}->${a.to}-${i}`} opacity={0.55} className={`arrow-${a.color}`}>
              <path d={line} fill="none" strokeWidth={0.18} strokeLinejoin="round" strokeLinecap="butt" />
              <polygon points={headPts} stroke="none" />
            </g>
          );
        })}
      </svg>

      {drag?.moved && boardRef.current && (() => {
        const p = chess.get(drag.from);
        const rect = boardRef.current.getBoundingClientRect();
        const size = rect.width / 8;
        if (!p) return null;
        return (
          <div
            ref={swayEl}
            className="pointer-events-none fixed z-50"
            style={{ left: drag.x - (size * 1.1) / 2, top: drag.y - (size * 1.1) / 2, width: size * 1.1, height: size * 1.1, transformOrigin: "50% 15%" }}
          >
            <Piece type={p.type} color={p.color} className="h-[88%] w-[88%] translate-x-[6%] translate-y-[6%]" />
          </div>
        );
      })()}

      {promo && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70">
          <div className="flex gap-2 rounded-lg bg-card p-3">
            {["q", "r", "b", "n"].map((p) => (
              <button
                key={p}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  onMove(promo.from, promo.to, p);
                  setPromo(null);
                }}
                className="flex h-16 w-16 items-center justify-center rounded bg-square-light hover:bg-square-last"
              >
                <Piece type={p} color={playerColor ?? "w"} className="h-12 w-12" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
