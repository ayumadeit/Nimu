import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Pin,
  Star,
  Trash2,
  Copy,
  Archive,
  History,
  Folder,
  Tag as TagIcon,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookOpen,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore, uid } from '../store'

export interface NoteItem {
  id: string
  title: string
  content: any
  plainText: string
  excerpt: string
  wordCount: number
  version: number
  isPinned: boolean
  isFavorite: boolean
  isArchived: boolean
  collectionId?: string | null
  collection?: { id: string; name: string; color?: string } | null
  tags?: { id: string; name: string; color?: string }[]
  updatedAt: string | number
  createdAt?: string
}

export default function Notes() {
  const { currentUser, guestMode, toast, notes: mockNotes, set: setStore } = useStore()

  const [notes, setNotes] = useState<NoteItem[]>([])
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'pinned' | 'favorites' | 'archived'>('all')

  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [conflictModal, setConflictModal] = useState(false)
  const [revisionsModal, setRevisionsModal] = useState(false)
  const [revisions, setRevisions] = useState<any[]>([])

  // Editor local form state
  const [title, setTitle] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [currentVersion, setCurrentVersion] = useState(1)

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load notes, collections & tags
  const loadData = async () => {
    if (currentUser) {
      try {
        const queryParams = new URLSearchParams()
        if (searchQuery) queryParams.set('q', searchQuery)
        if (selectedCollection) queryParams.set('collectionId', selectedCollection)
        if (selectedTag) queryParams.set('tag', selectedTag)
        if (activeTab === 'pinned') queryParams.set('pinned', 'true')
        if (activeTab === 'favorites') queryParams.set('favorite', 'true')
        if (activeTab === 'archived') queryParams.set('archived', 'true')

        const [notesRes, collectionsRes, tagsRes] = await Promise.all([
          apiRequest(`/notes?${queryParams.toString()}`),
          apiRequest('/notes/collections'),
          apiRequest('/notes/tags'),
        ])

        setNotes(notesRes.notes)
        setCollections(collectionsRes)
        setTags(tagsRes)

        if (notesRes.notes.length > 0 && !selectedId) {
          const first = notesRes.notes[0]
          setSelectedId(first.id)
          setTitle(first.title)
          setBodyText(first.plainText || '')
          setCurrentVersion(first.version || 1)
        }
      } catch {
        // Fallback to local store
        fallbackToLocal()
      }
    } else {
      fallbackToLocal()
    }
  }

  const fallbackToLocal = () => {
    const converted: NoteItem[] = mockNotes.map(n => ({
      id: n.id,
      title: n.title,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: n.body }] }] },
      plainText: n.body,
      excerpt: n.body.slice(0, 100),
      wordCount: n.body.split(/\s+/).filter(Boolean).length,
      version: 1,
      isPinned: false,
      isFavorite: false,
      isArchived: false,
      tags: n.tags.map(t => ({ id: t, name: t })),
      updatedAt: n.updatedAt,
    }))
    setNotes(converted)
    if (converted.length > 0 && !selectedId) {
      setSelectedId(converted[0].id)
      setTitle(converted[0].title)
      setBodyText(converted[0].plainText)
    }
  }

  useEffect(() => {
    loadData()
  }, [searchQuery, selectedCollection, selectedTag, activeTab, currentUser])

  // Select note handler
  const handleSelectNote = (note: NoteItem) => {
    setSelectedId(note.id)
    setTitle(note.title)
    setBodyText(note.plainText || '')
    setCurrentVersion(note.version || 1)
  }

  // Autosave handler (debounced by ~800ms)
  const triggerAutosave = (newTitle: string, newBody: string) => {
    if (!selectedId) return
    setSavingStatus('saving')

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = setTimeout(async () => {
      const tipTapDoc = {
        type: 'doc',
        content: newBody
          .split('\n')
          .filter(Boolean)
          .map(line => ({
            type: 'paragraph',
            content: [{ type: 'text', text: line }],
          })),
      }

      if (currentUser) {
        try {
          const updated = await apiRequest(`/notes/${selectedId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title: newTitle,
              content: tipTapDoc,
              version: currentVersion,
            }),
          })
          setCurrentVersion(updated.version)
          setNotes(prev =>
            prev.map(n =>
              n.id === selectedId
                ? {
                    ...n,
                    title: updated.title,
                    plainText: updated.plainText,
                    excerpt: updated.excerpt,
                    wordCount: updated.wordCount,
                    version: updated.version,
                    updatedAt: updated.updatedAt,
                  }
                : n
            )
          )
          setSavingStatus('saved')
          setTimeout(() => setSavingStatus('idle'), 2000)
        } catch (err: any) {
          if (err.status === 409 || err.code === 'CONCURRENCY_CONFLICT') {
            setConflictModal(true)
          }
          setSavingStatus('idle')
        }
      } else {
        // Guest mode offline
        setStore({
          notes: mockNotes.map(n =>
            n.id === selectedId ? { ...n, title: newTitle, body: newBody, updatedAt: Date.now() } : n
          ),
        })
        setSavingStatus('saved')
        setTimeout(() => setSavingStatus('idle'), 2000)
      }
    }, 800)
  }

  // Create Note
  const handleCreateNote = async () => {
    const initialTitle = 'Untitled Note'
    const initialContent = { type: 'doc', content: [] }

    if (currentUser) {
      try {
        const created = await apiRequest('/notes', {
          method: 'POST',
          body: JSON.stringify({
            title: initialTitle,
            content: initialContent,
            collectionId: selectedCollection,
            tagIds: selectedTag ? [selectedTag] : [],
          }),
        })
        setNotes([created, ...notes])
        handleSelectNote(created)
        toast('New note created')
      } catch (err: any) {
        toast('Failed to create note: ' + err.message)
      }
    } else {
      const newMock = {
        id: uid(),
        title: initialTitle,
        body: '',
        updatedAt: Date.now(),
        tags: [],
      }
      setStore({ notes: [newMock, ...mockNotes] })
      fallbackToLocal()
      setSelectedId(newMock.id)
      setTitle(initialTitle)
      setBodyText('')
      toast('New note created')
    }
  }

  // Delete Note
  const handleDeleteNote = async (id: string) => {
    if (currentUser) {
      try {
        await apiRequest(`/notes/${id}`, { method: 'DELETE' })
        setNotes(notes.filter(n => n.id !== id))
        if (selectedId === id) {
          const remaining = notes.filter(n => n.id !== id)
          if (remaining.length > 0) handleSelectNote(remaining[0])
          else setSelectedId(null)
        }
        toast('Note moved to trash')
      } catch (err: any) {
        toast('Error: ' + err.message)
      }
    } else {
      setStore({ notes: mockNotes.filter(n => n.id !== id) })
      setNotes(notes.filter(n => n.id !== id))
      if (selectedId === id) setSelectedId(null)
      toast('Note removed')
    }
  }

  // Duplicate Note
  const handleDuplicateNote = async (id: string) => {
    if (currentUser) {
      try {
        const copy = await apiRequest(`/notes/${id}/duplicate`, { method: 'POST' })
        setNotes([copy, ...notes])
        handleSelectNote(copy)
        toast('Note duplicated')
      } catch (err: any) {
        toast('Failed to duplicate: ' + err.message)
      }
    }
  }

  // Toggle Pin / Favorite / Archive
  const handleToggleProp = async (id: string, prop: 'isPinned' | 'isFavorite' | 'isArchived') => {
    const current = notes.find(n => n.id === id)
    if (!current) return
    const newVal = !current[prop]

    if (currentUser) {
      try {
        await apiRequest(`/notes/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ [prop]: newVal }),
        })
        setNotes(notes.map(n => (n.id === id ? { ...n, [prop]: newVal } : n)))
        toast(newVal ? `Marked as ${prop.slice(2).toLowerCase()}` : 'Updated')
      } catch {}
    } else {
      setNotes(notes.map(n => (n.id === id ? { ...n, [prop]: newVal } : n)))
    }
  }

  // View Revisions
  const handleViewRevisions = async () => {
    if (!selectedId || !currentUser) return
    try {
      const revs = await apiRequest(`/notes/${selectedId}/revisions`)
      setRevisions(revs)
      setRevisionsModal(true)
    } catch {}
  }

  // Restore Revision
  const handleRestoreRevision = async (revId: string) => {
    if (!selectedId || !currentUser) return
    try {
      const restored = await apiRequest(`/notes/${selectedId}/revisions/${revId}/restore`, {
        method: 'POST',
      })
      setTitle(restored.title)
      setBodyText(restored.plainText)
      setCurrentVersion(restored.version)
      setRevisionsModal(false)
      toast('Restored previous version!')
    } catch (err: any) {
      toast('Failed to restore: ' + err.message)
    }
  }

  const selectedNote = notes.find(n => n.id === selectedId)

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[500px] gap-4">
      {/* LEFT: Sidebar / Notes List */}
      <div className="card flex w-80 shrink-0 flex-col overflow-hidden p-3 shadow-soft">
        {/* Search & New Note */}
        <div className="flex items-center gap-2 pb-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full rounded-xl border bg-surface/60 py-1.5 pl-8 pr-2 text-xs font-semibold outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleCreateNote}
            className="btn btn-primary !p-2"
            title="Create new note"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 border-b pb-2 text-[11px] font-bold">
          {(['all', 'pinned', 'favorites', 'archived'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-2 py-1 capitalize transition ${
                activeTab === tab ? 'bg-primary/15 text-primary' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Notes Items */}
        <div className="flex-1 overflow-y-auto pt-2 space-y-1.5">
          {notes.length === 0 ? (
            <div className="py-12 text-center text-xs opacity-50">
              <BookOpen size={24} className="mx-auto mb-2 opacity-30" />
              No notes found.
            </div>
          ) : (
            notes.map(note => {
              const active = note.id === selectedId
              return (
                <div
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className={`group relative cursor-pointer rounded-2xl p-3 transition ${
                    active ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'hover:bg-primary/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="truncate text-xs font-bold">{note.title || 'Untitled'}</h3>
                    <div className="flex items-center gap-1 opacity-60">
                      {note.isPinned && <Pin size={11} className="text-primary fill-primary" />}
                      {note.isFavorite && <Star size={11} className="text-accent fill-accent" />}
                    </div>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] opacity-70">
                    {note.plainText || note.excerpt || 'Empty note...'}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] opacity-50">
                    <span>
                      {typeof note.updatedAt === 'number'
                        ? new Date(note.updatedAt).toLocaleDateString()
                        : new Date(note.updatedAt).toLocaleDateString()}
                    </span>
                    <span>{note.wordCount || 0} words</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* RIGHT: Note Editor */}
      <div className="card flex flex-1 flex-col overflow-hidden p-6 shadow-lift">
        {selectedNote ? (
          <>
            {/* Header Toolbar */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleProp(selectedNote.id, 'isPinned')}
                  title="Pin note"
                  className={`rounded-lg p-1.5 transition ${
                    selectedNote.isPinned ? 'bg-primary/20 text-primary' : 'hover:bg-surface'
                  }`}
                >
                  <Pin size={16} />
                </button>
                <button
                  onClick={() => handleToggleProp(selectedNote.id, 'isFavorite')}
                  title="Favorite note"
                  className={`rounded-lg p-1.5 transition ${
                    selectedNote.isFavorite ? 'bg-accent/20 text-accent' : 'hover:bg-surface'
                  }`}
                >
                  <Star size={16} />
                </button>
                <button
                  onClick={() => handleDuplicateNote(selectedNote.id)}
                  title="Duplicate note"
                  className="rounded-lg p-1.5 hover:bg-surface transition"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={handleViewRevisions}
                  title="Version history"
                  className="rounded-lg p-1.5 hover:bg-surface transition"
                >
                  <History size={16} />
                </button>
                <button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  title="Move to trash"
                  className="rounded-lg p-1.5 text-accent hover:bg-accent/15 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Autosave Feedback */}
              <div className="flex items-center gap-2 text-xs font-semibold">
                {savingStatus === 'saving' && (
                  <span className="flex items-center gap-1.5 text-secondary">
                    <Clock size={13} className="animate-spin" /> Saving...
                  </span>
                )}
                {savingStatus === 'saved' && (
                  <span className="flex items-center gap-1.5 text-primary">
                    <CheckCircle2 size={13} /> Safely tucked away
                  </span>
                )}
                {savingStatus === 'idle' && (
                  <span className="text-[11px] opacity-40">v{currentVersion}</span>
                )}
              </div>
            </div>

            {/* Title & Body */}
            <div className="flex flex-1 flex-col pt-4">
              <input
                type="text"
                value={title}
                onChange={e => {
                  setTitle(e.target.value)
                  triggerAutosave(e.target.value, bodyText)
                }}
                placeholder="Note title..."
                className="w-full bg-transparent text-2xl font-black outline-none placeholder:opacity-30"
              />

              <textarea
                value={bodyText}
                onChange={e => {
                  setBodyText(e.target.value)
                  triggerAutosave(title, e.target.value)
                }}
                placeholder="Write your thoughts, ideas, plans..."
                className="mt-4 flex-1 w-full resize-none bg-transparent font-medium leading-relaxed outline-none placeholder:opacity-30"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center opacity-60">
            <BookOpen size={48} className="mb-3 opacity-30 text-primary" />
            <h3 className="text-lg font-bold">Select or create a note</h3>
            <p className="mt-1 text-xs">Your personal writing sanctuary.</p>
            <button onClick={handleCreateNote} className="btn btn-primary mt-4 text-xs font-bold">
              <Plus size={14} className="mr-1 inline" /> New Note
            </button>
          </div>
        )}
      </div>

      {/* REVISIONS HISTORY MODAL */}
      <AnimatePresence>
        {revisionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card w-full max-w-lg p-6 shadow-lift"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base">Revision History (Last 20)</h3>
                <button
                  onClick={() => setRevisionsModal(false)}
                  className="rounded-lg p-1 text-xs font-bold opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
                {revisions.length === 0 ? (
                  <p className="text-xs opacity-50 py-4 text-center">No past revisions recorded yet.</p>
                ) : (
                  revisions.map((rev: any) => (
                    <div
                      key={rev.id}
                      className="flex items-center justify-between rounded-xl bg-surface/50 p-3 text-xs"
                    >
                      <div>
                        <div className="font-bold">{rev.title}</div>
                        <div className="text-[11px] opacity-50">
                          {new Date(rev.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreRevision(rev.id)}
                        className="btn btn-ghost !py-1 !px-3 text-xs font-bold text-primary"
                      >
                        Restore
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CONCURRENCY CONFLICT MODAL */}
      <AnimatePresence>
        {conflictModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card w-full max-w-md p-6 shadow-lift text-center"
            >
              <h3 className="font-extrabold text-lg text-accent">This note changed elsewhere</h3>
              <p className="mt-2 text-xs opacity-75">
                A newer version was saved from another session or tab. Reload to see the latest changes.
              </p>
              <button
                onClick={() => {
                  setConflictModal(false)
                  loadData()
                }}
                className="btn btn-primary mt-6 !px-6 !py-2 text-xs font-bold"
              >
                Reload latest version
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
