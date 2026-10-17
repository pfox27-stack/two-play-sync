import { useMemo } from "react";

const COLORS = ["#f5c542", "#7bc96f", "#5aa9e6", "#e86a6a", "#c792ea", "#f4f4f4"];

/** Small celebratory confetti rain, e.g. on checkmate. Renders once and cleans itself up. */
export function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        size: 5 + Math.random() * 6,
        color: COLORS[i % COLORS.length],
        dur: 2.4 + Math.random() * 1.8,
        delay: Math.random() * 0.9,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        round: Math.random() > 0.6,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              backgroundColor: p.color,
              borderRadius: p.round ? "50%" : "1px",
              "--dur": `${p.dur}s`,
              "--delay": `${p.delay}s`,
              "--spin": `${p.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
