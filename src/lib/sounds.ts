// Chess sound effects (uploaded audio files served from the CDN).
import moveSelf from "@/assets/sounds/move-self.mp3.asset.json";
import moveOpp from "@/assets/sounds/move-opponent.mp3.asset.json";
import capture from "@/assets/sounds/capture.mp3.asset.json";
import castle from "@/assets/sounds/castle.mp3.asset.json";
import check from "@/assets/sounds/move-check.mp3.asset.json";
import premove from "@/assets/sounds/premove.mp3.asset.json";
import promote from "@/assets/sounds/promote.mp3.asset.json";
import end from "@/assets/sounds/game-end.mp3.asset.json";

export type SoundKind = "move" | "move-opponent" | "capture" | "castle" | "check" | "premove" | "promote" | "end";
const URLS: Record<SoundKind, string> = {
  move: moveSelf.url, "move-opponent": moveOpp.url, capture: capture.url, castle: castle.url,
  check: check.url, premove: premove.url, promote: promote.url, end: end.url,
};

let enabled = true;
let volume = 0.7;
const cache = new Map<SoundKind, HTMLAudioElement>();

export function loadSoundSettings() {
  if (typeof window === "undefined") return { enabled, volume };
  enabled = localStorage.getItem("sound:on") !== "0";
  const v = parseFloat(localStorage.getItem("sound:vol") ?? "");
  if (!isNaN(v)) volume = v;
  return { enabled, volume };
}
export function setSoundEnabled(on: boolean) { enabled = on; localStorage.setItem("sound:on", on ? "1" : "0"); }
export function setSoundVolume(v: number) { volume = v; localStorage.setItem("sound:vol", String(v)); }

function get(kind: SoundKind) {
  let a = cache.get(kind);
  if (!a) { a = new Audio(URLS[kind]); a.preload = "auto"; cache.set(kind, a); }
  return a;
}
/** Preload all sounds (call from a user gesture to satisfy autoplay rules). */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  (Object.keys(URLS) as SoundKind[]).forEach(get);
}
export function playSound(kind: SoundKind) {
  if (typeof window === "undefined" || !enabled || volume <= 0) return;
  const a = get(kind).cloneNode(true) as HTMLAudioElement;
  a.volume = volume;
  void a.play().catch(() => {});
}
