import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet,
  PlusCircle,
  MinusCircle,
  Filter,
  Search,
  Trash2,
  Calendar,
  CreditCard,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Plus,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore, inr, dayAgo, uid, CATEGORIES } from '../store'

export interface TxItem {
  id: string
  type: 'expense' | 'income'
  amountMinor: number
  currency: string
  category: string
  description: string
  paymentMethod: string
  date: string
  notes?: string
}

export default function Finance() {
  const { currentUser, txs: mockTxs, set: setStore, toast } = useStore()

  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [range, setRange] = useState<'month' | 'week' | 'today' | 'all'>('month')
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [categories, setCategories] = useState<{ expense: string[]; income: string[] }>({
    expense: CATEGORIES,
    income: ['Salary', 'Freelance', 'Gift', 'Other'],
  })

  const [modalType, setModalType] = useState<null | 'expense' | 'income'>(null)
  const [newCatModal, setNewCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  // Load transactions and categories
  const loadData = async () => {
    if (currentUser) {
      try {
        const query = new URLSearchParams()
        if (range !== 'all') query.set('range', range)
        if (typeFilter !== 'all') query.set('type', typeFilter)
        if (categoryFilter !== 'all') query.set('category', categoryFilter)
        if (searchQuery) query.set('q', searchQuery)

        const [txRes, catRes] = await Promise.all([
          apiRequest(`/transactions?${query.toString()}`),
          apiRequest('/transactions/categories'),
        ])

        setTransactions(txRes.transactions)
        setCategories(catRes)
      } catch {
        fallbackLocal()
      }
    } else {
      fallbackLocal()
    }
  }

  const fallbackLocal = () => {
    const converted: TxItem[] = mockTxs.map(t => ({
      id: t.id,
      type: t.type,
      amountMinor: Math.round(t.amount * 100),
      currency: 'INR',
      category: t.category,
      description: t.desc,
      paymentMethod: t.method.toLowerCase(),
      date: t.date,
    }))

    let filtered = converted
    if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter)
    if (categoryFilter !== 'all') filtered = filtered.filter(t => t.category === categoryFilter)
    if (searchQuery) {
      filtered = filtered.filter(
        t =>
          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    setTransactions(filtered)
  }

  useEffect(() => {
    loadData()
  }, [range, typeFilter, categoryFilter, searchQuery, currentUser])

  // Summary stats
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amountMinor, 0)

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amountMinor, 0)

  const netSavings = totalIncome - totalExpense

  // Group by day string
  const groupedByDate: Record<string, TxItem[]> = {}
  for (const t of transactions) {
    if (!groupedByDate[t.date]) groupedByDate[t.date] = []
    groupedByDate[t.date].push(t)
  }

  // Create Transaction
  const handleSaveTransaction = async (formData: {
    type: 'expense' | 'income'
    amountRupees: number
    category: string
    description: string
    paymentMethod: string
    date: string
    notes?: string
  }) => {
    const amountMinor = Math.round(formData.amountRupees * 100)

    if (currentUser) {
      try {
        const created = await apiRequest('/transactions', {
          method: 'POST',
          body: JSON.stringify({
            type: formData.type,
            amountMinor,
            category: formData.category,
            description: formData.description || formData.category,
            paymentMethod: formData.paymentMethod.toLowerCase(),
            date: formData.date,
            notes: formData.notes || '',
            idempotencyKey: uid(),
          }),
        })

        setTransactions([created, ...transactions])
        setModalType(null)
        toast(formData.type === 'income' ? 'Income recorded!' : 'Expense safely tucked away!')
      } catch (err: any) {
        toast('Failed to save: ' + err.message)
      }
    } else {
      const newTx: TxItem = {
        id: uid(),
        type: formData.type,
        amountMinor,
        currency: 'INR',
        category: formData.category,
        description: formData.description || formData.category,
        paymentMethod: formData.paymentMethod.toLowerCase(),
        date: formData.date,
      }
      setTransactions([newTx, ...transactions])
      setStore({
        txs: [
          {
            id: newTx.id,
            type: newTx.type,
            amount: formData.amountRupees,
            category: newTx.category,
            desc: newTx.description,
            date: newTx.date,
            method: formData.paymentMethod,
          },
          ...mockTxs,
        ],
      })
      setModalType(null)
      toast('Transaction recorded!')
    }
  }

  // Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    if (currentUser) {
      try {
        await apiRequest(`/transactions/${id}`, { method: 'DELETE' })
        setTransactions(transactions.filter(t => t.id !== id))
        toast('Transaction removed')
      } catch (err: any) {
        toast('Failed to delete: ' + err.message)
      }
    } else {
      setTransactions(transactions.filter(t => t.id !== id))
      setStore({ txs: mockTxs.filter(t => t.id !== id) })
      toast('Transaction removed')
    }
  }

  // Add Custom Category
  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    if (currentUser) {
      try {
        await apiRequest('/transactions/categories', {
          method: 'POST',
          body: JSON.stringify({ name: newCatName.trim(), type: 'expense' }),
        })
        setCategories(prev => ({
          ...prev,
          expense: [...prev.expense, newCatName.trim()],
        }))
        toast(`Added category "${newCatName.trim()}"`)
        setNewCatName('')
        setNewCatModal(false)
      } catch (err: any) {
        toast('Error: ' + err.message)
      }
    } else {
      setCategories(prev => ({
        ...prev,
        expense: [...prev.expense, newCatName.trim()],
      }))
      setNewCatName('')
      setNewCatModal(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Finance & Transactions</h2>
          <p className="text-xs opacity-60">Track your daily expenses, income, and cashflow in minor units.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalType('expense')}
            className="btn btn-ghost flex items-center gap-1.5 text-xs font-bold text-accent"
          >
            <MinusCircle size={15} /> Add Expense
          </button>
          <button
            onClick={() => setModalType('income')}
            className="btn btn-primary flex items-center gap-1.5 !px-3.5 !py-1.5 text-xs font-bold"
          >
            <PlusCircle size={15} /> Add Income
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wider opacity-60">Total Spent</p>
          <p className="mt-2 text-2xl font-black text-accent">{inr(totalExpense / 100)}</p>
          <p className="mt-1 text-[11px] opacity-50">Filtered period</p>
        </div>

        <div className="card p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wider opacity-60">Total Income</p>
          <p className="mt-2 text-2xl font-black text-secondary">{inr(totalIncome / 100)}</p>
          <p className="mt-1 text-[11px] opacity-50">Filtered period</p>
        </div>

        <div className="card p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-wider opacity-60">Net Cashflow</p>
          <p
            className={`mt-2 text-2xl font-black ${
              netSavings >= 0 ? 'text-primary' : 'text-red-500'
            }`}
          >
            {netSavings >= 0 ? '+' : '−'}
            {inr(Math.abs(netSavings) / 100)}
          </p>
          <p className="mt-1 text-[11px] opacity-50">Income minus expenses</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4 shadow-soft">
        {/* Left: Range and Type tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Range */}
          <div className="flex rounded-xl bg-surface/80 p-1 text-xs font-bold">
            {(['today', 'week', 'month', 'all'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1 capitalize transition ${
                  range === r ? 'bg-primary text-white shadow-soft' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {r === 'all' ? 'All Time' : r}
              </button>
            ))}
          </div>

          {/* Type Filter */}
          <div className="flex rounded-xl bg-surface/80 p-1 text-xs font-bold">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-lg px-3 py-1 capitalize transition ${
                  typeFilter === t ? 'bg-primary/20 text-primary' : 'opacity-60 hover:opacity-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Category filter & Search */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="rounded-xl border bg-surface/60 px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary"
          >
            <option value="all">All Categories</option>
            {categories.expense.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {categories.income.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={() => setNewCatModal(true)}
            className="btn btn-ghost !p-2"
            title="Add custom category"
          >
            <Plus size={16} />
          </button>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-36 rounded-xl border bg-surface/60 py-1.5 pl-8 pr-2 text-xs font-semibold outline-none focus:border-primary sm:w-48"
            />
          </div>
        </div>
      </div>

      {/* Grouped Transactions List */}
      <div className="space-y-4">
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="card py-16 text-center opacity-60">
            <Wallet size={36} className="mx-auto mb-2 opacity-30 text-primary" />
            <p className="text-sm font-bold">No transactions found</p>
            <p className="mt-1 text-xs">Try selecting a different date range or add a new transaction.</p>
          </div>
        ) : (
          Object.entries(groupedByDate).map(([dateStr, items]) => {
            const dayExpense = items
              .filter(i => i.type === 'expense')
              .reduce((a, b) => a + b.amountMinor, 0)
            const dayIncome = items
              .filter(i => i.type === 'income')
              .reduce((a, b) => a + b.amountMinor, 0)

            return (
              <div key={dateStr} className="card overflow-hidden shadow-soft">
                {/* Date Header */}
                <div className="flex items-center justify-between border-b bg-surface/50 px-4 py-2.5 text-xs font-bold">
                  <span className="flex items-center gap-1.5 opacity-80">
                    <Calendar size={13} className="text-primary" />
                    {new Date(dateStr).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <div className="flex items-center gap-3 text-[11px]">
                    {dayExpense > 0 && <span className="text-accent">−{inr(dayExpense / 100)}</span>}
                    {dayIncome > 0 && <span className="text-secondary">+{inr(dayIncome / 100)}</span>}
                  </div>
                </div>

                {/* Items */}
                <div className="divide-y divide-black/5">
                  {items.map(tx => (
                    <div
                      key={tx.id}
                      className="group flex items-center justify-between px-4 py-3 transition hover:bg-primary/5"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid h-9 w-9 place-items-center rounded-xl ${
                            tx.type === 'income' ? 'bg-secondary/15 text-secondary' : 'bg-accent/15 text-accent'
                          }`}
                        >
                          {tx.type === 'income' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-ink">{tx.description}</p>
                          <p className="text-[11px] opacity-60">
                            {tx.category} • <span className="uppercase">{tx.paymentMethod}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={`text-sm font-black ${
                            tx.type === 'income' ? 'text-secondary' : 'text-ink'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '−'}
                          {inr(tx.amountMinor / 100)}
                        </span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-accent"
                          title="Delete transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ADD TRANSACTION MODAL */}
      <AnimatePresence>
        {modalType && (
          <TransactionModal
            type={modalType}
            categories={categories}
            onClose={() => setModalType(null)}
            onSave={handleSaveTransaction}
          />
        )}
      </AnimatePresence>

      {/* ADD CUSTOM CATEGORY MODAL */}
      <AnimatePresence>
        {newCatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card w-full max-w-sm p-6 shadow-lift"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base">New Category</h3>
                <button onClick={() => setNewCatModal(false)} className="opacity-60 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="e.g. Pet Care, Hobbies"
                className="mt-4 w-full rounded-xl border bg-surface/50 px-3 py-2 text-sm font-semibold outline-none focus:border-primary"
              />
              <button
                onClick={handleAddCategory}
                disabled={!newCatName.trim()}
                className="btn btn-primary mt-4 w-full text-xs font-bold"
              >
                Save Category
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TransactionModal({
  type,
  categories,
  onClose,
  onSave,
}: {
  type: 'expense' | 'income'
  categories: { expense: string[]; income: string[] }
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(type === 'income' ? categories.income[0] : categories.expense[0])
  const [description, setDescription] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('UPI')
  const [date, setDate] = useState(dayAgo(0))

  const cats = type === 'income' ? categories.income : categories.expense

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!+amount) return
    onSave({
      type,
      amountRupees: Number(amount),
      category,
      description: description.trim(),
      paymentMethod,
      date,
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
          <h3 className="text-lg font-extrabold capitalize">Add {type}</h3>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Amount (₹)</label>
            <input
              type="number"
              step="any"
              min="0"
              required
              autoFocus
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="250"
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2.5 text-lg font-black outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Lunch with friends"
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2 text-sm font-semibold outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-surface/50 p-2 text-xs font-semibold outline-none focus:border-primary"
              >
                {cats.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Method</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-surface/50 p-2 text-xs font-semibold outline-none focus:border-primary"
              >
                {['UPI', 'Card', 'Cash', 'Bank', 'Other'].map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-surface/50 p-2 text-xs font-semibold outline-none focus:border-primary"
            />
          </div>

          <button
            type="submit"
            disabled={!+amount}
            className="btn btn-primary w-full !py-2.5 mt-2 text-sm font-bold"
          >
            Save {type}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
