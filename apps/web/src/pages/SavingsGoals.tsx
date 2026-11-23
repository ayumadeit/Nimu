import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  Plus,
  Sparkles,
  Trophy,
  Calendar,
  History,
  Trash2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore, inr, dayAgo, uid } from '../store'

export interface GoalItem {
  id: string
  name: string
  targetMinor: number
  savedMinor: number
  targetDate?: string | null
  icon: string
  color: string
  progressPercent: number
  completedAt?: string | null
  contributionsCount?: number
}

const GOAL_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6']

export default function SavingsGoals() {
  const { currentUser, goals: mockGoals, toast, set: setStore } = useStore()

  const [goals, setGoals] = useState<GoalItem[]>([])
  const [createModal, setCreateModal] = useState(false)
  const [contributeModal, setContributeModal] = useState<GoalItem | null>(null)
  const [historyModal, setHistoryModal] = useState<GoalItem | null>(null)
  const [contributions, setContributions] = useState<any[]>([])

  // Load goals
  const loadGoals = async () => {
    if (currentUser) {
      try {
        const data = await apiRequest('/goals')
        setGoals(data)
      } catch {
        fallbackLocal()
      }
    } else {
      fallbackLocal()
    }
  }

  const fallbackLocal = () => {
    const converted: GoalItem[] = mockGoals.map((g, idx) => {
      const targetMinor = Math.round(g.target * 100)
      const savedMinor = Math.round(g.saved * 100)
      const progressPercent = targetMinor > 0 ? Math.min(100, Math.round((savedMinor / targetMinor) * 100)) : 0
      return {
        id: g.id,
        name: g.name,
        targetMinor,
        savedMinor,
        icon: 'Target',
        color: GOAL_COLORS[idx % GOAL_COLORS.length],
        progressPercent,
        completedAt: savedMinor >= targetMinor ? new Date().toISOString() : null,
      }
    })
    setGoals(converted)
  }

  useEffect(() => {
    loadGoals()
  }, [currentUser])

  // Create Goal
  const handleCreateGoal = async (data: {
    name: string
    targetRupees: number
    targetDate?: string
    color: string
  }) => {
    const targetMinor = Math.round(data.targetRupees * 100)

    if (currentUser) {
      try {
        const created = await apiRequest('/goals', {
          method: 'POST',
          body: JSON.stringify({
            name: data.name,
            targetMinor,
            targetDate: data.targetDate || null,
            icon: 'Target',
            color: data.color,
          }),
        })
        setGoals([created, ...goals])
        setCreateModal(false)
        toast('New savings goal created!')
      } catch (err: any) {
        toast('Failed to create: ' + err.message)
      }
    } else {
      const newG: GoalItem = {
        id: uid(),
        name: data.name,
        targetMinor,
        savedMinor: 0,
        targetDate: data.targetDate || null,
        icon: 'Target',
        color: data.color,
        progressPercent: 0,
      }
      setGoals([newG, ...goals])
      setStore({
        goals: [
          ...mockGoals,
          { id: newG.id, name: newG.name, target: data.targetRupees, saved: 0 },
        ],
      })
      setCreateModal(false)
      toast('New savings goal created!')
    }
  }

  // Delete Goal
  const handleDeleteGoal = async (id: string) => {
    if (currentUser) {
      try {
        await apiRequest(`/goals/${id}`, { method: 'DELETE' })
        setGoals(goals.filter(g => g.id !== id))
        toast('Goal removed')
      } catch (err: any) {
        toast('Failed to delete: ' + err.message)
      }
    } else {
      setGoals(goals.filter(g => g.id !== id))
      setStore({ goals: mockGoals.filter(g => g.id !== id) })
      toast('Goal removed')
    }
  }

  // Handle Contribution
  const handleAddContribution = async (amountRupees: number, isWithdrawal: boolean, note: string) => {
    if (!contributeModal) return
    const amountMinor = Math.round(amountRupees * 100) * (isWithdrawal ? -1 : 1)

    if (currentUser) {
      try {
        const res = await apiRequest(`/goals/${contributeModal.id}/contributions`, {
          method: 'POST',
          body: JSON.stringify({
            amountMinor,
            date: dayAgo(0),
            note: note || (isWithdrawal ? 'Withdrawal' : 'Deposit'),
          }),
        })

        setGoals(prev => prev.map(g => (g.id === contributeModal.id ? res.goal : g)))
        setContributeModal(null)
        toast(isWithdrawal ? 'Withdrew funds from goal' : 'Contribution added! Good job!')
      } catch (err: any) {
        toast('Error: ' + err.message)
      }
    } else {
      const newSaved = Math.max(0, contributeModal.savedMinor + amountMinor)
      const pPct = Math.min(100, Math.round((newSaved / contributeModal.targetMinor) * 100))

      setGoals(prev =>
        prev.map(g =>
          g.id === contributeModal.id
            ? { ...g, savedMinor: newSaved, progressPercent: pPct, completedAt: pPct >= 100 ? new Date().toISOString() : null }
            : g
        )
      )
      setStore({
        goals: mockGoals.map(g =>
          g.id === contributeModal.id ? { ...g, saved: Math.round(newSaved / 100) } : g
        ),
      })
      setContributeModal(null)
      toast('Contribution recorded!')
    }
  }

  // Open History Modal
  const handleOpenHistory = async (goal: GoalItem) => {
    setHistoryModal(goal)
    if (currentUser) {
      try {
        const res = await apiRequest(`/goals/${goal.id}/contributions`)
        setContributions(res)
      } catch {}
    } else {
      setContributions([])
    }
  }

  const totalTarget = goals.reduce((a, b) => a + b.targetMinor, 0)
  const totalSaved = goals.reduce((a, b) => a + b.savedMinor, 0)
  const totalPercent = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & New Goal Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Savings Goals</h2>
          <p className="text-xs opacity-60">Set targets for things you love and watch your nest egg grow.</p>
        </div>

        <button
          onClick={() => setCreateModal(true)}
          className="btn btn-primary flex items-center gap-1.5 !px-3.5 !py-2 text-xs font-bold"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {/* Overview Progress Card */}
      <div className="card p-6 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider opacity-60">Total Saved Across Goals</p>
            <h3 className="mt-1 text-3xl font-black text-primary">
              {inr(totalSaved / 100)}{' '}
              <span className="text-sm font-semibold opacity-40">of {inr(totalTarget / 100)}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black">{totalPercent}%</span>
            <span className="text-xs font-bold opacity-60">completed</span>
          </div>
        </div>

        <div className="mt-4 h-3.5 w-full rounded-full bg-black/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${totalPercent}%` }}
          />
        </div>
      </div>

      {/* Goals Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map(goal => {
          const isComplete = goal.progressPercent >= 100

          return (
            <motion.div
              key={goal.id}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="card relative flex flex-col justify-between p-6 shadow-soft hover:shadow-lift transition"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div
                    className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-soft"
                    style={{ backgroundColor: goal.color }}
                  >
                    {isComplete ? <Trophy size={20} /> : <Target size={20} />}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenHistory(goal)}
                      className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition hover:bg-black/5"
                      title="Contribution history"
                    >
                      <History size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="p-1.5 rounded-lg opacity-40 hover:opacity-100 transition hover:bg-black/5 text-accent"
                      title="Delete goal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="mt-4 text-lg font-extrabold text-ink">{goal.name}</h3>

                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="font-extrabold text-base text-ink">
                    {inr(goal.savedMinor / 100)}
                  </span>
                  <span className="opacity-60">Target: {inr(goal.targetMinor / 100)}</span>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 h-2.5 w-full rounded-full bg-black/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${goal.progressPercent}%`,
                      backgroundColor: goal.color,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] font-bold opacity-60">
                  <span>{goal.progressPercent}% reached</span>
                  {goal.targetDate && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {new Date(goal.targetDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {isComplete && (
                  <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-primary/15 p-2 text-xs font-black text-primary">
                    <Sparkles size={14} /> Target Achieved! Woohoo!
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="mt-6 border-t pt-4">
                <button
                  onClick={() => setContributeModal(goal)}
                  className="btn btn-ghost w-full !py-2 text-xs font-bold text-primary hover:bg-primary/10"
                >
                  <Plus size={14} className="mr-1 inline" /> Add or Withdraw Funds
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* CREATE GOAL MODAL */}
      <AnimatePresence>
        {createModal && (
          <CreateGoalModal
            onClose={() => setCreateModal(false)}
            onSave={handleCreateGoal}
          />
        )}
      </AnimatePresence>

      {/* CONTRIBUTE / WITHDRAW MODAL */}
      <AnimatePresence>
        {contributeModal && (
          <ContributeModal
            goal={contributeModal}
            onClose={() => setContributeModal(null)}
            onSave={handleAddContribution}
          />
        )}
      </AnimatePresence>

      {/* HISTORY MODAL */}
      <AnimatePresence>
        {historyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card w-full max-w-md p-6 shadow-lift"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base">{historyModal.name} — History</h3>
                <button onClick={() => setHistoryModal(null)} className="opacity-60 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 max-h-72 overflow-y-auto space-y-2">
                {contributions.length === 0 ? (
                  <p className="text-xs opacity-50 py-4 text-center">No contributions logged yet.</p>
                ) : (
                  contributions.map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl bg-surface/50 p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold">{c.note || 'Contribution'}</div>
                        <div className="text-[11px] opacity-50">{c.date}</div>
                      </div>
                      <span
                        className={`font-black ${
                          c.amountMinor >= 0 ? 'text-primary' : 'text-accent'
                        }`}
                      >
                        {c.amountMinor >= 0 ? '+' : '−'}
                        {inr(Math.abs(c.amountMinor) / 100)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateGoalModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (data: { name: string; targetRupees: number; targetDate?: string; color: string }) => void
}) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [color, setColor] = useState(GOAL_COLORS[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !+target) return
    onSave({
      name: name.trim(),
      targetRupees: Number(target),
      targetDate: targetDate || undefined,
      color,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card w-full max-w-sm p-6 shadow-lift space-y-4"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-extrabold">New Savings Goal</h3>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Goal Name</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. New Guitar, Trip to Japan"
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2.5 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Target Amount (₹)</label>
            <input
              type="number"
              min="1"
              required
              value={target}
              onChange={e => setTarget(e.target.value)}
              placeholder="50000"
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2.5 text-lg font-black outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Target Date (Optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={e => setTargetDate(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2 text-xs font-semibold outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Color</label>
            <div className="mt-1.5 flex gap-2">
              {GOAL_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                    color === c ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !+target}
            className="btn btn-primary w-full !py-2.5 mt-3 text-sm font-bold"
          >
            Create Goal
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function ContributeModal({
  goal,
  onClose,
  onSave,
}: {
  goal: GoalItem
  onClose: () => void
  onSave: (amount: number, isWithdrawal: boolean, note: string) => void
}) {
  const [amount, setAmount] = useState('')
  const [isWithdrawal, setIsWithdrawal] = useState(false)
  const [note, setNote] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!+amount) return
    onSave(Number(amount), isWithdrawal, note)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card w-full max-w-sm p-6 shadow-lift space-y-4"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="text-base font-extrabold">{goal.name}</h3>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        {/* Tab: Deposit / Withdraw */}
        <div className="flex rounded-xl bg-surface/80 p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setIsWithdrawal(false)}
            className={`flex-1 rounded-lg py-1.5 transition ${
              !isWithdrawal ? 'bg-primary text-white shadow-soft' : 'opacity-60 hover:opacity-100'
            }`}
          >
            Deposit (+)
          </button>
          <button
            type="button"
            onClick={() => setIsWithdrawal(true)}
            className={`flex-1 rounded-lg py-1.5 transition ${
              isWithdrawal ? 'bg-accent text-white shadow-soft' : 'opacity-60 hover:opacity-100'
            }`}
          >
            Withdraw (−)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Amount (₹)</label>
            <input
              type="number"
              min="1"
              required
              autoFocus
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="2000"
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2.5 text-lg font-black outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Note (Optional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Diwal bonus, Freelance payout"
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2 text-xs font-semibold outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={!+amount}
            className="btn btn-primary w-full !py-2.5 mt-2 text-sm font-bold"
          >
            Confirm {isWithdrawal ? 'Withdrawal' : 'Deposit'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
