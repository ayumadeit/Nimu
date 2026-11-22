import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PenTool,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Download,
  FolderOpen,
  Plus,
  Save,
  Palette,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import { useStore, uid } from '../store'

type Tool = 'pen' | 'pencil' | 'highlighter' | 'eraser'
type PaperType = 'blank' | 'lined' | 'dotted' | 'grid' | 'graph'

interface StrokePoint {
  x: number
  y: number
}

interface Stroke {
  tool: Tool
  color: string
  size: number
  opacity: number
  points: StrokePoint[]
}

const PALETTE = ['#2D3748', '#E53E3E', '#DD6B20', '#38A169', '#3182CE', '#805AD5', '#D53F8C', '#ECC94B']

export default function DrawingCanvas() {
  const { currentUser, toast } = useStore()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [title, setTitle] = useState('My Doodle')
  const [paperType, setPaperType] = useState<PaperType>('dotted')
  const [currentTool, setCurrentTool] = useState<Tool>('pen')
  const [currentColor, setCurrentColor] = useState<string>('#2D3748')
  const [strokeSize, setStrokeSize] = useState<number>(3)

  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [redoStack, setRedoStack] = useState<Stroke[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const currentPointsRef = useRef<StrokePoint[]>([])

  const [drawingsList, setDrawingsList] = useState<any[]>([])
  const [listModal, setListModal] = useState(false)

  // Load existing drawings list
  const loadDrawingsList = async () => {
    if (currentUser) {
      try {
        const list = await apiRequest('/drawings')
        setDrawingsList(list)
      } catch {}
    }
  }

  useEffect(() => {
    loadDrawingsList()
  }, [currentUser])

  // Redraw canvas whenever strokes or paperType change
  const redraw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue

      ctx.save()
      ctx.beginPath()
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineWidth = stroke.size * 3
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.tool === 'highlighter' ? stroke.size * 4 : stroke.size
        ctx.globalAlpha = stroke.opacity
      }

      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      }
      ctx.stroke()
      ctx.restore()
    }
  }

  useEffect(() => {
    redraw()
  }, [strokes])

  // Mouse / Touch drawing handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)
    currentPointsRef.current = [{ x, y }]

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, strokeSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = currentTool === 'eraser' ? '#fff' : currentColor
    ctx.fill()
    ctx.restore()
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pts = currentPointsRef.current
    const last = pts[pts.length - 1]
    pts.push({ x, y })

    const ctx = canvas.getContext('2d')
    if (!ctx || !last) return

    ctx.save()
    ctx.beginPath()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = strokeSize * 3
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = currentColor
      ctx.lineWidth = currentTool === 'highlighter' ? strokeSize * 4 : strokeSize
      ctx.globalAlpha = currentTool === 'highlighter' ? 0.35 : currentTool === 'pencil' ? 0.6 : 1
    }

    ctx.moveTo(last.x, last.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.restore()
  }

  const handlePointerUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (currentPointsRef.current.length > 1) {
      const newStroke: Stroke = {
        tool: currentTool,
        color: currentColor,
        size: strokeSize,
        opacity: currentTool === 'highlighter' ? 0.35 : currentTool === 'pencil' ? 0.6 : 1,
        points: [...currentPointsRef.current],
      }
      setStrokes(prev => [...prev, newStroke])
      setRedoStack([])
    }
    currentPointsRef.current = []
  }

  // Undo / Redo / Clear
  const handleUndo = () => {
    if (strokes.length === 0) return
    const last = strokes[strokes.length - 1]
    setRedoStack(prev => [...prev, last])
    setStrokes(prev => prev.slice(0, -1))
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setStrokes(prev => [...prev, next])
  }

  const handleClear = () => {
    setStrokes([])
    setRedoStack([])
  }

  // Save drawing
  const handleSaveDrawing = async () => {
    const canvas = canvasRef.current
    const thumbnailDataUrl = canvas ? canvas.toDataURL('image/png') : ''

    if (currentUser) {
      try {
        if (currentId) {
          await apiRequest(`/drawings/${currentId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              title,
              paperType,
              strokes,
            }),
          })
          await apiRequest(`/drawings/${currentId}/thumbnail`, {
            method: 'POST',
            body: JSON.stringify({ thumbnailDataUrl }),
          })
          toast('Drawing updated!')
        } else {
          const created = await apiRequest('/drawings', {
            method: 'POST',
            body: JSON.stringify({
              title,
              paperType,
              strokes,
            }),
          })
          setCurrentId(created.id)
          await apiRequest(`/drawings/${created.id}/thumbnail`, {
            method: 'POST',
            body: JSON.stringify({ thumbnailDataUrl }),
          })
          toast('Drawing saved!')
        }
        loadDrawingsList()
      } catch (err: any) {
        toast('Save failed: ' + err.message)
      }
    } else {
      toast('Drawing saved to local session!')
    }
  }

  // Export PNG client-side
  const handleExportPng = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
    toast('Exported PNG to downloads!')
  }

  // Open existing drawing
  const handleOpenDrawing = async (item: any) => {
    try {
      const full = await apiRequest(`/drawings/${item.id}`)
      setCurrentId(full.id)
      setTitle(full.title)
      setPaperType(full.paperType)
      setStrokes(full.strokes || [])
      setListModal(false)
      toast(`Opened "${full.title}"`)
    } catch (err: any) {
      toast('Failed to open: ' + err.message)
    }
  }

  // New blank canvas
  const handleNewCanvas = () => {
    setCurrentId(null)
    setTitle('Untitled Drawing')
    setStrokes([])
    setRedoStack([])
    toast('New canvas ready')
  }

  // Paper background style
  const getPaperStyle = () => {
    switch (paperType) {
      case 'lined':
        return {
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgba(0,0,0,0.08) 24px)',
          backgroundSize: '100% 24px',
        }
      case 'grid':
        return {
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }
      case 'graph':
        return {
          backgroundImage:
            'linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
        }
      case 'dotted':
        return {
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.15) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }
      default:
        return {}
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Top Bar: Title & Actions */}
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-transparent text-xl font-extrabold outline-none focus:border-b focus:border-primary"
          />
          <span className="text-xs opacity-40">({strokes.length} strokes)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setListModal(true)}
            className="btn btn-ghost flex items-center gap-1.5 text-xs font-bold"
          >
            <FolderOpen size={15} /> My Drawings
          </button>
          <button
            onClick={handleNewCanvas}
            className="btn btn-ghost flex items-center gap-1.5 text-xs font-bold"
          >
            <Plus size={15} /> New
          </button>
          <button
            onClick={handleSaveDrawing}
            className="btn btn-primary flex items-center gap-1.5 !px-3.5 !py-1.5 text-xs font-bold"
          >
            <Save size={15} /> Save
          </button>
          <button
            onClick={handleExportPng}
            className="btn btn-ghost flex items-center gap-1.5 text-xs font-bold"
            title="Download PNG"
          >
            <Download size={15} /> Export PNG
          </button>
        </div>
      </div>

      {/* Main Studio Area */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Tools Palette Sidebar */}
        <div className="card flex w-56 flex-col gap-4 p-4 shadow-soft">
          {/* Tools */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Tool</label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'pen', label: 'Pen', icon: PenTool },
                  { id: 'highlighter', label: 'Highlight', icon: Highlighter },
                  { id: 'eraser', label: 'Eraser', icon: Eraser },
                ] as const
              ).map(t => (
                <button
                  key={t.id}
                  onClick={() => setCurrentTool(t.id)}
                  className={`flex items-center gap-2 rounded-xl p-2 text-xs font-bold transition ${
                    currentTool === t.id ? 'bg-primary text-white shadow-soft' : 'hover:bg-primary/10'
                  }`}
                >
                  <t.icon size={15} /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Palette */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Color</label>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {PALETTE.map(c => (
                <button
                  key={c}
                  onClick={() => setCurrentColor(c)}
                  className={`h-7 w-7 rounded-full border transition hover:scale-110 ${
                    currentColor === c ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">
              Size ({strokeSize}px)
            </label>
            <input
              type="range"
              min={1}
              max={24}
              value={strokeSize}
              onChange={e => setStrokeSize(Number(e.target.value))}
              className="mt-2 w-full accent-primary"
            />
          </div>

          {/* Paper Type */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider opacity-60">Paper</label>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] font-semibold">
              {(['blank', 'lined', 'dotted', 'grid', 'graph'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPaperType(p)}
                  className={`rounded-lg py-1 capitalize transition ${
                    paperType === p ? 'bg-primary/15 text-primary font-bold' : 'hover:bg-primary/5'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas Actions */}
          <div className="mt-auto flex items-center justify-between border-t pt-3">
            <div className="flex gap-1">
              <button
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="btn btn-ghost !p-2 disabled:opacity-30"
                title="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="btn btn-ghost !p-2 disabled:opacity-30"
                title="Redo"
              >
                <Redo2 size={16} />
              </button>
            </div>
            <button
              onClick={handleClear}
              className="btn btn-ghost !p-2 text-accent"
              title="Clear Canvas"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Canvas Workspace */}
        <div className="card relative flex-1 flex items-center justify-center overflow-auto p-4 bg-surface/40 shadow-lift">
          <canvas
            ref={canvasRef}
            width={850}
            height={620}
            style={getPaperStyle()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="rounded-2xl bg-white shadow-soft cursor-crosshair touch-none"
          />
        </div>
      </div>

      {/* DRAWINGS LIST MODAL */}
      <AnimatePresence>
        {listModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card w-full max-w-lg p-6 shadow-lift"
            >
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-extrabold text-base">Saved Drawings</h3>
                <button
                  onClick={() => setListModal(false)}
                  className="rounded-lg p-1 text-xs font-bold opacity-60 hover:opacity-100"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
                {drawingsList.length === 0 ? (
                  <p className="text-xs opacity-50 py-4 text-center">No saved drawings yet.</p>
                ) : (
                  drawingsList.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenDrawing(item)}
                      className="flex items-center justify-between rounded-xl bg-surface/50 p-3 text-xs cursor-pointer hover:bg-primary/10 transition"
                    >
                      <div>
                        <div className="font-bold">{item.title}</div>
                        <div className="text-[11px] opacity-50 capitalize">
                          {item.paperType} paper • {new Date(item.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-primary">Open →</span>
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
