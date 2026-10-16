// Flat, minimal piece set — solid fill + thin outline, shared 45x45 viewBox.
const PATHS: Record<string, string[]> = {
  p: ["M22.5 9a4 4 0 0 0-3.2 6.4A6 6 0 0 0 17 25c-3 1.5-5 5-5 11h21c0-6-2-9.5-5-11a6 6 0 0 0-2.3-9.6A4 4 0 0 0 22.5 9z"],
  r: ["M11 37h23v-4H11z", "M13.5 33l1.5-14h15l1.5 14z", "M12 19v-8h4v3h4v-3h5v3h4v-3h4v8z"],
  b: [
    "M14 37h17v-3H14z",
    "M16 34c0-3 2-4 3-5-3-2-5-5-5-9 0-4 4-8 8.5-11 4.5 3 8.5 7 8.5 11 0 4-2 7-5 9 1 1 3 2 3 5z",
    "M22.5 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  ],
  n: ["M13 37h21c0-9-1-18-6-22l1-6-4 3-2-3-2 4c-5 1-10 7-11 14l3 2 4-3 4-2c-3 5-7 7-8 13z"],
  q: [
    "M11 37h23v-4H11z",
    "M12 33l-3-17 7 8 2-13 4.5 12 4.5-12 2 13 7-8-3 17z",
    "M9 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM18 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM27 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM36 13a2 2 0 1 1 0 4 2 2 0 0 1 0-4z",
  ],
  k: [
    "M11 37h23v-4H11z",
    "M12 33l-1-4c-3-3-4-7-2-10 3-4 9-3 13.5 2 4.5-5 10.5-6 13.5-2 2 3 1 7-2 10l-1 4z",
    "M21 5h3v3h3v3h-3v6h-3v-6h-3V8h3z",
  ],
};

export function Piece({ type, color, className = "" }: { type: string; color: "w" | "b"; className?: string }) {
  return (
    <svg viewBox="0 0 45 45" className={`${color === "w" ? "flat-white" : "flat-black"} ${className}`} aria-hidden>
      {(PATHS[type] ?? []).map((d, i) => (
        <path key={i} d={d} strokeWidth={1.5} strokeLinejoin="round" />
      ))}
    </svg>
  );
}
