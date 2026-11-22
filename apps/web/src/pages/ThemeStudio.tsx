import { Copy, RotateCcw, Save, Trash2, Sun, Moon, Monitor, Plus, Wand2 } from 'lucide-react'
import { PRESETS, PALETTE_KEYS, Palette, Theme, makeDark } from '../themes'
import { useStore, useTheme, uid, Mode } from '../store'

export default function ThemeStudio() {
  const { themeId, mode, customThemes, set, upsertTheme, deleteTheme, toast } = useStore()
  const theme = useTheme()
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  const key = dark ? 'dark' : 'light'
  const clone = (t: Theme, name: string): Theme => ({ ...t, id: uid(), name, custom: true, baseId: t.baseId ?? t.id })
  const pick = (id: string) => set({ themeId: id })
  const change = (k: keyof Palette, v: string) => {
    const t = theme.custom ? theme : clone(theme, `My ${theme.name}`)
    upsertTheme({ ...t, [key]: { ...t[key], [k]: v } }); pick(t.id)
  }
  const reset = () => { const base = PRESETS.find(p => p.id === theme.baseId); if (!base) return toast('Presets are already pristine.'); upsertTheme({ ...theme, light: base.light, dark: base.dark }); toast('Back to the original.') }
  const dup = () => { const c = clone(theme, `${theme.name} copy`); upsertTheme(c); pick(c.id); toast('Duplicated. Make it yours.') }
  const create = () => { const c: Theme = { ...clone(theme, 'My new theme'), baseId: undefined }; upsertTheme(c); pick(c.id); toast('New theme created. Make it yours.') }
  const autoDark = () => { upsertTheme({ ...theme, dark: makeDark(theme.light) }); toast('Dark palette refreshed from your light colors.') }
  const modes: { id: Mode; icon: typeof Sun; label: string }[] = [{ id: 'light', icon: Sun, label: 'Light' }, { id: 'dark', icon: Moon, label: 'Dark' }, { id: 'system', icon: Monitor, label: 'System' }]
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="text-lg font-extrabold">Appearance</h2>
        <div className="mt-3 inline-flex rounded-2xl bg-primary/10 p-1">{modes.map(m => <button key={m.id} onClick={() => set({ mode: m.id })} className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-bold ${mode === m.id ? 'bg-surface shadow-soft' : 'opacity-70'}`}><m.icon size={15} />{m.label}</button>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <button onClick={create} className="grid place-items-center rounded-2xl border-2 border-dashed p-2 text-sm font-bold text-primary transition hover:bg-primary/10"><span className="flex items-center gap-1"><Plus size={16} />Create your own</span></button>
          {[...PRESETS, ...customThemes].map(t => <button key={t.id} onClick={() => pick(t.id)} className={`rounded-2xl border p-2 text-left ${themeId === t.id ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex h-8 overflow-hidden rounded-xl">{[t[key].bg, t[key].primary, t[key].secondary, t[key].accent].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
            <span className="mt-1 block truncate text-xs font-bold">{t.name}{t.custom && ' ✎'}</span></button>)}
        </div>
      </section>
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">Theme Studio</h2>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-ghost" onClick={create}><Plus size={15} />New theme</button>
            {theme.custom && <button className="btn btn-ghost" onClick={autoDark}><Wand2 size={15} />Auto dark</button>}
            <button className="btn btn-ghost" onClick={dup}><Copy size={15} />Duplicate</button>
            <button className="btn btn-ghost" onClick={reset}><RotateCcw size={15} />Reset</button>
            {theme.custom && <button className="btn btn-ghost" onClick={() => { deleteTheme(theme.id); toast('Theme removed.') }}><Trash2 size={15} />Delete</button>}
            <button className="btn btn-primary" onClick={() => toast('Safely tucked away.')}><Save size={15} />Save</button></div></div>
        {theme.custom && <input className="input mt-3 max-w-xs" aria-label="Theme name" value={theme.name} onChange={e => upsertTheme({ ...theme, name: e.target.value })} />}
        <p className="mt-2 text-sm opacity-70">Editing the {key} palette. Changes apply to the whole app instantly and save automatically.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {PALETTE_KEYS.map(({ key: k, label }) => <label key={k} className="flex items-center gap-3 rounded-2xl border p-2">
            <input type="color" value={theme[key][k]} onChange={e => change(k, e.target.value)} className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent" />
            <span className="text-sm font-bold">{label}<br /><span className="font-mono text-xs font-normal opacity-60">{theme[key][k]}</span></span></label>)}
        </div>
        <div className="mt-5 rounded-3xl border bg-canvas p-4"><p className="text-xs font-bold opacity-60">Live preview</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><button className="btn btn-primary">Primary</button><button className="btn bg-secondary text-white">Secondary</button><button className="btn bg-accent text-white">Accent</button>
            <div className="card px-4 py-2 text-sm">A card on a surface</div></div></div>
      </section>
    </div>)
}
