// Web Audio synthesized sounds — no audio files.
export type SoundKind = "move" | "capture" | "castle" | "check" | "premove" | "end";

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.7;

export function loadSoundSettings() {
  if (typeof window === "undefined") return { enabled, volume };
  enabled = localStorage.getItem("sound:on") !== "0";
  const v = parseFloat(localStorage.getItem("sound:vol") ?? "");
  if (!isNaN(v)) volume = v;
  return { enabled, volume };
}
export function setSoundEnabled(on: boolean) {
  enabled = on;
  localStorage.setItem("sound:on", on ? "1" : "0");
}
export function setSoundVolume(v: number) {
  volume = v;
  localStorage.setItem("sound:vol", String(v));
}

/** Call from a user gesture to satisfy autoplay rules. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function thump(c: AudioContext, t: number, freq: number, gain: number, dur: number, type: OscillatorType = "triangle") {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  g.gain.setValueAtTime(gain * volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function click(c: AudioContext, t: number, freq: number, gain: number, dur: number) {
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = gain * volume;
  src.connect(f).connect(g).connect(c.destination);
  src.start(t);
}

export function playSound(kind: SoundKind) {
  if (!enabled || !ctx || volume <= 0) return;
  const c = ctx;
  const t = c.currentTime + 0.005;
  const p = 1 + (Math.random() * 0.06 - 0.03);
  switch (kind) {
    case "move":
      thump(c, t, 180 * p, 0.5, 0.07);
      click(c, t, 2500 * p, 0.35, 0.02);
      break;
    case "capture":
      thump(c, t, 130 * p, 0.75, 0.09);
      click(c, t, 2200 * p, 0.6, 0.03);
      click(c, t + 0.04, 3000 * p, 0.25, 0.012);
      break;
    case "castle":
      thump(c, t, 180 * p, 0.45, 0.06);
      click(c, t, 2500 * p, 0.3, 0.02);
      thump(c, t + 0.09, 170 * p, 0.45, 0.06);
      click(c, t + 0.09, 2400 * p, 0.3, 0.02);
      break;
    case "check":
      thump(c, t, 180 * p, 0.45, 0.06);
      thump(c, t + 0.01, 880 * p, 0.18, 0.18, "sine");
      break;
    case "premove":
      click(c, t, 3200 * p, 0.12, 0.012);
      break;
    case "end":
      thump(c, t, 523 * p, 0.25, 0.25, "sine");
      thump(c, t + 0.15, 392 * p, 0.25, 0.35, "sine");
      break;
  }
}
