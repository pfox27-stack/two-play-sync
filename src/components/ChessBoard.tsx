import { useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";

const GLYPH: Record<string, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const FILES = "abcdefgh";

type Props = {
  fen: string;
  orientation: "white" | "black";
  canMove: boolean;
  lastMove?: { from: string; to: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
};

export function ChessBoard({ fen, orientation, canMove, lastMove, onMove }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promo, setPromo] = useState<{ from: Square; to: Square } | null>(null);
  const [dragFrom, setDragFrom] = useState<Square | null>(null);

  const targets = useMemo(() => {
    const src = selected ?? dragFrom;
    if (!src) return new Map<string, boolean>();
    return new Map(chess.moves({ square: src, verbose: true }).map((m) => [m.to, !!m.captured]));
  }, [chess, selected, dragFrom]);

  const myColor = orientation === "white" ? "w" : "b";
  const checkSquare = chess.inCheck()
    ? chess.board().flat().find((p) => p && p.type === "k" && p.color === chess.turn())?.square
    : undefined;

  function tryMove(from: Square, to: Square) {
    const move = chess.moves({ square: from, verbose: true }).find((m) => m.to === to);
    if (!move) return false;
    if (move.promotion) setPromo({ from, to });
    else onMove(from, to);
    setSelected(null);
    return true;
  }

  function isMine(sq: Square) {
    const p = chess.get(sq);
    return canMove && p && p.color === myColor && chess.turn() === myColor;
  }

  function clickSquare(sq: Square) {
    if (selected && tryMove(selected, sq)) return;
    setSelected(isMine(sq) ? sq : null);
  }

  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES.split("") : FILES.split("").reverse();

  return (
    <div className="relative aspect-square w-full select-none overflow-hidden rounded-md shadow-board">
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {ranks.map((r, ri) =>
          files.map((f, fi) => {
            const sq = `${f}${r}` as Square;
            const light = (FILES.indexOf(f) + r) % 2 === 1;
            const piece = chess.get(sq);
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const target = targets.get(sq);
            return (
              <div
                key={sq}
                onClick={() => clickSquare(sq)}
                onDragOver={(e) => targets.has(sq) && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom) tryMove(dragFrom, sq);
                  setDragFrom(null);
                }}
                className={`relative flex items-center justify-center ${light ? "bg-square-light" : "bg-square-dark"}`}
              >
                {isLast && <div className="absolute inset-0 bg-square-last" />}
                {selected === sq && <div className="absolute inset-0 bg-square-last" />}
                {checkSquare === sq && <div className="check-glow absolute inset-0" />}
                {fi === 0 && (
                  <span className={`absolute left-0.5 top-0 text-[10px] font-bold sm:text-xs ${light ? "text-square-dark" : "text-square-light"}`}>{r}</span>
                )}
                {ri === 7 && (
                  <span className={`absolute bottom-0 right-1 text-[10px] font-bold sm:text-xs ${light ? "text-square-dark" : "text-square-light"}`}>{f}</span>
                )}
                {piece && (
                  <span
                    draggable={!!isMine(sq)}
                    onDragStart={() => {
                      setDragFrom(sq);
                      setSelected(sq);
                    }}
                    onDragEnd={() => setDragFrom(null)}
                    className={`relative z-10 text-[8.5vw] leading-none transition-transform duration-150 sm:text-[3.4rem] md:text-[4rem] ${
                      piece.color === "w" ? "piece-white" : "piece-black"
                    } ${isMine(sq) ? "cursor-grab active:cursor-grabbing" : ""}`}
                  >
                    {GLYPH[piece.type]}
                  </span>
                )}
                {target === false && <div className="absolute z-20 h-1/3 w-1/3 rounded-full bg-move-dot" />}
                {target === true && <div className="absolute inset-0 z-20 rounded-full border-[5px] border-move-dot" />}
              </div>
            );
          }),
        )}
      </div>
      {promo && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/70">
          <div className="flex gap-2 rounded-lg bg-card p-3">
            {["q", "r", "b", "n"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  onMove(promo.from, promo.to, p);
                  setPromo(null);
                }}
                className={`flex h-16 w-16 items-center justify-center rounded bg-square-light text-5xl hover:bg-square-last ${myColor === "w" ? "piece-white" : "piece-black"}`}
              >
                {GLYPH[p]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
