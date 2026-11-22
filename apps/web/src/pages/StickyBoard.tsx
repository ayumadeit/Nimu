import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Pin,
  Star,
  Trash2,
  Copy,
  Layers,
  RotateCw,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore, uid } from '../store'

const PASTEL_COLORS = [
  '#FFF3B0', // Yellow
  '#F9C6D4', // Pink
  '#D8CCF7', // Purple
  '#D8F3DC', // Green
  '#BAE6FD', // Sky Blue
  '#FFEDD5', // Peach
]

export interface StickyItem {
  id: string
  text: string
  color: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  isPinned: boolean
  pinnedToDashboard: boolean
  version: number
}

export default function StickyBoard() {
  const { currentUser, stickies: mockStickies, set: setStore, toast } = useStore()
  const [stickies, setStickies] = useState<StickyItem[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const loadStickies = async () => {
    if (currentUser) {
      try {
        const data = await apiRequest('/sticky')
        setStickies(data)
      } catch {
        fallbackLocal()
      }
    } else {
      fallbackLocal()
    }
  }

  const fallbackLocal = () => {
    const converted: StickyItem[] = mockStickies.map((s, idx) => ({
      id: s.id,
      text: s.text,
      color: s.color,
      x: 40 + (idx % 3) * 230,
      y: 40 + Math.floor(idx / 3) * 230,
      width: 210,
      height: 210,
      rotation: s.rot || 0,
      zIndex: idx + 1,
      isPinned: s.pinned,
      pinnedToDashboard: s.pinned,
      version: 1,
    }))
    setStickies(converted)
  }

  useEffect(() => {
    loadStickies()
  }, [currentUser])

  // Add new sticky note
  const handleAddSticky = async () => {
    const newColor = PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)]
    const newX = 40 + (stickies.length % 4) * 50
    const newY = 40 + (stickies.length % 3) * 50
    const rot = Math.floor(Math.random() * 8) - 4

    if (currentUser) {
      try {
        const created = await apiRequest('/sticky', {
          method: 'POST',
          body: JSON.stringify({
            text: 'A little note to self...',
            color: newColor,
            x: newX,
            y: newY,
            rotation: rot,
            pinnedToDashboard: true,
          }),
        })
        setStickies([...stickies, created])
        toast('Added new sticky note!')
      } catch (err: any) {
        toast('Failed to add: ' + err.message)
      }
    } else {
      const newSticky: StickyItem = {
        id: uid(),
        text: 'A little note to self...',
        color: newColor,
        x: newX,
        y: newY,
        width: 210,
        height: 210,
        rotation: rot,
        zIndex: stickies.length + 1,
        isPinned: false,
        pinnedToDashboard: true,
        version: 1,
      }
      setStickies([...stickies, newSticky])
      setStore({
        stickies: [
          ...mockStickies,
          { id: newSticky.id, text: newSticky.text, color: newSticky.color, rot, pinned: true },
        ],
      })
      toast('Added new sticky note!')
    }
  }

  // Update text
  const handleUpdateText = async (id: string, text: string) => {
    setStickies(prev => prev.map(s => (s.id === id ? { ...s, text } : s)))

    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ text }),
        })
      } catch {}
    } else {
      setStore({
        stickies: mockStickies.map(s => (s.id === id ? { ...s, text } : s)),
      })
    }
  }

  // Update color
  const handleChangeColor = async (id: string, color: string) => {
    setStickies(prev => prev.map(s => (s.id === id ? { ...s, color } : s)))
    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ color }),
        })
      } catch {}
    }
  }

  // Toggle Pinned to Dashboard
  const handleToggleDashboard = async (id: string) => {
    const sticky = stickies.find(s => s.id === id)
    if (!sticky) return
    const newVal = !sticky.pinnedToDashboard

    setStickies(prev => prev.map(s => (s.id === id ? { ...s, pinnedToDashboard: newVal } : s)))

    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ pinnedToDashboard: newVal }),
        })
        toast(newVal ? 'Pinned to Dashboard!' : 'Unpinned from Dashboard')
      } catch {}
    } else {
      setStore({
        stickies: mockStickies.map(s => (s.id === id ? { ...s, pinned: newVal } : s)),
      })
      toast(newVal ? 'Pinned to Dashboard!' : 'Unpinned from Dashboard')
    }
  }

  // Rotate note
  const handleRotate = async (id: string) => {
    const sticky = stickies.find(s => s.id === id)
    if (!sticky) return
    const newRot = ((sticky.rotation + 4) % 16) - 8

    setStickies(prev => prev.map(s => (s.id === id ? { ...s, rotation: newRot } : s)))

    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ rotation: newRot }),
        })
      } catch {}
    }
  }

  // Bring to front
  const handleBringToFront = async (id: string) => {
    const maxZ = Math.max(...stickies.map(s => s.zIndex || 1), 1) + 1
    setStickies(prev => prev.map(s => (s.id === id ? { ...s, zIndex: maxZ } : s)))

    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}/bring-to-front`, { method: 'POST' })
      } catch {}
    }
  }

  // Duplicate note
  const handleDuplicate = async (id: string) => {
    if (currentUser) {
      try {
        const copy = await apiRequest(`/sticky/${id}/duplicate`, { method: 'POST' })
        setStickies([...stickies, copy])
        toast('Sticky note duplicated')
      } catch (err: any) {
        toast('Failed to duplicate: ' + err.message)
      }
    }
  }

  // Delete note
  const handleDelete = async (id: string) => {
    setStickies(prev => prev.filter(s => s.id !== id))
    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}`, { method: 'DELETE' })
        toast('Sticky note removed')
      } catch {}
    } else {
      setStore({ stickies: mockStickies.filter(s => s.id !== id) })
      toast('Sticky note removed')
    }
  }

  // On Drag End
  const handleDragEnd = async (id: string, info: any) => {
    const sticky = stickies.find(s => s.id === id)
    if (!sticky) return

    const newX = Math.max(10, sticky.x + info.offset.x)
    const newY = Math.max(10, sticky.y + info.offset.y)

    setStickies(prev => prev.map(s => (s.id === id ? { ...s, x: newX, y: newY } : s)))

    if (currentUser) {
      try {
        await apiRequest(`/sticky/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ x: newX, y: newY }),
        })
      } catch {}
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Board Top Toolbar */}
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Sticky Board</h2>
          <p className="text-xs opacity-60">A cozy pinboard for quick thoughts and reminders.</p>
        </div>
        <button
          onClick={handleAddSticky}
          className="btn btn-primary flex items-center gap-1.5 !px-4 !py-2 text-xs font-bold"
        >
          <Plus size={16} /> New Sticky
        </button>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="card relative flex-1 overflow-hidden border bg-surface/30 p-4 shadow-inner"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(120, 120, 120, 0.15) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      >
        <AnimatePresence>
          {stickies.map(sticky => (
            <motion.div
              key={sticky.id}
              drag
              dragMomentum={false}
              dragConstraints={containerRef}
              onDragEnd={(_, info) => handleDragEnd(sticky.id, info)}
              onClick={() => handleBringToFront(sticky.id)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                rotate: sticky.rotation,
                zIndex: sticky.zIndex,
              }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{
                position: 'absolute',
                left: sticky.x,
                top: sticky.y,
                width: 220,
                minHeight: 200,
                backgroundColor: sticky.color,
              }}
              className="group cursor-grab active:cursor-grabbing rounded-2xl p-4 shadow-lift text-slate-800 flex flex-col justify-between"
            >
              {/* Sticky Top Action Bar */}
              <div className="flex items-center justify-between opacity-40 group-hover:opacity-100 transition">
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleToggleDashboard(sticky.id)
                    }}
                    title="Pin to Dashboard"
                    className={`rounded-md p-1 hover:bg-black/10 transition ${
                      sticky.pinnedToDashboard ? 'text-primary fill-primary' : ''
                    }`}
                  >
                    <LayoutDashboard size={13} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleRotate(sticky.id)
                    }}
                    title="Slight tilt"
                    className="rounded-md p-1 hover:bg-black/10 transition"
                  >
                    <RotateCw size={13} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleBringToFront(sticky.id)
                    }}
                    title="Bring to front"
                    className="rounded-md p-1 hover:bg-black/10 transition"
                  >
                    <Layers size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDuplicate(sticky.id)
                    }}
                    title="Duplicate"
                    className="rounded-md p-1 hover:bg-black/10 transition"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      handleDelete(sticky.id)
                    }}
                    title="Delete"
                    className="rounded-md p-1 hover:bg-black/10 text-red-600 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Text Area */}
              <textarea
                value={sticky.text}
                onChange={e => handleUpdateText(sticky.id, e.target.value)}
                placeholder="Write something..."
                className="font-hand my-2 w-full flex-1 resize-none bg-transparent text-lg font-medium leading-relaxed outline-none placeholder:text-black/30"
              />

              {/* Color Palette Switcher */}
              <div className="flex items-center justify-between border-t border-black/10 pt-2 opacity-30 group-hover:opacity-100 transition">
                <div className="flex items-center gap-1.5">
                  {PASTEL_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={e => {
                        e.stopPropagation()
                        handleChangeColor(sticky.id, c)
                      }}
                      className="h-3.5 w-3.5 rounded-full border border-black/15 transition hover:scale-125"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                {sticky.pinnedToDashboard && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">
                    Dashboard
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
