import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PRESETS, Theme } from './themes'
import { apiRequest, setAccessToken } from './lib/api'

export type Mode = 'light' | 'dark' | 'system'
export type Tx = { id: string; type: 'expense' | 'income'; amount: number; category: string; desc: string; date: string; method: string }
export type Note = { id: string; title: string; body: string; updatedAt: number; tags: string[] }
export type Sticky = { id: string; text: string; color: string; rot: number; pinned: boolean }
export type Goal = { id: string; name: string; target: number; saved: number }
export type Widget = { id: string; visible: boolean }
export interface UserProfile { id: string; email: string; displayName?: string | null; avatarUrl?: string | null }

export const CATEGORIES = ['Food', 'Groceries', 'Shopping', 'Travel', 'Entertainment', 'Education', 'Health', 'Bills', 'Subscriptions', 'Other']
export const uid = () => Math.random().toString(36).slice(2, 10)
export const dayAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
export const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const tx = (n: number, type: Tx['type'], amount: number, category: string, desc: string, method = 'UPI'): Tx => ({ id: uid(), type, amount, category, desc, date: dayAgo(n), method })
const seedTx: Tx[] = [
  tx(0, 'expense', 240, 'Food', 'Filter coffee & sandwich'), tx(0, 'expense', 1180, 'Groceries', 'Weekly vegetables', 'Card'),
  tx(1, 'expense', 499, 'Subscriptions', 'Music plan'), tx(2, 'expense', 650, 'Entertainment', 'Movie night'),
  tx(3, 'expense', 2200, 'Shopping', 'Notebook & pens set', 'Card'), tx(4, 'expense', 380, 'Food', 'Momos with friends'),
  tx(5, 'expense', 1500, 'Travel', 'Bus to Chandigarh', 'Cash'), tx(6, 'expense', 3200, 'Bills', 'Electricity & internet'),
  tx(8, 'expense', 899, 'Education', 'Design course'), tx(9, 'expense', 560, 'Health', 'Pharmacy'),
  tx(11, 'expense', 1320, 'Groceries', 'Pantry restock', 'Card'), tx(13, 'expense', 310, 'Food', 'Brunch'),
  tx(2, 'income', 42000, 'Salary', 'Monthly salary', 'Bank'), tx(7, 'income', 6500, 'Freelance', 'Logo project', 'Bank'),
]
const now = Date.now()
const seedNotes: Note[] = [
  { id: uid(), title: 'Weekend plans', body: 'Sunrise walk, bake banana bread, call Nani.', updatedAt: now - 3600e3, tags: ['life'] },
  { id: uid(), title: 'Book thoughts', body: 'Slow, warm stories read best with chai.', updatedAt: now - 86400e3, tags: ['reading'] },
  { id: uid(), title: 'Trip checklist', body: 'Charger, scarf, journal, the good pen.', updatedAt: now - 3 * 86400e3, tags: ['travel'] },
]
const seedStickies: Sticky[] = [
  { id: uid(), text: 'Water the plants 🌿', color: '#FFF3B0', rot: -3, pinned: true },
  { id: uid(), text: 'Call mom on Sunday', color: '#F9C6D4', rot: 2, pinned: true },
  { id: uid(), text: 'Ideas: tiny paper cranes', color: '#D8CCF7', rot: -1, pinned: true },
]
const seedGoals: Goal[] = [
  { id: uid(), name: 'Laptop fund', target: 80000, saved: 34000 }, { id: uid(), name: 'Emergency fund', target: 100000, saved: 52000 },
  { id: uid(), name: 'Travel fund', target: 40000, saved: 9000 }]

type State = {
  currentUser: UserProfile | null
  guestMode: boolean
  welcomed: boolean; themeId: string; mode: Mode; customThemes: Theme[]; sidebarCollapsed: boolean
  widgets: Widget[]; txs: Tx[]; notes: Note[]; stickies: Sticky[]; goals: Goal[]; budget: number
  toasts: { id: string; msg: string }[]
  set: (p: Partial<State>) => void
  addTx: (t: Omit<Tx, 'id'>) => void
  toast: (msg: string) => void
  moveWidget: (id: string, dir: -1 | 1) => void
  toggleWidget: (id: string) => void
  upsertTheme: (t: Theme) => void
  deleteTheme: (id: string) => void
  logout: () => Promise<void>
}

export const useStore = create<State>()(persist((set, get) => ({
  currentUser: null,
  guestMode: false,
  welcomed: false, themeId: 'original', mode: 'system', customThemes: [], sidebarCollapsed: false,
  widgets: ['spend', 'budget', 'income', 'savings', 'trend', 'notes', 'stickies', 'transactions'].map(id => ({ id, visible: true })),
  txs: seedTx, notes: seedNotes, stickies: seedStickies, goals: seedGoals, budget: 25000, toasts: [],
  set: p => {
    set(p)
    // Synchronize preferences if user is logged in
    if (get().currentUser && (p.themeId !== undefined || p.mode !== undefined || p.sidebarCollapsed !== undefined)) {
      apiRequest('/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          themeId: p.themeId,
          mode: p.mode,
          sidebarCollapsed: p.sidebarCollapsed,
        }),
      }).catch(() => {})
    }
  },
  addTx: t => set(s => ({ txs: [{ ...t, id: uid() }, ...s.txs] })),
  toast: msg => { const id = uid(); set(s => ({ toasts: [...s.toasts, { id, msg }] })); setTimeout(() => set(s => ({ toasts: s.toasts.filter(x => x.id !== id) })), 2600) },
  moveWidget: (id, dir) => { const w = [...get().widgets]; const i = w.findIndex(x => x.id === id), j = i + dir; if (j < 0 || j >= w.length) return; [w[i], w[j]] = [w[j], w[i]]; set({ widgets: w }) },
  toggleWidget: id => set(s => ({ widgets: s.widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w) })),
  upsertTheme: async t => {
    set(s => ({ customThemes: s.customThemes.some(c => c.id === t.id) ? s.customThemes.map(c => c.id === t.id ? t : c) : [...s.customThemes, t] }))
    if (get().currentUser) {
      try {
        await apiRequest('/themes', {
          method: 'POST',
          body: JSON.stringify({
            name: t.name,
            baseThemeId: t.baseId ?? null,
            light: t.light,
            dark: t.dark,
          }),
        })
      } catch {}
    }
  },
  deleteTheme: async id => {
    set(s => ({ customThemes: s.customThemes.filter(c => c.id !== id), themeId: s.themeId === id ? 'original' : s.themeId }))
    if (get().currentUser) {
      try {
        await apiRequest(`/themes/${id}`, { method: 'DELETE' })
      } catch {}
    }
  },
  logout: async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {}
    setAccessToken(null)
    set({ currentUser: null, guestMode: false, welcomed: false })
  },
}), { name: 'nimu-state-v1', partialize: s => ({ ...s, toasts: [] }) }))

export const useTheme = (): Theme => {
  const { themeId, customThemes } = useStore()
  return [...PRESETS, ...customThemes].find(t => t.id === themeId) ?? PRESETS[0]
}
