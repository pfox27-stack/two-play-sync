import { useState } from 'react';
import { Chess } from 'chess.js';
import { Settings, RotateCcw, Play } from 'lucide-react';
import { ChessBoard } from './ChessBoard';
import { Piece } from './Pieces';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { BOARDS, DEFAULTS, PRESETS, SETS, useAppearance, type Animation } from '@/lib/appearance';

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="flex items-center justify-between gap-3 text-sm">{label}<input aria-label={label} type="color" value={value} onChange={e => onChange(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-input bg-secondary p-1" /></label>;
}
function Range({ label, value, max, unit = '', onChange }: { label: string; value: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return <label className="grid gap-2 text-sm"><span className="flex justify-between"><span>{label}</span><span className="text-muted-foreground">{value}{unit}</span></span><input aria-label={label} type="range" min="0" max={max} step={max === 8 ? .1 : 1} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-primary" /></label>;
}
export function AppearanceSettings() {
  const { settings: s, update } = useAppearance();
  const [fen, setFen] = useState(new Chess().fen());
  const [replay, setReplay] = useState(0);
  const [moved, setMoved] = useState(false);
  const [tab, setTab] = useState('animations');
  function play() { setMoved(false); setFen(new Chess().fen()); setReplay(n => n + 1); setTimeout(() => { const c = new Chess(); c.move('e4'); setFen(c.fen()); setMoved(true); }, 80); }
  const fine = (patch: Partial<Animation>) => update({ preset: 'Custom', animation: { ...s.animation, ...patch } });
  const selectClass = 'h-9 w-full rounded-md border border-input bg-secondary px-2 text-sm';
  return <Dialog><DialogTrigger asChild><Button variant="secondary" size="icon" aria-label="Settings" title="Settings" className="fixed right-3 top-3 z-40"><Settings className="size-5" /></Button></DialogTrigger>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"><DialogTitle>Settings</DialogTitle>
      <Tabs value={tab} onValueChange={setTab}><TabsList className="w-full"><TabsTrigger value="animations">Animations</TabsTrigger><TabsTrigger value="board">Board</TabsTrigger><TabsTrigger value="pieces">Pieces</TabsTrigger></TabsList>
      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3"><ChessBoard key={replay} fen={fen} orientation="white" playerColor={null} active={false} lastMove={moved ? { from: 'e2', to: 'e4' } : null} onMove={() => {}} /><Button variant="outline" className="w-full" onClick={play}><Play className="size-4" />Replay move</Button></div>
        <div className="min-w-0">
          <TabsContent value="animations" className="mt-0 space-y-4">
            <label className="grid gap-2 text-sm">Preset<select aria-label="Animation preset" className={selectClass} value={s.preset} onChange={e => { const a = PRESETS[e.target.value]; if (a) { update({ preset: e.target.value, animation: { ...a } }); play(); } }}>{Object.keys(PRESETS).map(p => <option key={p}>{p}</option>)}{s.preset === 'Custom' && <option>Custom</option>}</select></label>
            <Range label="Slide duration" value={s.animation.duration} max={600} unit="ms" onChange={duration => fine({ duration })} />
            <Range label="Blur amount" value={s.animation.blur} max={8} unit="px" onChange={blur => fine({ blur })} />
            <label className="grid gap-2 text-sm">Easing<select aria-label="Easing" className={selectClass} value={s.animation.easing} onChange={e => fine({ easing: e.target.value })}>{['ease-out','ease-in-out','linear','spring', ...(s.animation.easing === 'fade' ? ['fade'] : [])].map(e => <option key={e}>{e}</option>)}</select></label>
            <label className="grid gap-2 text-sm">Capture effect<select aria-label="Capture effect" className={selectClass} value={s.animation.capture} onChange={e => fine({ capture: e.target.value })}><option value="shrink">Shrink and blur</option><option value="pop">Pop</option><option value="fade">Fade</option><option value="none">None</option></select></label>
            <label className="grid gap-2 text-sm">Trail<select aria-label="Trail" className={selectClass} value={s.animation.trail} onChange={e => fine({ trail: e.target.value })}><option value="off">Off</option><option value="piece">Match piece color</option><option value="custom">Custom color</option></select></label>
            {s.animation.trail === 'custom' && <ColorInput label="Trail color" value={s.trailColor} onChange={trailColor => update({ trailColor, preset: 'Custom' })} />}
            <Range label="Trail thickness" value={s.animation.thickness} max={100} unit="%" onChange={thickness => fine({ thickness })} />
            <label className="flex items-center justify-between text-sm">Held-piece sway<input aria-label="Held-piece sway" type="checkbox" checked={s.animation.sway} onChange={e => fine({ sway: e.target.checked })} className="accent-primary" /></label>
            <Range label="Sway strength" value={s.animation.strength} max={100} unit="%" onChange={strength => fine({ strength })} />
          </TabsContent>
          <TabsContent value="board" className="mt-0 space-y-4"><div className="grid grid-cols-3 gap-2">{Object.entries(BOARDS).map(([name, colors]) => <Button key={name} variant={s.board === name ? 'default' : 'outline'} className="h-auto flex-col gap-2 px-1 py-2 text-xs" onClick={() => update({ board: name })}><span className="grid size-9 grid-cols-2 overflow-hidden rounded-sm">{[0,1,1,0].map((n,i) => <span key={i} style={{ background: colors[n === 0 ? 0 : 1] }} />)}</span>{name}</Button>)}<Button variant={s.board === 'Custom' ? 'default' : 'outline'} onClick={() => update({ board: 'Custom' })}>Custom</Button></div>{s.board === 'Custom' && <><ColorInput label="Light squares" value={s.light} onChange={light => update({ light })} /><ColorInput label="Dark squares" value={s.dark} onChange={dark => update({ dark })} /></>}</TabsContent>
          <TabsContent value="pieces" className="mt-0 space-y-3">{SETS.map(set => <Button key={set} variant={s.set === set ? 'default' : 'outline'} className="h-auto w-full flex-col gap-1 py-2" onClick={() => update({ set })}><span className="self-start text-xs">{set}</span><span className="flex w-full justify-between">{['k','q','r','b','n','p'].map(type => <Piece key={type} type={type} color="w" setOverride={set} className="size-8" />)}</span></Button>)}<ColorInput label="White pieces" value={s.white} onChange={white => update({ white })} /><ColorInput label="Black pieces" value={s.black} onChange={black => update({ black })} /></TabsContent>
        </div>
      </div></Tabs><Button variant="outline" onClick={() => update({ ...DEFAULTS, animation: { ...DEFAULTS.animation } })}><RotateCcw className="size-4" />Reset to defaults</Button>
    </DialogContent>
  </Dialog>;
}
