import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PiggyBank,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ChevronLeft,
  ChevronRight,
  X,
  TrendingDown,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore, inr, CATEGORIES } from '../store'

export interface CategoryBudgetStatus {
  category: string
  limitMinor: number
  spentMinor: number
  remainingMinor: number
  utilizationPercent: number
  status: 'ok' | 'warning' | 'exceeded'
}

export interface BudgetStatusData {
  month: string
  total: {
    limitMinor: number
    spentMinor: number
    remainingMinor: number
    utilizationPercent: number
    status: 'ok' | 'warning' | 'exceeded'
  }
  categories: CategoryBudgetStatus[]
}

export default function Budgets() {
  const { currentUser, budget: mockBudget, txs: mockTxs, toast, set: setStore } = useStore()

  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [data, setData] = useState<BudgetStatusData | null>(null)
  const [editModal, setEditModal] = useState(false)
  const [totalLimitInput, setTotalLimitInput] = useState('25000')

  const loadBudgetStatus = async () => {
    if (currentUser) {
      try {
        const res = await apiRequest(`/budgets/${currentMonth}/status`)
        setData(res)
        setTotalLimitInput(String(res.total.limitMinor / 100))
      } catch {
        fallbackLocal()
      }
    } else {
      fallbackLocal()
    }
  }

  const fallbackLocal = () => {
    const monthExpenses = mockTxs
      .filter(t => t.type === 'expense' && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + Math.round(t.amount * 100), 0)

    const limitMinor = Math.round(mockBudget * 100)
    const utilizationPercent = limitMinor > 0 ? Math.round((monthExpenses / limitMinor) * 100) : 0
    const status: 'ok' | 'warning' | 'exceeded' =
      monthExpenses > limitMinor ? 'exceeded' : utilizationPercent >= 80 ? 'warning' : 'ok'

    // Mock category spends
    const categoryMap: Record<string, number> = {}
    for (const t of mockTxs.filter(x => x.type === 'expense' && x.date.startsWith(currentMonth))) {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + Math.round(t.amount * 100)
    }

    const categoriesStatus: CategoryBudgetStatus[] = CATEGORIES.map(c => {
      const spent = categoryMap[c] || 0
      const limit = Math.round((mockBudget / CATEGORIES.length) * 100)
      const uPct = limit > 0 ? Math.round((spent / limit) * 100) : 0
      return {
        category: c,
        limitMinor: limit,
        spentMinor: spent,
        remainingMinor: limit - spent,
        utilizationPercent: uPct,
        status: spent > limit ? 'exceeded' : uPct >= 80 ? 'warning' : 'ok',
      }
    })

    setData({
      month: currentMonth,
      total: {
        limitMinor,
        spentMinor: monthExpenses,
        remainingMinor: limitMinor - monthExpenses,
        utilizationPercent,
        status,
      },
      categories: categoriesStatus,
    })
  }

  useEffect(() => {
    loadBudgetStatus()
  }, [currentMonth, currentUser])

  // Change month (+1 / -1)
  const shiftMonth = (delta: number) => {
    const d = new Date(`${currentMonth}-01`)
    d.setMonth(d.getMonth() + delta)
    setCurrentMonth(d.toISOString().slice(0, 7))
  }

  // Save updated budget
  const handleSaveBudget = async () => {
    const newLimitRupees = Number(totalLimitInput)
    if (isNaN(newLimitRupees) || newLimitRupees < 0) return

    const totalLimitMinor = Math.round(newLimitRupees * 100)

    if (currentUser) {
      try {
        await apiRequest(`/budgets/${currentMonth}`, {
          method: 'PUT',
          body: JSON.stringify({
            totalLimitMinor,
            categoryLimits: [],
          }),
        })
        toast('Budget updated!')
        setEditModal(false)
        loadBudgetStatus()
      } catch (err: any) {
        toast('Failed to update: ' + err.message)
      }
    } else {
      setStore({ budget: newLimitRupees })
      toast('Budget updated!')
      setEditModal(false)
      fallbackLocal()
    }
  }

  if (!data) return null

  const getStatusBadge = (status: 'ok' | 'warning' | 'exceeded') => {
    if (status === 'exceeded') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-black text-red-500">
          <AlertCircle size={12} /> Over Limit
        </span>
      )
    }
    if (status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-black text-amber-500">
          <AlertTriangle size={12} /> Nearly Limit (80%+)
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-black text-primary">
        <CheckCircle2 size={12} /> On Track
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Month Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Monthly Budgets</h2>
          <p className="text-xs opacity-60">Set limits and keep spending healthy across categories.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Stepper */}
          <div className="card flex items-center gap-2 px-3 py-1.5 shadow-soft">
            <button onClick={() => shiftMonth(-1)} className="opacity-60 hover:opacity-100 p-1">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold min-w-[90px] text-center">
              {new Date(`${currentMonth}-01`).toLocaleDateString('en-IN', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button onClick={() => shiftMonth(1)} className="opacity-60 hover:opacity-100 p-1">
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setEditModal(true)}
            className="btn btn-primary flex items-center gap-1.5 !px-3.5 !py-2 text-xs font-bold"
          >
            <Sliders size={15} /> Adjust Budget
          </button>
        </div>
      </div>

      {/* Main Budget Card */}
      <div className="card p-6 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-60">Total Monthly Limit</p>
            <h3 className="mt-1 text-3xl font-black">{inr(data.total.limitMinor / 100)}</h3>
          </div>
          <div>{getStatusBadge(data.total.status)}</div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span>Spent: {inr(data.total.spentMinor / 100)}</span>
            <span>
              {data.total.remainingMinor >= 0
                ? `${inr(data.total.remainingMinor / 100)} left`
                : `${inr(Math.abs(data.total.remainingMinor) / 100)} exceeded`}
            </span>
          </div>

          <div className="h-3.5 w-full rounded-full bg-black/5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                data.total.status === 'exceeded'
                  ? 'bg-red-500'
                  : data.total.status === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${Math.min(100, data.total.utilizationPercent)}%` }}
            />
          </div>

          <div className="mt-2 text-right text-[11px] font-bold opacity-60">
            {data.total.utilizationPercent}% utilized
          </div>
        </div>
      </div>

      {/* Category Budgets Breakdown */}
      <div className="card overflow-hidden shadow-soft">
        <div className="border-b bg-surface/50 px-5 py-3 text-xs font-extrabold uppercase tracking-wider opacity-70">
          Category Spending vs Limits
        </div>

        <div className="divide-y divide-black/5">
          {data.categories.length === 0 ? (
            <div className="py-12 text-center text-xs opacity-50">No expenses recorded for this month.</div>
          ) : (
            data.categories.map(cat => (
              <div key={cat.category} className="flex flex-col gap-2 p-4 transition hover:bg-primary/5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-[140px]">
                  <p className="text-sm font-bold">{cat.category}</p>
                  <p className="text-[11px] opacity-60">
                    Spent {inr(cat.spentMinor / 100)}
                    {cat.limitMinor > 0 ? ` of ${inr(cat.limitMinor / 100)}` : ''}
                  </p>
                </div>

                {cat.limitMinor > 0 ? (
                  <div className="flex flex-1 max-w-xs items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-black/5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          cat.status === 'exceeded'
                            ? 'bg-red-500'
                            : cat.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(100, cat.utilizationPercent)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold min-w-[36px] text-right">
                      {cat.utilizationPercent}%
                    </span>
                  </div>
                ) : (
                  <div className="text-xs opacity-40 italic">No limit set</div>
                )}

                <div className="flex items-center justify-between sm:justify-end gap-3 min-w-[120px]">
                  {cat.limitMinor > 0 && (
                    <span
                      className={`text-xs font-bold ${
                        cat.remainingMinor < 0 ? 'text-red-500' : 'opacity-70'
                      }`}
                    >
                      {cat.remainingMinor >= 0
                        ? `${inr(cat.remainingMinor / 100)} left`
                        : `${inr(Math.abs(cat.remainingMinor) / 100)} over`}
                    </span>
                  )}
                  {getStatusBadge(cat.status)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* EDIT BUDGET MODAL */}
      <AnimatePresence>
        {editModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card w-full max-w-sm p-6 shadow-lift space-y-4"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-extrabold">Adjust Monthly Budget</h3>
                <button onClick={() => setEditModal(false)} className="opacity-60 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">
                  Total Budget for {new Date(`${currentMonth}-01`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={totalLimitInput}
                  onChange={e => setTotalLimitInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border bg-surface/50 p-2.5 text-lg font-black outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={handleSaveBudget}
                className="btn btn-primary w-full !py-2.5 text-sm font-bold"
              >
                Save Budget
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
