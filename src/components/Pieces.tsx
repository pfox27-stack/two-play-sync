// Classic piece set (chess.com style) — solid fill + thin outline, shared 45x45 viewBox.
// Shapes: rounded pawn with collar, crenellated rook, horse-head knight,
// slit bishop with ball top, five-point crown queen, cross-topped king.
const PATHS: Record<string, string[]> = {
  // pawn: round head, small collar, flared body, wide base
  p: [
    "M22.5 8.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10z",
    "M17 20.5c1.8 1.2 3.4 1.8 5.5 1.8s3.7-.6 5.5-1.8l1.5 2.5c-2.2 1.4-4.4 2-7 2s-4.8-.6-7-2z",
    "M18.5 25.5c-2.5 3-4.5 6.5-4.5 10.5h17c0-4-2-7.5-4.5-10.5-1.2.6-2.6 1-4 1s-2.8-.4-4-1z",
    "M12.5 36h20v3.5h-20z",
  ],
  // rook: crenellated top, slightly tapered body, stepped base
  r: [
    "M11 11h4v3.5h4.5V11h6v3.5H30V11h4v9l-3.5 3H14.5L11 20z",
    "M15 23h15l1.5 10h-18z",
    "M12 33h21v3H12z",
    "M11 36h23v3.5H11z",
  ],
  // bishop: ball top, bulbous body with diagonal slit, collar, round base
  b: [
    "M22.5 5.5a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6z",
    "M22.5 11.5c4.5 2.5 7.5 6.5 7.5 11 0 3.5-2 6.5-5 8.5h-5c-3-2-5-5-5-8.5 0-4.5 3-8.5 7.5-11z",
    "M20.5 15.5l5 7",
    "M17.5 31h10l1.5 3h-13z",
    "M14 34h17c1 0 2 1 2 2.5V38H12v-1.5c0-1.5 1-2.5 2-2.5z",
  ],
  // knight: horse head profile facing left, arched neck, stepped base
  n: [
    "M13.5 36.5h20v-3c0-7-1-13.5-4-17.5l1-5.5-3.5 2.5-2-3.5-2.5 4c-4.5 1-8.5 5.5-10 11l3 2 3.5-2.5 4-2c-2.5 4.5-6 6.5-6.5 12.5z",
    "M16.5 15.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
  ],
  // queen: five-point crown with balls, wide body, stepped base
  q: [
    "M10.5 12a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM17.5 8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM27.5 8a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4zM34.5 12a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z",
    "M22.5 6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z",
    "M11 16.5l3 13c2-1.5 5-2.5 8.5-2.5s6.5 1 8.5 2.5l3-13-5 9-1.5-11-2.5 10h-5L17.5 14.5 16 25.5z",
    "M14 29.5c2.5-1.5 5.5-2 8.5-2s6 .5 8.5 2l1 3.5H13z",
    "M12 33h21v3H12z",
    "M11 36h23v3.5H11z",
  ],
  // king: cross on top, rounded crown body with flared sides, stepped base
  k: [
    "M21 4h3v3h3v3h-3v3h-3v-3h-3V7h3z",
    "M22.5 13.5c-1.5 0-2.5 1-2.5 2.5 0 1 .5 1.8 1.2 2.3-3.5.8-6.7 3-6.7 7.2 0 3 2 5 4 5.5l-1 3h10l-1-3c2-.5 4-2.5 4-5.5 0-4.2-3.2-6.4-6.7-7.2.7-.5 1.2-1.3 1.2-2.3 0-1.5-1-2.5-2.5-2.5z",
    "M16.5 34h12l1 2.5h-14z",
    "M11 36.5h23v3H11z",
  ],
};

export function Piece({ type, color, className = "" }: { type: string; color: "w" | "b"; className?: string }) {
  return (
    <svg viewBox="0 0 45 45" className={`${color === "w" ? "flat-white" : "flat-black"} ${className}`} aria-hidden>
      {(PATHS[type] ?? []).map((d, i) => (
        <path key={i} d={d} strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" fillRule="evenodd" />
      ))}
    </svg>
  );
}
