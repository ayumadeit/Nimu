import { useMemo, useState, useEffect } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, FilePlus2, MinusCircle, PlusCircle, StickyNote, Brush, SlidersHorizontal, X } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useStore, useTheme, inr, dayAgo, CATEGORIES } from '../store'
import { apiRequest } from '../lib/api'
import type { Go } from '../App'

const QUOTES = ['Small steps, soft landings.', 'Write it down, let it go.', 'A tidy desk, a calmer mind.', 'Make a little room for joy.', 'Done is a lovely feeling.']
const TITLES: Record<string, string> = { spend: 'Spent this month', budget: 'Budget left', income: 'Income', savings: 'Savings progress', trend: 'Spending, last 14 days', notes: 'Recently edited', stickies: 'Pinned stickies', transactions: 'Recent transactions' }
const WIDE = ['trend', 'notes', 'stickies', 'transactions']

export default function Dashboard({ go }: { go: Go }) {
  const { txs, notes, stickies, goals, budget, widgets, moveWidget, toggleWidget, addTx, toast, currentUser } = useStore()
  const pal = useTheme()
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState<null | 'expense' | 'income'>(null)
  const [dashboardData, setDashboardData] = useState<any | null>(null)

  useEffect(() => {
    if (currentUser) {
      apiRequest('/dashboard')
        .then(data => setDashboardData(data))
        .catch(() => {})
    }
  }, [currentUser])

  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const month = new Date().toISOString().slice(0, 7)
  const localM = useMemo(() => {
    const mt = txs.filter(t => t.date.startsWith(month))
    const spent = mt.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    const income = mt.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)
    const trend = Array.from({ length: 14 }, (_, i) => { const d = dayAgo(13 - i); return { d: d.slice(5), v: txs.filter(t => t.type === 'expense' && t.date === d).reduce((a, t) => a + t.amount, 0) } })
    return { spent, income, trend }
  }, [txs, month])

  const spentVal = dashboardData ? dashboardData.summary.spentMinor / 100 : localM.spent
  const incomeVal = dashboardData ? dashboardData.summary.incomeMinor / 100 : localM.income
  const budgetLimit = dashboardData ? dashboardData.summary.budgetLimitMinor / 100 : budget
  const budgetLeft = dashboardData ? dashboardData.summary.budgetLeftMinor / 100 : Math.max(0, budget - localM.spent)
  const budgetPct = dashboardData ? dashboardData.summary.budgetUtilizationPercent : Math.min(100, Math.round((localM.spent / budget) * 100))

  const trendData = dashboardData
    ? dashboardData.spendTrend.map((t: any) => ({ d: t.d, v: t.amountMinor / 100 }))
    : localM.trend

  const notesList = dashboardData ? dashboardData.recentNotes : [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  const stickiesList = dashboardData ? dashboardData.pinnedStickies : stickies.filter(s => s.pinned)
  const txList = dashboardData
    ? dashboardData.recentTransactions.map((t: any) => ({
        id: t.id,
        desc: t.description,
        category: t.category,
        date: t.date,
        type: t.type,
        amount: t.amountMinor / 100,
      }))
    : txs.slice(0, 5)

  const savedTotal = dashboardData
    ? dashboardData.summary.savingsTotalMinor / 100
    : goals.reduce((a, g) => a + g.saved, 0)
  const targetTotal = dashboardData
    ? dashboardData.summary.savingsTargetMinor / 100
    : goals.reduce((a, g) => a + g.target, 0)
  const savingsPct = targetTotal > 0 ? Math.round((savedTotal / targetTotal) * 100) : 0

  const Stat = ({ v, sub, tint }: { v: string; sub: string; tint: string }) => <><p className="text-xl font-extrabold md:text-2xl" style={{ color: tint }}>{v}</p><p className="text-xs opacity-60">{sub}</p></>
  const body: Record<string, JSX.Element> = {
    spend: <Stat v={inr(spentVal)} sub={`${budgetPct}% of budget`} tint="rgb(var(--primary))" />,
    budget: <><Stat v={inr(budgetLeft)} sub={`of ${inr(budgetLimit)}`} tint="rgb(var(--accent))" />
      <div className="mt-2 h-2 rounded-full bg-line"><div className="h-2 rounded-full" style={{ width: budgetPct + '%', background: budgetPct > 85 ? '#E5484D' : 'rgb(var(--accent))' }} /></div>
      {budgetPct > 85 && <p className="mt-1 text-xs font-bold text-[#E5484D]">Nearly at your limit</p>}</>,
    income: <Stat v={inr(incomeVal)} sub="this month" tint="rgb(var(--secondary))" />,
    savings: <><Stat v={`${savingsPct}%`} sub={`${inr(savedTotal)} of ${inr(targetTotal)}`} tint="rgb(var(--accent))" />
      <div className="mt-2 h-2 rounded-full bg-line"><div className="h-2 rounded-full bg-accent" style={{ width: savingsPct + '%' }} /></div></>,
    trend: <div className="h-40"><ResponsiveContainer><AreaChart data={trendData}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={pal.light.primary} stopOpacity={0.5} /><stop offset="100%" stopColor={pal.light.primary} stopOpacity={0} /></linearGradient></defs>
      <XAxis dataKey="d" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} /><Tooltip formatter={(v: number) => inr(v)} />
      <Area type="monotone" dataKey="v" stroke={pal.light.primary} strokeWidth={2.5} fill="url(#g)" /></AreaChart></ResponsiveContainer></div>,
    notes: <ul className="space-y-2">{notesList.map((n: any) => <li key={n.id} onClick={() => go('notes')} className="rounded-2xl bg-primary/10 px-3 py-2 cursor-pointer"><p className="text-sm font-bold">{n.title || 'Untitled'}</p><p className="truncate text-xs opacity-60">{n.excerpt || n.body}</p></li>)}</ul>,
    stickies: stickiesList.length ? <div className="flex flex-wrap gap-3">{stickiesList.map((s: any) => <div key={s.id} onClick={() => go('sticky')} className="font-hand w-32 p-3 text-lg leading-tight text-[#3a2f45] shadow-soft cursor-pointer" style={{ background: s.color, transform: `rotate(${s.rot || 0}deg)` }}>{s.text}</div>)}</div>
      : <p className="text-sm opacity-60">Pin a sticky note and it will land here.</p>,
    transactions: txList.length ? <ul className="divide-y">{txList.map((t: any) => <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0"><b>{t.desc}</b><br /><span className="text-xs opacity-60">{t.category} · {t.date}</span></span>
      <b style={{ color: t.type === 'income' ? 'rgb(var(--accent))' : 'inherit' }}>{t.type === 'income' ? '+' : '−'}{inr(t.amount)}</b></li>)}</ul> : <p className="text-sm opacity-60">Your wallet has been enjoying some peace.</p>,
  }
  const quick = [
    { l: 'Create Note', i: FilePlus2, f: () => go('notes') }, { l: 'Add Expense', i: MinusCircle, f: () => setForm('expense') }, { l: 'Add Income', i: PlusCircle, f: () => setForm('income') },
    { l: 'Create Sticky Note', i: StickyNote, f: () => go('sticky') }, { l: 'Start Drawing', i: Brush, f: () => go('draw') }]
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-extrabold md:text-3xl">{greet} 🌤</h2>
          <p className="text-sm opacity-70">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="font-hand mt-1 text-2xl text-primary">{QUOTES[new Date().getDate() % QUOTES.length]}</p></div>
        <button className="btn btn-ghost" onClick={() => setEdit(!edit)}><SlidersHorizontal size={16} />{edit ? 'Done' : 'Customize'}</button>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">{quick.map(q => <button key={q.l} className="btn btn-ghost shrink-0 whitespace-nowrap" onClick={q.f}><q.i size={16} />{q.l}</button>)}</div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {widgets.filter(w => edit || w.visible).map((w, i) => (
          <section key={w.id} className={`card min-w-0 p-4 md:p-5 ${WIDE.includes(w.id) ? 'col-span-2' : edit ? 'col-span-2 lg:col-span-1' : ''} ${!w.visible ? 'opacity-40' : ''}`}>
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold opacity-70">{TITLES[w.id]}</h3>
              {edit && <div className="flex gap-1"><button aria-label="Move earlier" onClick={() => moveWidget(w.id, -1)} className="btn btn-ghost !min-h-[36px] !min-w-[36px] !p-1"><ArrowUp size={14} /></button>
                <button aria-label="Move later" onClick={() => moveWidget(w.id, 1)} className="btn btn-ghost !min-h-[36px] !min-w-[36px] !p-1"><ArrowDown size={14} /></button>
                <button aria-label="Show or hide" onClick={() => toggleWidget(w.id)} className="btn btn-ghost !min-h-[36px] !min-w-[36px] !p-1">{w.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button></div>}</div>
            {body[w.id]}
          </section>))}
      </div>
      {form && <TxModal type={form} onClose={() => setForm(null)} onSave={t => { addTx(t); toast(t.type === 'income' ? 'Income added. Nice.' : 'Expense added. Safely tucked away.'); setForm(null) }} />}
    </div>
  )
}

