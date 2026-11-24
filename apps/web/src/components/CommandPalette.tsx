import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, NotebookPen, StickyNote, Wallet, ArrowRight, X, Sparkles } from 'lucide-react'
import { apiRequest } from '../lib/api'
import { Go } from '../App'

interface SearchResultItem {
  id: string
  type: 'note' | 'transaction' | 'sticky'
  title: string
  snippet: string
  date?: string
  color?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  go: Go
}

export default function CommandPalette({ isOpen, onClose, go }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    notes: SearchResultItem[]
    transactions: SearchResultItem[]
    stickies: SearchResultItem[]
  }>({ notes: [], transactions: [], stickies: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults({ notes: [], transactions: [], stickies: [] })
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Live search debounced
  useEffect(() => {
    if (!query.trim()) {
      setResults({ notes: [], transactions: [], stickies: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await apiRequest<{
          results: {
            notes: SearchResultItem[]
            transactions: SearchResultItem[]
            stickies: SearchResultItem[]
          }
        }>(`/search?q=${encodeURIComponent(query.trim())}`)
        setResults(res.results || { notes: [], transactions: [], stickies: [] })
        setSelectedIndex(0)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }, 180)

    return () => clearTimeout(timer)
  }, [query])

  // Flattened items for keyboard navigation
  const navigationItems = [
    { id: 'nav-home', type: 'nav', title: 'Go to Home', page: 'home' },
    { id: 'nav-notes', type: 'nav', title: 'Go to My Notes', page: 'notes' },
    { id: 'nav-sticky', type: 'nav', title: 'Go to Sticky Board', page: 'sticky' },
    { id: 'nav-draw', type: 'nav', title: 'Go to Drawing Canvas', page: 'draw' },
    { id: 'nav-finance', type: 'nav', title: 'Go to Finance', page: 'finance' },
    { id: 'nav-budgets', type: 'nav', title: 'Go to Budgets', page: 'budgets' },
    { id: 'nav-goals', type: 'nav', title: 'Go to Savings Goals', page: 'goals' },
    { id: 'nav-insights', type: 'nav', title: 'Go to Insights', page: 'insights' },
    { id: 'nav-settings', type: 'nav', title: 'Go to Settings', page: 'settings' },
  ].filter((item) => !query || item.title.toLowerCase().includes(query.toLowerCase()))

  const allItems: Array<
    | { kind: 'result'; item: SearchResultItem }
    | { kind: 'nav'; title: string; page: string }
  > = [
    ...results.notes.map((item) => ({ kind: 'result' as const, item })),
    ...results.stickies.map((item) => ({ kind: 'result' as const, item })),
    ...results.transactions.map((item) => ({ kind: 'result' as const, item })),
    ...navigationItems.map((n) => ({ kind: 'nav' as const, title: n.title, page: n.page })),
  ]

  const handleSelect = (idx: number) => {
    const entry = allItems[idx]
    if (!entry) return
    if (entry.kind === 'nav') {
      go(entry.page)
    } else {
      if (entry.item.type === 'note') go('notes')
      else if (entry.item.type === 'sticky') go('sticky')
      else if (entry.item.type === 'transaction') go('finance')
    }
    onClose()
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (allItems.length ? (prev + 1) % allItems.length : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (allItems.length ? (prev - 1 + allItems.length) % allItems.length : 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect(selectedIndex)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, allItems, selectedIndex])

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-ink/10 bg-surface shadow-2xl"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 border-b border-ink/10 px-4 py-3.5">
            <Search size={20} className="shrink-0 text-primary opacity-80" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, stickies, transactions, or jump to page..."
              className="flex-1 bg-transparent text-sm font-semibold outline-none placeholder:text-ink/40"
            />
            {loading && (
              <span className="text-[11px] font-bold text-primary animate-pulse">Searching...</span>
            )}
            <button
              onClick={onClose}
              className="rounded-xl p-1 text-ink/40 hover:bg-ink/5 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>

          {/* Results List */}
          <div className="max-h-[60vh] overflow-y-auto p-2">
            {allItems.length === 0 ? (
              <div className="py-12 text-center text-ink/50">
                <Sparkles size={28} className="mx-auto mb-2 opacity-40 text-primary" />
                <p className="text-sm font-bold">No results found</p>
                <p className="text-xs opacity-75">Try searching for keywords or page names</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {results.notes.length > 0 && (
                  <div className="px-3 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-ink/40">
                    Notes
                  </div>
                )}
                {results.notes.map((n) => {
                  const itemIndex = allItems.findIndex(
                    (x) => x.kind === 'result' && x.item.id === n.id
                  )
                  const isSelected = itemIndex === selectedIndex
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleSelect(itemIndex)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        isSelected ? 'bg-primary text-white shadow-soft' : 'hover:bg-primary/10'
                      }`}
                    >
                      <NotebookPen size={18} className="shrink-0 opacity-80" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{n.title}</div>
                        <div
                          className={`text-[11px] truncate ${
                            isSelected ? 'text-white/80' : 'text-ink/60'
                          }`}
                        >
                          {n.snippet}
                        </div>
                      </div>
                      <ArrowRight size={14} className="shrink-0 opacity-60" />
                    </button>
                  )
                })}

                {results.stickies.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-ink/40">
                    Stickies
                  </div>
                )}
                {results.stickies.map((s) => {
                  const itemIndex = allItems.findIndex(
                    (x) => x.kind === 'result' && x.item.id === s.id
                  )
                  const isSelected = itemIndex === selectedIndex
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(itemIndex)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        isSelected ? 'bg-primary text-white shadow-soft' : 'hover:bg-primary/10'
                      }`}
                    >
                      <StickyNote size={18} className="shrink-0 opacity-80" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{s.snippet}</div>
                      </div>
                      <span
                        className="h-3 w-3 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: s.color || '#FDE047' }}
                      />
                    </button>
                  )
                })}

                {results.transactions.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-ink/40">
                    Transactions
                  </div>
                )}
                {results.transactions.map((t) => {
                  const itemIndex = allItems.findIndex(
                    (x) => x.kind === 'result' && x.item.id === t.id
                  )
                  const isSelected = itemIndex === selectedIndex
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelect(itemIndex)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        isSelected ? 'bg-primary text-white shadow-soft' : 'hover:bg-primary/10'
                      }`}
                    >
                      <Wallet size={18} className="shrink-0 opacity-80" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{t.title}</div>
                        <div
                          className={`text-[11px] truncate ${
                            isSelected ? 'text-white/80' : 'text-ink/60'
                          }`}
                        >
                          {t.snippet}
                        </div>
                      </div>
                      <ArrowRight size={14} className="shrink-0 opacity-60" />
                    </button>
                  )
                })}

                {navigationItems.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[11px] font-extrabold uppercase tracking-wider text-ink/40">
                    Quick Navigation
                  </div>
                )}
                {navigationItems.map((n) => {
                  const itemIndex = allItems.findIndex(
                    (x) => x.kind === 'nav' && x.page === n.page
                  )
                  const isSelected = itemIndex === selectedIndex
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleSelect(itemIndex)}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left transition ${
                        isSelected ? 'bg-primary text-white shadow-soft' : 'hover:bg-primary/10'
                      }`}
                    >
                      <span className="text-xs font-bold">{n.title}</span>
                      <ArrowRight size={14} className="opacity-60" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer tips */}
          <div className="flex items-center justify-between border-t border-ink/10 bg-canvas/40 px-4 py-2.5 text-[11px] font-semibold text-ink/50">
            <div className="flex items-center gap-3">
              <span>↑↓ Navigate</span>
              <span>↵ Open</span>
              <span>ESC Close</span>
            </div>
            <div className="hidden sm:inline">Press ⌘K / Ctrl+K anytime</div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
