import { motion } from 'framer-motion'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { PRESETS, Theme } from '../themes'
import { useStore, Mode, uid } from '../store'

export default function Welcome() {
  const { themeId, mode, set, customThemes, upsertTheme } = useStore()
  const makeOwn = () => {
    const base = [...PRESETS, ...customThemes].find(t => t.id === themeId) ?? PRESETS[0]
    const c: Theme = { ...base, id: uid(), name: 'My theme', custom: true, baseId: undefined }
    upsertTheme(c); set({ themeId: c.id, welcomed: true }); location.hash = 'settings'
  }
  const modes: { id: Mode; icon: typeof Sun; label: string }[] = [{ id: 'light', icon: Sun, label: 'Light' }, { id: 'dark', icon: Moon, label: 'Dark' }, { id: 'system', icon: Monitor, label: 'System' }]
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-center">
      <motion.img initial={{ scale: 0.8, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        src="/nimu-logo.png" alt="Nimu logo" className="h-32 w-32 rounded-[2rem] shadow-lift" />
      <h1 className="mt-6 text-4xl font-extrabold tracking-tight">Welcome to Nimu</h1>
      <p className="font-hand mt-1 text-2xl opacity-80">Your little space for everything.</p>
      <p className="mt-8 text-sm font-bold">Pick a look. You can change it anytime.</p>
      <div className="mt-4 grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-5">
        {[...PRESETS, ...customThemes].map(t => (
          <button key={t.id} onClick={() => set({ themeId: t.id })} aria-pressed={themeId === t.id}
            className={`card relative p-3 text-left transition hover:-translate-y-0.5 ${themeId === t.id ? 'ring-2 ring-primary' : ''}`}>
            <div className="flex h-9 overflow-hidden rounded-xl">{[t.light.bg, t.light.primary, t.light.secondary, t.light.accent].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
            <span className="mt-2 block text-xs font-bold">{t.name}</span>
            {themeId === t.id && <Check size={14} className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-white" />}
          </button>))}
      </div>
      <div className="mt-6 inline-flex rounded-2xl bg-primary/10 p-1">
        {modes.map(m => <button key={m.id} onClick={() => set({ mode: m.id })} className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-sm font-bold transition ${mode === m.id ? 'bg-surface shadow-soft' : 'opacity-70'}`}><m.icon size={15} />{m.label}</button>)}
      </div>
      <button className="btn btn-ghost mt-6" onClick={makeOwn}>Or design your own theme</button>
      <button className="btn btn-primary mt-3 !px-8 !py-3 text-base" onClick={() => set({ welcomed: true })}>Enter Nimu</button>
    </div>
  )
}
