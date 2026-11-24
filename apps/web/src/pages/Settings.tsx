import { useState, useEffect } from 'react'
import {
  Download,
  Upload,
  Database,
  Palette,
  User,
  LogOut,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react'
import { useStore } from '../store'
import { apiRequest, downloadFile } from '../lib/api'
import ThemeStudio from './ThemeStudio'

type Tab = 'themes' | 'data' | 'migration' | 'account'

export default function Settings() {
  const { currentUser, logout, toast } = useStore()
  const [activeTab, setActiveTab] = useState<Tab>('themes')
  const [exporting, setExporting] = useState<string | null>(null)

  // LocalStorage migration detection
  const [localData, setLocalData] = useState<{
    notesCount: number
    stickiesCount: number
    txCount: number
    goalsCount: number
    hasData: boolean
  }>({ notesCount: 0, stickiesCount: 0, txCount: 0, goalsCount: 0, hasData: false })

  const [migrating, setMigrating] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nimu-state-v1')
      if (raw) {
        const parsed = JSON.parse(raw)
        const s = parsed.state || parsed
        const notesCount = (s.notes || []).length
        const stickiesCount = (s.stickies || []).length
        const txCount = (s.txs || []).length
        const goalsCount = (s.goals || []).length

        setLocalData({
          notesCount,
          stickiesCount,
          txCount,
          goalsCount,
          hasData: notesCount > 0 || stickiesCount > 0 || txCount > 0 || goalsCount > 0,
        })
      }
    } catch {
      // ignore
    }
  }, [])

  const handleExport = async (type: 'notes-md' | 'notes-json' | 'tx-csv' | 'all') => {
    setExporting(type)
    const today = new Date().toISOString().slice(0, 10)
    try {
      if (type === 'notes-md') {
        await downloadFile('/data/export/notes?format=md', `nimu-notes-${today}.md`)
        toast('Notes exported as Markdown')
      } else if (type === 'notes-json') {
        await downloadFile('/data/export/notes?format=json', `nimu-notes-${today}.json`)
        toast('Notes exported as JSON')
      } else if (type === 'tx-csv') {
        await downloadFile('/data/export/transactions?format=csv', `nimu-transactions-${today}.csv`)
        toast('Transactions exported as CSV')
      } else if (type === 'all') {
        await downloadFile('/data/export/all', `nimu-backup-${today}.json`)
        toast('Complete backup exported')
      }
    } catch (err) {
      console.error(err)
      toast('Failed to export data')
    } finally {
      setExporting(null)
    }
  }

  const handleMigrate = async () => {
    setMigrating(true)
    setMigrationStatus(null)
    try {
      const raw = localStorage.getItem('nimu-state-v1')
      if (!raw) {
        toast('No local storage data found')
        return
      }

      const parsed = JSON.parse(raw)
      const s = parsed.state || parsed

      const payload = {
        themeId: s.themeId,
        mode: s.mode,
        budget: s.budget,
        notes: s.notes,
        stickies: s.stickies,
        txs: s.txs,
        goals: s.goals,
        customThemes: s.customThemes,
      }

      const res = await apiRequest<{
        success: boolean
        message: string
        imported: {
          notes: number
          stickies: number
          transactions: number
          goals: number
        }
      }>('/data/import/local-storage', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setMigrationStatus(
        `Imported ${res.imported.notes} notes, ${res.imported.stickies} stickies, ${res.imported.transactions} transactions, and ${res.imported.goals} goals.`
      )
      toast('Existing data brought along safely!')
    } catch (err: any) {
      console.error(err)
      toast('Failed to migrate data')
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Navigation Tabs */}
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Settings & Workspace</h2>
        <p className="mt-1 text-sm opacity-70">
          Personalize your sanctuary, take your notes anywhere, and keep your data safe.
        </p>

        <div className="mt-4 flex flex-wrap gap-2 border-b border-ink/10 pb-3">
          <button
            onClick={() => setActiveTab('themes')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'themes'
                ? 'bg-primary text-white shadow-soft'
                : 'hover:bg-primary/10 text-ink/70'
            }`}
          >
            <Palette size={15} /> Appearance & Themes
          </button>

          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'data'
                ? 'bg-primary text-white shadow-soft'
                : 'hover:bg-primary/10 text-ink/70'
            }`}
          >
            <Download size={15} /> Data Portability
          </button>

          <button
            onClick={() => setActiveTab('migration')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'migration'
                ? 'bg-primary text-white shadow-soft'
                : 'hover:bg-primary/10 text-ink/70'
            }`}
          >
            <Upload size={15} /> Local Data Migration
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              activeTab === 'account'
                ? 'bg-primary text-white shadow-soft'
                : 'hover:bg-primary/10 text-ink/70'
            }`}
          >
            <User size={15} /> Account & Security
          </button>
        </div>
      </div>

      {/* Tab 1: Appearance & Theme Studio */}
      {activeTab === 'themes' && <ThemeStudio />}

      {/* Tab 2: Data Portability (Exports) */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          <section className="card p-5">
            <h3 className="text-base font-extrabold">Your Data, Forever Yours</h3>
            <p className="mt-1 text-xs opacity-70">
              Nimu believes in radical data ownership. Export your notes in standard Markdown with
              frontmatter, your finances as spreadsheets, or a complete single-file backup.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink/10 bg-canvas/30 p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileText size={18} className="text-primary" />
                  Notes as Markdown (.md)
                </div>
                <p className="mt-1 text-xs opacity-60">
                  Clean Markdown files with tags, collections, and YAML frontmatter ready for Obsidian,
                  Logseq, or Bear.
                </p>
                <button
                  onClick={() => handleExport('notes-md')}
                  disabled={exporting !== null}
                  className="btn btn-primary mt-4 w-full text-xs"
                >
                  {exporting === 'notes-md' ? 'Exporting...' : 'Download Markdown'}
                </button>
              </div>

              <div className="rounded-2xl border border-ink/10 bg-canvas/30 p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <FileSpreadsheet size={18} className="text-emerald-500" />
                  Transactions as CSV (.csv)
                </div>
                <p className="mt-1 text-xs opacity-60">
                  Standard comma-separated table with dates, categories, payment methods, and rupees
                  ready for Excel or Sheets.
                </p>
                <button
                  onClick={() => handleExport('tx-csv')}
                  disabled={exporting !== null}
                  className="btn btn-primary mt-4 w-full text-xs"
                >
                  {exporting === 'tx-csv' ? 'Exporting...' : 'Download CSV'}
                </button>
              </div>

              <div className="rounded-2xl border border-ink/10 bg-canvas/30 p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Database size={18} className="text-accent" />
                  Notes as JSON (.json)
                </div>
                <p className="mt-1 text-xs opacity-60">
                  Raw JSON document array with full TipTap ProseMirror content trees and revision
                  counts.
                </p>
                <button
                  onClick={() => handleExport('notes-json')}
                  disabled={exporting !== null}
                  className="btn btn-ghost mt-4 w-full text-xs border border-ink/10"
                >
                  {exporting === 'notes-json' ? 'Exporting...' : 'Download Notes JSON'}
                </button>
              </div>

              <div className="rounded-2xl border border-ink/10 bg-canvas/30 p-4">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Sparkles size={18} className="text-sky-500" />
                  Complete Backup (.json)
                </div>
                <p className="mt-1 text-xs opacity-60">
                  Full backup including custom themes, notes, stickies, drawings, transactions,
                  budgets, and savings goals.
                </p>
                <button
                  onClick={() => handleExport('all')}
                  disabled={exporting !== null}
                  className="btn btn-ghost mt-4 w-full text-xs border border-ink/10"
                >
                  {exporting === 'all' ? 'Exporting...' : 'Download Full Backup'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab 3: Local Storage Migration */}
      {activeTab === 'migration' && (
        <section className="card p-5">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-primary" />
            <h3 className="text-base font-extrabold">
              Bring Your Existing Notes & Expenses Along
            </h3>
          </div>
          <p className="mt-1 text-xs opacity-70">
            If you started using Nimu before creating an account, your notes, stickies, and expenses
            are safely saved in your browser’s local storage. You can migrate them into your cloud
            account with one click.
          </p>

          <div className="mt-6 rounded-2xl border border-ink/10 bg-canvas/40 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink/60">
              Discovered in This Browser
            </h4>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-ink/5 bg-surface p-3 text-center">
                <div className="text-lg font-extrabold text-primary">{localData.notesCount}</div>
                <div className="text-[11px] opacity-60">Notes</div>
              </div>
              <div className="rounded-xl border border-ink/5 bg-surface p-3 text-center">
                <div className="text-lg font-extrabold text-amber-500">
                  {localData.stickiesCount}
                </div>
                <div className="text-[11px] opacity-60">Stickies</div>
              </div>
              <div className="rounded-xl border border-ink/5 bg-surface p-3 text-center">
                <div className="text-lg font-extrabold text-emerald-500">{localData.txCount}</div>
                <div className="text-[11px] opacity-60">Transactions</div>
              </div>
              <div className="rounded-xl border border-ink/5 bg-surface p-3 text-center">
                <div className="text-lg font-extrabold text-accent">{localData.goalsCount}</div>
                <div className="text-[11px] opacity-60">Goals</div>
              </div>
            </div>

            {migrationStatus && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} />
                <span>{migrationStatus}</span>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] opacity-60">
                <HelpCircle size={14} />
                <span>Idempotent: Migrating multiple times will never create duplicate entries.</span>
              </div>
              <button
                onClick={handleMigrate}
                disabled={migrating || !localData.hasData}
                className="btn btn-primary text-xs"
              >
                {migrating ? 'Migrating...' : 'Migrate to My Account'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Tab 4: Account & Security */}
      {activeTab === 'account' && (
        <section className="card p-5 space-y-6">
          <div>
            <h3 className="text-base font-extrabold">Account Details</h3>
            <p className="text-xs opacity-60">Your credentials and session details</p>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-canvas/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-bold">
                {currentUser?.displayName || 'Nimu Companion'}
              </div>
              <div className="text-xs opacity-60">{currentUser?.email || 'Guest Session'}</div>
            </div>

            <button onClick={() => logout()} className="btn btn-ghost text-xs text-rose-500 hover:bg-rose-500/10">
              <LogOut size={15} /> Log Out
            </button>
          </div>

          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-500">
              <ShieldAlert size={18} />
              Session & Safety
            </div>
            <p className="mt-1 text-xs opacity-70">
              Your session uses rotating refresh tokens stored in secure HttpOnly cookies with automatic
              replay detection. Logging out revokes all tokens in your current device family.
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
