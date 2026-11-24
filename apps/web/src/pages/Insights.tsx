import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart3,
  Sparkles,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore } from '../store'

interface SummaryData {
  spentMinor: number
  incomeMinor: number
  netMinor: number
  dailyAverageMinor: number
  transactionCount: number
  previousMonthSpentMinor: number
  pctChangeVsLastMonth: number
}

interface CategoryData {
  category: string
  spentMinor: number
  percentage: number
}

interface DailyData {
  date: string
  day: number
  spentMinor: number
}

interface TrendData {
  month: string
  label: string
  spentMinor: number
  incomeMinor: number
  netMinor: number
}

const CATEGORY_COLORS = [
  '#F472B6', // pink
  '#60A5FA', // blue
  '#34D399', // emerald
  '#FBBF24', // amber
  '#A78BFA', // purple
  '#F87171', // red
  '#38BDF8', // sky
  '#A3E635', // lime
  '#FB923C', // orange
  '#C084FC', // violet
]

export default function Insights() {
  const { toast } = useStore()
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [daily, setDaily] = useState<DailyData[]>([])
  const [trend, setTrend] = useState<TrendData[]>([])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const [sumRes, catRes, dailyRes, trendRes] = await Promise.all([
        apiRequest<SummaryData>(`/insights/summary?month=${currentMonth}`),
        apiRequest<CategoryData[]>(`/insights/by-category?month=${currentMonth}`),
        apiRequest<DailyData[]>(`/insights/daily?month=${currentMonth}`),
        apiRequest<TrendData[]>('/insights/monthly-trend?months=6'),
      ])
      setSummary(sumRes)
      setCategories(catRes)
      setDaily(dailyRes)
      setTrend(trendRes)
    } catch (err: any) {
      toast('Failed to load insights')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [currentMonth])

  const formatRupees = (minor: number) => {
    return `₹${Math.abs(Math.round(minor / 100)).toLocaleString('en-IN')}`
  }

  const changeMonth = (delta: number) => {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const nextY = d.getFullYear()
    const nextM = String(d.getMonth() + 1).padStart(2, '0')
    setCurrentMonth(`${nextY}-${nextM}`)
  }

  const monthLabel = () => {
    const [y, m] = currentMonth.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Month Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Spending Insights</h2>
          <p className="mt-1 text-sm opacity-70">
            A quiet, thoughtful look at where your money flows.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start rounded-2xl border border-ink/10 bg-surface p-1 shadow-soft">
          <button
            onClick={() => changeMonth(-1)}
            className="rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-primary/10 transition"
          >
            ← Prev
          </button>
          <span className="px-2 text-xs font-extrabold">{monthLabel()}</span>
          <button
            onClick={() => changeMonth(1)}
            className="rounded-xl px-3 py-1.5 text-xs font-bold hover:bg-primary/10 transition"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center justify-between text-ink/60">
            <span className="text-xs font-bold">Total Spent</span>
            <Wallet size={16} className="text-primary" />
          </div>
          <div className="mt-2 text-xl font-extrabold">
            {formatRupees(summary?.spentMinor || 0)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold">
            {summary && summary.pctChangeVsLastMonth !== 0 ? (
              summary.pctChangeVsLastMonth > 0 ? (
                <span className="flex items-center text-rose-500">
                  <ArrowUpRight size={13} /> +{summary.pctChangeVsLastMonth}%
                </span>
              ) : (
                <span className="flex items-center text-emerald-500">
                  <ArrowDownRight size={13} /> {summary.pctChangeVsLastMonth}%
                </span>
              )
            ) : (
              <span className="opacity-50">Same as last mo</span>
            )}
            <span className="opacity-50">vs last mo</span>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-ink/60">
            <span className="text-xs font-bold">Total Income</span>
            <PiggyBank size={16} className="text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatRupees(summary?.incomeMinor || 0)}
          </div>
          <div className="mt-1 text-[11px] opacity-60">
            {summary?.transactionCount || 0} total entries
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-ink/60">
            <span className="text-xs font-bold">Net Balance</span>
            <Sparkles size={16} className="text-accent" />
          </div>
          <div
            className={`mt-2 text-xl font-extrabold ${
              (summary?.netMinor || 0) >= 0 ? 'text-primary' : 'text-rose-500'
            }`}
          >
            {(summary?.netMinor || 0) < 0 && '−'}
            {formatRupees(summary?.netMinor || 0)}
          </div>
          <div className="mt-1 text-[11px] opacity-60">
            {(summary?.netMinor || 0) >= 0 ? 'Saved this month' : 'Deficit this month'}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between text-ink/60">
            <span className="text-xs font-bold">Daily Average</span>
            <Calendar size={16} className="text-sky-500" />
          </div>
          <div className="mt-2 text-xl font-extrabold">
            {formatRupees(summary?.dailyAverageMinor || 0)}
          </div>
          <div className="mt-1 text-[11px] opacity-60">Per day across month</div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 6-Month Income vs Expense Trend */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold">6-Month Trend</h3>
              <p className="text-xs opacity-60">Income vs. Expenses across recent months</p>
            </div>
            <TrendingUp size={18} className="text-primary opacity-60" />
          </div>

          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F87171" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#F87171" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34D399" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }} />
                <YAxis
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                />
                <Tooltip
                  formatter={(val: number) => [`₹${(val / 100).toLocaleString('en-IN')}`, '']}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    backgroundColor: 'var(--color-surface, #fff)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={(d) => d.incomeMinor / 100}
                  name="Income"
                  stroke="#34D399"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorIncome)"
                />
                <Area
                  type="monotone"
                  dataKey={(d) => d.spentMinor / 100}
                  name="Spent"
                  stroke="#F87171"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSpent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Daily Spending Pattern */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold">Daily Spending</h3>
              <p className="text-xs opacity-60">Day-by-day pattern for {monthLabel()}</p>
            </div>
            <BarChart3 size={18} className="text-primary opacity-60" />
          </div>

          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                  interval={2}
                />
                <YAxis
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
                />
                <Tooltip
                  formatter={(val: number) => [`₹${(val / 100).toLocaleString('en-IN')}`, 'Spent']}
                  labelFormatter={(day) => `Day ${day}`}
                  contentStyle={{
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    backgroundColor: 'var(--color-surface, #fff)',
                    fontSize: '12px',
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey={(d) => d.spentMinor / 100}
                  fill="var(--color-primary, #6366F1)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Category Breakdown Section */}
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold">Spending by Category</h3>
            <p className="text-xs opacity-60">Distribution across categories for {monthLabel()}</p>
          </div>
          <PieIcon size={18} className="text-primary opacity-60" />
        </div>

        {categories.length === 0 ? (
          <div className="py-12 text-center opacity-60">
            <p className="text-sm font-bold">No expenses logged for this month</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 items-center gap-6 md:grid-cols-2">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey={(c) => c.spentMinor / 100}
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {categories.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number) => [
                      `₹${Number(val).toLocaleString('en-IN')}`,
                      'Spent',
                    ]}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid rgba(0,0,0,0.1)',
                      backgroundColor: 'var(--color-surface, #fff)',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-col gap-2.5">
              {categories.map((c, i) => (
                <div key={c.category} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-md"
                      style={{
                        backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                      }}
                    />
                    <span className="font-bold">{c.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold">{formatRupees(c.spentMinor)}</span>
                    <span className="w-10 text-right opacity-60 font-semibold">{c.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