function TxModal({ type, onClose, onSave }: { type: 'expense' | 'income'; onClose: () => void; onSave: (t: { type: 'expense' | 'income'; amount: number; category: string; desc: string; date: string; method: string }) => void }) {
  const [f, setF] = useState({ amount: '', category: type === 'income' ? 'Salary' : 'Food', desc: '', date: dayAgo(0), method: 'UPI' })
  const cats = type === 'income' ? ['Salary', 'Freelance', 'Gift', 'Other'] : CATEGORIES
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="card max-h-[90dvh] w-full max-w-sm space-y-3 overflow-y-auto !rounded-b-none p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:!rounded-b-3xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between"><h3 className="text-lg font-extrabold">{type === 'income' ? 'Add income' : 'Add expense'}</h3><button aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <input autoFocus className="input" type="number" min="0" placeholder="Amount (₹)" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
        <input className="input" placeholder="Description" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <select className="input" value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{cats.map(c => <option key={c}>{c}</option>)}</select>
          <select className="input" value={f.method} onChange={e => setF({ ...f, method: e.target.value })}>{['UPI', 'Card', 'Cash', 'Bank'].map(c => <option key={c}>{c}</option>)}</select></div>
        <input className="input" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
        <button className="btn btn-primary w-full" disabled={!+f.amount} onClick={() => onSave({ type, ...f, amount: +f.amount, desc: f.desc || f.category })}>Save {type}</button>
      </div></div>)
}
