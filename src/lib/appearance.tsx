import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';

export const BOARDS = {
  Green: ['#eef0cc', '#78a354'], Wood: ['#f0d9b5', '#b58863'], Ocean: ['#dee3e6', '#8ca2ad'],
  Midnight: ['#7c8aa5', '#3b4660'], Sand: ['#f3e5c6', '#c9a66b'], Rose: ['#f6e0e4', '#d78a9c'],
  Purple: ['#e8dff5', '#8b6bb5'], Slate: ['#d6d9de', '#6b7280'], Ice: ['#eaf4f8', '#7fb0c9'],
  Neon: ['#2a2d3e', '#14161f'], 'High Contrast': ['#f2f2f2', '#404040'],
} as const;
export type Animation = { duration: number; blur: number; easing: string; capture: string; trail: string; thickness: number; sway: boolean; strength: number };
const smooth: Animation = { duration: 200, blur: 0.8, easing: 'ease-out', capture: 'shrink', trail: 'off', thickness: 30, sway: true, strength: 100 };
export const PRESETS: Record<string, Animation> = {
  Smooth: smooth, Snappy: { ...smooth, duration: 110, blur: 0 }, Bouncy: { ...smooth, duration: 280, easing: 'spring' },
  'Slow Glide': { ...smooth, duration: 400, easing: 'ease-in-out' }, 'Motion Blur': { ...smooth, duration: 220, blur: 5 },
  'Comet Trail': { ...smooth, duration: 300, trail: 'piece' }, Fade: { ...smooth, blur: 0, easing: 'fade' }, Instant: { ...smooth, duration: 0, blur: 0 },
};
export const SETS = ['Flat', 'Classic', 'Outline', 'Silhouette', 'Pixel', 'Letters', 'Neon'] as const;
export type Appearance = { board: string; light: string; dark: string; set: string; white: string; black: string; trailColor: string; preset: string; animation: Animation };
export const DEFAULTS: Appearance = { board: 'Green', light: '#eef0cc', dark: '#78a354', set: 'Flat', white: '#fafafa', black: '#62615f', trailColor: '#85c9ed', preset: 'Smooth', animation: smooth };
const KEY = 'gambiteer:appearance';
const Context = createContext({ settings: DEFAULTS, update: (_patch: Partial<Appearance>) => {} });
export function appearanceStyle(s: Appearance): CSSProperties {
  const pair = BOARDS[s.board as keyof typeof BOARDS];
  const a = s.animation;
  return {
    '--square-light': pair?.[0] ?? s.light, '--square-dark': pair?.[1] ?? s.dark,
    '--square-last': s.board === 'Neon' ? 'oklch(0.85 0.14 195 / .55)' : 'oklch(0.88 0.14 105 / .65)',
    '--move-dot': s.board === 'Neon' || s.board === 'Midnight' ? 'oklch(1 0 0 / .4)' : 'oklch(0.2 0 0 / .28)',
    '--piece-light-color': s.white, '--piece-dark-color': s.black, '--trail-color': s.trailColor,
    '--move-duration': `${a.duration}ms`, '--move-blur': `${a.blur}px`,
    '--move-ease': a.easing === 'spring' ? 'cubic-bezier(.22,1.4,.4,1)' : a.easing === 'fade' ? 'ease-in-out' : a.easing,
    '--slide-name': a.easing === 'fade' ? 'piece-fade' : 'piece-slide',
    '--capture-name': ({ shrink: 'piece-vanish', pop: 'capture-pop', fade: 'capture-fade', none: 'capture-none' } as Record<string, string>)[a.capture],
    '--trail-scale': `${0.75 + a.thickness / 400}`,
  } as CSSProperties;
}
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULTS);
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); setSettings({ ...DEFAULTS, ...s, animation: { ...smooth, ...s.animation } }); } } catch { /* use defaults */ } }, []);
  function update(patch: Partial<Appearance>) { setSettings(old => { const next = { ...old, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ } return next; }); }
  return <Context.Provider value={{ settings, update }}><div style={appearanceStyle(settings)} className="contents">{children}</div></Context.Provider>;
}
export const useAppearance = () => useContext(Context);
