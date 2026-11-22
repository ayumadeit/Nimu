import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, StickyNote, NotebookPen, Brush, Wallet, PiggyBank, Target, BarChart3, Settings as Cog, PanelLeftClose, PanelLeft, Menu, LogOut, Palette } from 'lucide-react'
import { useStore, useTheme } from './store'
import { applyPalette } from './themes'
import Welcome from './pages/Welcome'
import Dashboard from './pages/Dashboard'
import ThemeStudio from './pages/ThemeStudio'
import Login from './pages/Login'
import Register from './pages/Register'

const NAV = [
  { id: 'home', label: 'Home', icon: Home }, { id: 'notes', label: 'My Notes', icon: NotebookPen },
  { id: 'sticky', label: 'Sticky Board', icon: StickyNote }, { id: 'draw', label: 'Drawing Canvas', icon: Brush },
  { id: 'finance', label: 'Finance', icon: Wallet }, { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'goals', label: 'Savings Goals', icon: Target }, { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Cog },
]
export type Go = (page: string) => void

function useApplyTheme() {
  const theme = useTheme(); const mode = useStore(s => s.mode)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const run = () => { const dark = mode === 'dark' || (mode === 'system' && mq.matches); applyPalette(dark ? theme.dark : theme.light, dark) }
    run(); mq.addEventListener('change', run); return () => mq.removeEventListener('change', run)
  }, [theme, mode])
}

function Coming({ page }: { page: typeof NAV[number] }) {
  const Icon = page.icon
  return <div className="card mx-auto mt-10 max-w-md p-10 text-center">
    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-primary/15 text-primary"><Icon size={30} /></div>
    <h2 className="text-xl font-extrabold">{page.label}</h2>
    <p className="mt-2 text-sm opacity-70">This room is still being furnished. It arrives in the next phase.</p>
  </div>
}

export default function App() {
  useApplyTheme()
  const { welcomed, sidebarCollapsed, set, toasts, currentUser, guestMode, logout } = useStore()
  const theme = useTheme()
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [page, setPage] = useState(() => location.hash.slice(1) || 'home')
  const [drawer, setDrawer] = useState(false)
  const go: Go = p => { setPage(p); location.hash = p; setDrawer(false) }

  useEffect(() => {
    const h = () => setPage(location.hash.slice(1) || 'home')
    addEventListener('hashchange', h)
    return () => removeEventListener('hashchange', h)
  }, [])

  // 1. Unauthenticated users see Login or Register
  if (!currentUser && !guestMode) {
    if (authView === 'login') {
      return (
        <Login
          onSwitchToRegister={() => setAuthView('register')}
          onGuestContinue={() => set({ guestMode: true, welcomed: true })}
        />
      )
    }
    return (
      <Register
        onSwitchToLogin={() => setAuthView('login')}
        onGuestContinue={() => set({ guestMode: true, welcomed: true })}
      />
    )
  }

  // 2. Authenticated users with no onboarding go to Welcome screen
  if (!welcomed) return <Welcome />

  const cur = NAV.find(n => n.id === page) ?? NAV[0]
  const sidebar = (collapsed: boolean) => (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <img src="/nimu-logo.png" alt="Nimu" className="h-10 w-10 rounded-xl" />
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-xl font-extrabold tracking-tight">Nimu</span>
            {currentUser && <span className="text-[11px] font-medium opacity-60 truncate max-w-[140px]">{currentUser.displayName || currentUser.email}</span>}
          </div>
        )}
      </div>
      {NAV.map(n => {
        const on = n.id === cur.id
        return (
          <button
            key={n.id}
            onClick={() => go(n.id)}
            title={n.label}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition ${on ? 'bg-primary text-white shadow-soft' : 'hover:bg-primary/10'} ${collapsed ? 'justify-center' : ''}`}
          >
            <n.icon size={18} />{!collapsed && n.label}
          </button>
        )
      })}
      <div className="mt-auto flex flex-col gap-1.5">
        <button
          onClick={() => go('settings')}
          className={`flex w-full items-center gap-2 rounded-2xl bg-secondary/15 px-3 py-2.5 text-left text-xs font-bold ${collapsed ? 'justify-center' : ''}`}
        >
          <Palette size={16} />{!collapsed && <span>{theme.name}<br /><span className="font-normal opacity-60">Theme settings</span></span>}
        </button>
        {currentUser && (
          <button
            onClick={() => logout()}
            title="Log out"
            className={`flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-accent hover:bg-accent/10 ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={16} />{!collapsed && <span>Log out</span>}
          </button>
        )}
      </div>
    </nav>
  )

  return (
    <div className="flex h-[100dvh]">
      <aside className={`hidden shrink-0 border-r bg-surface transition-all md:block ${sidebarCollapsed ? 'w-[76px]' : 'w-60'}`}>
        {sidebar(sidebarCollapsed)}
      </aside>
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setDrawer(false)} />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} className="fixed inset-y-0 left-0 z-50 w-60 bg-surface shadow-lift md:hidden">{sidebar(false)}</motion.aside>
          </>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-surface/70 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <img src="/nimu-logo.png" alt="" className="h-8 w-8 rounded-lg md:hidden" />
          <button className="btn btn-ghost hidden !p-2 md:inline-flex" aria-label="Toggle sidebar" onClick={() => set({ sidebarCollapsed: !sidebarCollapsed })}>
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <h1 className="text-lg font-extrabold">{cur.label}</h1>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 md:p-8">
          <div className="mx-auto max-w-6xl">
            {cur.id === 'home' ? <Dashboard go={go} /> : cur.id === 'settings' ? <ThemeStudio /> : <Coming page={cur} />}
          </div>
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Main">
        {['home', 'notes', 'sticky', 'finance'].map(id => {
          const n = NAV.find(x => x.id === id)!
          const on = cur.id === id
          return (
            <button key={id} onClick={() => go(id)} aria-current={on ? 'page' : undefined} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${on ? 'text-primary' : 'opacity-60'}`}>
              <n.icon size={20} />{n.label.replace('My ', '').replace(' Board', '')}
            </button>
          )
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-bold opacity-60"><Menu size={20} />More</button>
      </nav>
      <div className="pointer-events-none fixed bottom-24 left-1/2 md:bottom-4 z-[60] flex -translate-x-1/2 flex-col gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="rounded-2xl bg-ink px-4 py-2 text-sm font-bold text-canvas shadow-lift">
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
