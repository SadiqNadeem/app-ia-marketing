'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { fabric } from 'fabric'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, BookmarkPlus, Calendar, Circle,
  Eye, EyeOff, FileText, ImagePlus, Info, Italic, LayoutGrid, Minus,
  MousePointer, Image as ImageIcon, PanelTop, Play, Redo2, RectangleHorizontal,
  Smartphone, Square, Trash2, Triangle, Type, Underline, Undo2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { SocialPlatform } from '@/types'
import type { PostFormat } from '@/lib/post-formats'
import { getThumbSize } from '@/lib/post-formats'

const FONTS = [
  'Inter', 'Playfair Display', 'Montserrat',
  'Roboto', 'Oswald', 'Dancing Script',
]

type LeftTab = 'templates' | 'layers'
type ObjType = 'text' | 'image' | 'shape' | null

interface LayerItem {
  obj: fabric.Object
  name: string
  type: 'text' | 'image' | 'shape'
  visible: boolean
}

export interface TemplateToLoad {
  id: string
  title: string
  fabric_json: object
  canvas_width: number
  canvas_height: number
}

export interface PostEditorProps {
  platform: SocialPlatform | null
  postType?: string | null
  format?: PostFormat | null
  businessName: string
  businessLogoUrl?: string | null
  initialImageUrl?: string | null
  isAdmin?: boolean
  templateToLoad?: TemplateToLoad | null
  onClearTemplate?: () => void
  onExport: (imageDataUrl: string) => void
}

// ── Default canvas dimensions when no format provided ─────────────────────────
const CANVAS_CONFIGS: Record<string, [number, number, number, number]> = {
  instagram: [1080, 1080, 480, 480],
  tiktok:    [1080, 1920, 270, 480],
  facebook:  [1200, 630,  480, 252],
  whatsapp:  [1080, 1080, 480, 480],
  default:   [1080, 1080, 480, 480],
}

// ── Platform badge colors ─────────────────────────────────────────────────────
const PLATFORM_COLORS: Partial<Record<SocialPlatform, string>> = {
  instagram: '#E1306C',
  facebook:  '#1877F2',
  tiktok:    '#111827',
  whatsapp:  '#25D366',
  google:    '#4285F4',
}

// ── Icon map for format icons ─────────────────────────────────────────────────
const FORMAT_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Square:              Square,
  Smartphone:          Smartphone,
  LayoutGrid:          LayoutGrid,
  RectangleHorizontal: RectangleHorizontal,
  PanelTop:            PanelTop,
  Calendar:            Calendar,
  FileText:            FileText,
  Play:                Play,
}

// ── Template definitions ──────────────────────────────────────────────────────

function buildTemplates(w: number, h: number) {
  return [
    {
      id: 'dark-bold',
      name: 'Fondo oscuro',
      thumbBg: '#1A1A1A',
      thumbAccent: '#1A56DB',
      apply(canvas: fabric.Canvas) {
        canvas.clear()
        canvas.setBackgroundColor('#1A1A1A', canvas.renderAll.bind(canvas))
        canvas.add(
          new fabric.IText('Tu titulo aqui', {
            left: w / 2, top: h * 0.35, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.083), fontWeight: 'bold', fill: '#FFFFFF',
            fontFamily: 'Inter', textAlign: 'center', name: 'Titulo',
          } as fabric.ITextOptions),
          new fabric.IText('Subtitulo o descripcion', {
            left: w / 2, top: h * 0.55, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.038), fill: '#9CA3AF',
            fontFamily: 'Inter', textAlign: 'center', name: 'Subtitulo',
          } as fabric.ITextOptions),
          new fabric.Rect({
            left: 0, top: h - 8, width: w, height: 8,
            fill: '#1A56DB', selectable: true, name: 'Barra decorativa',
          }),
        )
        canvas.renderAll()
      },
    },
    {
      id: 'light-minimal',
      name: 'Minimalista',
      thumbBg: '#FAFAFA',
      thumbAccent: '#1A56DB',
      apply(canvas: fabric.Canvas) {
        canvas.clear()
        canvas.setBackgroundColor('#FAFAFA', canvas.renderAll.bind(canvas))
        canvas.add(
          new fabric.Rect({
            left: 0, top: 0, width: w, height: Math.round(h * 0.015),
            fill: '#1A56DB', name: 'Barra superior',
          }),
          new fabric.IText('Titulo del post', {
            left: w / 2, top: h * 0.42, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.1), fontWeight: 'bold', fill: '#111827',
            fontFamily: 'Inter', textAlign: 'center', name: 'Titulo',
          } as fabric.ITextOptions),
          new fabric.IText('Descripcion breve', {
            left: w / 2, top: h * 0.6, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.042), fill: '#6B7280',
            fontFamily: 'Inter', textAlign: 'center', name: 'Descripcion',
          } as fabric.ITextOptions),
        )
        canvas.renderAll()
      },
    },
    {
      id: 'blue-solid',
      name: 'Fondo azul',
      thumbBg: '#1A56DB',
      thumbAccent: '#FFFFFF',
      apply(canvas: fabric.Canvas) {
        canvas.clear()
        canvas.setBackgroundColor('#1A56DB', canvas.renderAll.bind(canvas))
        canvas.add(
          new fabric.IText('Tu mensaje aqui', {
            left: w / 2, top: h * 0.4, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.083), fontWeight: 'bold', fill: '#FFFFFF',
            fontFamily: 'Inter', textAlign: 'center', name: 'Titulo',
          } as fabric.ITextOptions),
          new fabric.IText('Mas informacion aqui', {
            left: w / 2, top: h * 0.58, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.042), fill: 'rgba(255,255,255,0.75)',
            fontFamily: 'Inter', textAlign: 'center', name: 'Subtitulo',
          } as fabric.ITextOptions),
        )
        canvas.renderAll()
      },
    },
    {
      id: 'framed',
      name: 'Marco clasico',
      thumbBg: '#F9FAFB',
      thumbAccent: '#1A56DB',
      apply(canvas: fabric.Canvas) {
        canvas.clear()
        canvas.setBackgroundColor('#F9FAFB', canvas.renderAll.bind(canvas))
        const m = Math.round(w * 0.05)
        canvas.add(
          new fabric.Rect({
            left: m, top: m, width: w - m * 2, height: h - m * 2,
            fill: 'transparent', stroke: '#1A56DB',
            strokeWidth: Math.max(2, Math.round(w * 0.008)),
            rx: 8, ry: 8, name: 'Marco',
          }),
          new fabric.IText('Titulo del post', {
            left: w / 2, top: h * 0.42, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.075), fontWeight: 'bold', fill: '#111827',
            fontFamily: 'Playfair Display', textAlign: 'center', name: 'Titulo',
          } as fabric.ITextOptions),
          new fabric.IText('Tu negocio · Tu mensaje', {
            left: w / 2, top: h * 0.58, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.038), fill: '#1A56DB',
            fontFamily: 'Inter', textAlign: 'center', name: 'Subtitulo',
          } as fabric.ITextOptions),
        )
        canvas.renderAll()
      },
    },
    {
      id: 'offer',
      name: 'Precio / Oferta',
      thumbBg: '#111827',
      thumbAccent: '#F59E0B',
      apply(canvas: fabric.Canvas) {
        canvas.clear()
        canvas.setBackgroundColor('#111827', canvas.renderAll.bind(canvas))
        canvas.add(
          new fabric.IText('OFERTA ESPECIAL', {
            left: w / 2, top: h * 0.2, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.05), fontWeight: 'bold', fill: '#EF4444',
            fontFamily: 'Montserrat', textAlign: 'center',
            charSpacing: 150, name: 'Badge',
          } as fabric.ITextOptions),
          new fabric.IText('99€', {
            left: w / 2, top: h * 0.46, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.2), fontWeight: 'bold', fill: '#F59E0B',
            fontFamily: 'Montserrat', textAlign: 'center', name: 'Precio',
          } as fabric.ITextOptions),
          new fabric.IText('Disponible por tiempo limitado', {
            left: w / 2, top: h * 0.76, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.038), fill: 'rgba(255,255,255,0.85)',
            fontFamily: 'Inter', textAlign: 'center', name: 'CTA',
          } as fabric.ITextOptions),
        )
        canvas.renderAll()
      },
    },
    {
      id: 'testimonial',
      name: 'Testimonio',
      thumbBg: '#FFFFFF',
      thumbAccent: '#DBEAFE',
      apply(canvas: fabric.Canvas) {
        canvas.clear()
        canvas.setBackgroundColor('#FFFFFF', canvas.renderAll.bind(canvas))
        canvas.add(
          new fabric.Text('"', {
            left: w / 2, top: h * 0.18, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.25), fontWeight: 'bold', fill: '#DBEAFE',
            fontFamily: 'Georgia', name: 'Comillas',
          } as fabric.TextOptions),
          new fabric.IText('El mejor servicio que he probado.\nTotalmente recomendado.', {
            left: w / 2, top: h * 0.47, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.05), fontStyle: 'italic', fill: '#374151',
            fontFamily: 'Playfair Display', textAlign: 'center',
            lineHeight: 1.5, name: 'Testimonio',
          } as fabric.ITextOptions),
          new fabric.IText('— Nombre del cliente', {
            left: w / 2, top: h * 0.75, originX: 'center', originY: 'center',
            fontSize: Math.round(h * 0.038), fontWeight: 'bold', fill: '#1A56DB',
            fontFamily: 'Inter', textAlign: 'center', name: 'Autor',
          } as fabric.ITextOptions),
        )
        canvas.renderAll()
      },
    },
  ]
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getObjName(obj: fabric.Object, index: number): string {
  return (obj as fabric.Object & { name?: string }).name ?? `Objeto ${index + 1}`
}

function getObjType(obj: fabric.Object): 'text' | 'image' | 'shape' {
  if (obj instanceof fabric.IText || obj instanceof fabric.Text) return 'text'
  if (obj instanceof fabric.Image) return 'image'
  return 'shape'
}

// ── Shared micro-styles ───────────────────────────────────────────────────────
const PROP_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#9CA3AF',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 4, display: 'block',
}
const PROP_INPUT: React.CSSProperties = {
  width: '100%', border: '1px solid #E5E7EB', borderRadius: 6,
  padding: '6px 10px', fontSize: 13, color: '#374151',
  outline: 'none', boxSizing: 'border-box', background: '#FFFFFF',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PostEditor({
  platform,
  postType,
  format,
  businessLogoUrl,
  initialImageUrl,
  isAdmin = false,
  templateToLoad,
  onClearTemplate,
  onExport,
}: PostEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)
  const prevFormatRef = useRef<PostFormat | null>(null)

  const [leftTab, setLeftTab] = useState<LeftTab>('templates')
  const [selectedObj, setSelectedObj] = useState<fabric.Object | null>(null)
  const [objType, setObjType] = useState<ObjType>(null)
  const [layers, setLayers] = useState<LayerItem[]>([])
  const [bgColor, setBgColor] = useState('#ffffff')
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  // Save-template modal
  const [saveModal, setSaveModal] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saveCategory, setSaveCategory] = useState('flyer')
  const [savePlatform, setSavePlatform] = useState('instagram')
  const [saveBizTypes, setSaveBizTypes] = useState<string[]>(['restaurante'])
  const [saveActive, setSaveActive] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Template-loaded hint toast
  const [showTemplateHint, setShowTemplateHint] = useState(false)

  // History
  const historyRef = useRef<object[]>([])
  const historyIdxRef = useRef(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Text props
  const [textContent, setTextContent] = useState('')
  const [fontFamily, setFontFamily] = useState('Inter')
  const [fontSize, setFontSize] = useState(40)
  const [textColor, setTextColor] = useState('#111827')
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [textAlign, setTextAlign] = useState('left')

  // Shape props
  const [fillColor, setFillColor] = useState('#1A56DB')
  const [strokeColor, setStrokeColor] = useState('#E5E7EB')
  const [strokeWidth, setStrokeWidth] = useState(0)
  const [cornerRadius, setCornerRadius] = useState(0)

  // Image props
  const [imgBrightness, setImgBrightness] = useState(0)
  const [imgContrast, setImgContrast] = useState(0)
  const [imgFilter, setImgFilter] = useState('none')

  // Common props
  const [objOpacity, setObjOpacity] = useState(100)
  const [objX, setObjX] = useState(0)
  const [objY, setObjY] = useState(0)
  const [objAngle, setObjAngle] = useState(0)

  // Resolve display dimensions
  const cfgKey = platform ?? 'default'
  const [realWFallback, , dispWFallback, dispHFallback] =
    CANVAS_CONFIGS[cfgKey] ?? CANVAS_CONFIGS.default

  const dispW = format?.displayWidth ?? dispWFallback
  const dispH = format?.displayHeight ?? dispHFallback
  const realW = format?.realWidth ?? realWFallback
  const multiplier = realW / dispW

  // Load Google Fonts once
  useEffect(() => {
    const id = 'post-editor-gfonts'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Roboto:wght@400;700&family=Oswald:wght@400;600&family=Dancing+Script:wght@400;700&display=swap'
    document.head.appendChild(link)
  }, [])

  // ── History helpers ───────────────────────────────────────────────────────

  const pushHistory = useCallback((fc: fabric.Canvas) => {
    const snap = fc.toJSON(['name'])
    const next = [...historyRef.current.slice(0, historyIdxRef.current + 1), snap]
    historyRef.current = next
    historyIdxRef.current = next.length - 1
    setCanUndo(next.length > 1)
    setCanRedo(false)
  }, [])

  const rebuildLayers = useCallback((fc: fabric.Canvas) => {
    const items: LayerItem[] = fc
      .getObjects()
      .map((obj, i) => ({
        obj,
        name: getObjName(obj, i),
        type: getObjType(obj),
        visible: obj.visible !== false,
      }))
      .reverse()
    setLayers(items)
  }, [])

  const syncFromObj = useCallback((obj: fabric.Object) => {
    setObjX(Math.round(obj.left ?? 0))
    setObjY(Math.round(obj.top ?? 0))
    setObjAngle(Math.round(obj.angle ?? 0))
    setObjOpacity(Math.round((obj.opacity ?? 1) * 100))

    const t = getObjType(obj)
    setObjType(t)

    if (t === 'text') {
      const it = obj as fabric.IText
      setTextContent(it.text ?? '')
      setFontFamily(it.fontFamily ?? 'Inter')
      setFontSize(it.fontSize ?? 40)
      setTextColor(it.fill as string ?? '#111827')
      setIsBold(it.fontWeight === 'bold')
      setIsItalic(it.fontStyle === 'italic')
      setIsUnderline(!!it.underline)
      setTextAlign(it.textAlign ?? 'left')
    } else if (t === 'shape') {
      const s = obj as fabric.Rect
      setFillColor(s.fill as string ?? '#1A56DB')
      setStrokeColor(s.stroke as string ?? '#E5E7EB')
      setStrokeWidth(s.strokeWidth ?? 0)
      setCornerRadius(s.rx ?? 0)
    } else {
      const im = obj as fabric.Image
      const brightness = im.filters?.find(
        (f) => f instanceof fabric.Image.filters.Brightness
      ) as { brightness?: number } | undefined
      const contrast = im.filters?.find(
        (f) => f instanceof fabric.Image.filters.Contrast
      ) as { contrast?: number } | undefined
      setImgBrightness(brightness?.brightness ?? 0)
      setImgContrast(contrast?.contrast ?? 0)
      setImgFilter('none')
    }
  }, [])

  // ── Canvas init (once) ───────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current) return

    const fc = new fabric.Canvas(canvasRef.current, {
      width: dispW,
      height: dispH,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    })
    fabricRef.current = fc

    const onSelect = (e: { selected?: fabric.Object[] }) => {
      const obj = e.selected?.[0] ?? fc.getActiveObject()
      if (!obj) return
      setSelectedObj(obj)
      syncFromObj(obj)
    }
    const onClear = () => {
      setSelectedObj(null)
      setObjType(null)
    }
    const onModified = () => {
      pushHistory(fc)
      rebuildLayers(fc)
      const obj = fc.getActiveObject()
      if (obj) {
        setObjX(Math.round(obj.left ?? 0))
        setObjY(Math.round(obj.top ?? 0))
        setObjAngle(Math.round(obj.angle ?? 0))
      }
    }

    fc.on('selection:created', onSelect)
    fc.on('selection:updated', onSelect)
    fc.on('selection:cleared', onClear)
    fc.on('object:modified', onModified)
    fc.on('object:added', () => rebuildLayers(fc))
    fc.on('object:removed', () => rebuildLayers(fc))

    const init = fc.toJSON(['name'])
    historyRef.current = [init]
    historyIdxRef.current = 0
    prevFormatRef.current = format ?? null

    return () => {
      fc.off()
      fc.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Resize when format/platform changes — preserve objects ───────────────

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return

    const prev = prevFormatRef.current
    const prevW = prev?.displayWidth ?? dispW
    const prevH = prev?.displayHeight ?? dispH

    const objects = fc.getObjects()
    const hasObjects = objects.length > 0

    if (hasObjects && (prevW !== dispW || prevH !== dispH)) {
      const scaleX = dispW / prevW
      const scaleY = dispH / prevH
      objects.forEach((obj) => {
        obj.set({
          left: (obj.left ?? 0) * scaleX,
          top: (obj.top ?? 0) * scaleY,
        })
        obj.setCoords()
      })
      fc.setWidth(dispW)
      fc.setHeight(dispH)
      fc.renderAll()
    } else if (!hasObjects) {
      fc.setWidth(dispW)
      fc.setHeight(dispH)
      fc.backgroundColor = '#ffffff'
      setBgColor('#ffffff')
      fc.renderAll()
      setSelectedObj(null)
      setObjType(null)
      setLayers([])
      const snap = fc.toJSON(['name'])
      historyRef.current = [snap]
      historyIdxRef.current = 0
      setCanUndo(false)
      setCanRedo(false)
    }

    prevFormatRef.current = format ?? null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispW, dispH])

  // ── Load template JSON ───────────────────────────────────────────────────

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc || !templateToLoad?.fabric_json) return

    // Scale the canvas to fit display area while preserving template ratio
    const MAX_W = 480
    const MAX_H = 520
    const scaleX = MAX_W / templateToLoad.canvas_width
    const scaleY = MAX_H / templateToLoad.canvas_height
    const scale = Math.min(scaleX, scaleY, 1)
    const dW = Math.round(templateToLoad.canvas_width * scale)
    const dH = Math.round(templateToLoad.canvas_height * scale)

    fc.setWidth(dW)
    fc.setHeight(dH)
    fc.setZoom(scale)

    fc.loadFromJSON(templateToLoad.fabric_json, () => {
      // Make text objects easily identifiable
      fc.getObjects().forEach((obj) => {
        if (obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text') {
          obj.set({
            borderColor: '#1A56DB',
            cornerColor: '#1A56DB',
            cornerStyle: 'circle' as fabric.Object['cornerStyle'],
            transparentCorners: false,
          } as Partial<fabric.Object>)
        }
      })
      fc.renderAll()
      setSelectedObj(null)
      setObjType(null)
      rebuildLayers(fc)
      const snap = fc.toJSON(['name'])
      historyRef.current = [snap]
      historyIdxRef.current = 0
      setCanUndo(false)
      setCanRedo(false)
    })

    // Show editing hint toast
    setShowTemplateHint(true)
    const t = setTimeout(() => setShowTemplateHint(false), 4000)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateToLoad])

  // ── Auto-load initial image as background ────────────────────────────────

  useEffect(() => {
    const fc = fabricRef.current
    if (!fc || !initialImageUrl) return
    fabric.Image.fromURL(
      initialImageUrl,
      (img) => {
        if (!img || !fabricRef.current) return
        const f = fabricRef.current
        f.setBackgroundImage(img, f.renderAll.bind(f), {
          scaleX: f.getWidth() / (img.width ?? 1),
          scaleY: f.getHeight() / (img.height ?? 1),
        })
        pushHistory(f)
      },
      { crossOrigin: 'anonymous' },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImageUrl])

  // ── Undo / Redo ──────────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const fc = fabricRef.current
    if (!fc || historyIdxRef.current <= 0) return
    const newIdx = historyIdxRef.current - 1
    historyIdxRef.current = newIdx
    fc.loadFromJSON(historyRef.current[newIdx], () => {
      fc.renderAll()
      setSelectedObj(null)
      setObjType(null)
      rebuildLayers(fc)
      setCanUndo(newIdx > 0)
      setCanRedo(true)
    })
  }, [rebuildLayers])

  const redo = useCallback(() => {
    const fc = fabricRef.current
    if (!fc || historyIdxRef.current >= historyRef.current.length - 1) return
    const newIdx = historyIdxRef.current + 1
    historyIdxRef.current = newIdx
    fc.loadFromJSON(historyRef.current[newIdx], () => {
      fc.renderAll()
      setSelectedObj(null)
      setObjType(null)
      rebuildLayers(fc)
      setCanUndo(true)
      setCanRedo(newIdx < historyRef.current.length - 1)
    })
  }, [rebuildLayers])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const fc = fabricRef.current
      if (!fc) return
      const active = fc.getActiveObject() as fabric.IText | null

      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        active &&
        !active.isEditing
      ) {
        e.preventDefault()
        fc.remove(active)
        fc.renderAll()
        setSelectedObj(null)
        setObjType(null)
        pushHistory(fc)
        return
      }
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
      if (mod && e.key === 'd' && active) {
        e.preventDefault()
        active.clone((cloned: fabric.Object) => {
          cloned.set({ left: (active.left ?? 0) + 20, top: (active.top ?? 0) + 20 });
          (cloned as fabric.Object & { name?: string }).name =
            ((active as fabric.Object & { name?: string }).name ?? 'Objeto') + ' copia'
          fc.add(cloned)
          fc.setActiveObject(cloned)
          fc.renderAll()
          pushHistory(fc)
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, pushHistory])

  // ── Canvas actions ───────────────────────────────────────────────────────

  const addText = () => {
    const fc = fabricRef.current
    if (!fc) return
    const txt = new fabric.IText('Escribe aqui', {
      left: fc.getWidth() / 2,
      top: fc.getHeight() / 2,
      originX: 'center',
      originY: 'center',
      fontSize: 40,
      fontFamily: 'Inter',
      fill: '#111827',
      fontWeight: 'bold',
      name: `Texto ${fc.getObjects().length + 1}`,
    } as fabric.ITextOptions)
    fc.add(txt)
    fc.setActiveObject(txt)
    txt.enterEditing()
    fc.renderAll()
    pushHistory(fc)
  }

  const addShape = (type: 'rect' | 'circle' | 'triangle' | 'line') => {
    const fc = fabricRef.current
    if (!fc) return
    const cx = fc.getWidth() / 2
    const cy = fc.getHeight() / 2
    const n = fc.getObjects().length + 1
    let obj: fabric.Object
    if (type === 'rect') {
      obj = new fabric.Rect({ left: cx, top: cy, originX: 'center', originY: 'center', width: 160, height: 160, fill: '#1A56DB', rx: 8, ry: 8, name: `Rectangulo ${n}` })
    } else if (type === 'circle') {
      obj = new fabric.Circle({ left: cx, top: cy, originX: 'center', originY: 'center', radius: 80, fill: '#1A56DB', name: `Circulo ${n}` })
    } else if (type === 'triangle') {
      obj = new fabric.Triangle({ left: cx, top: cy, originX: 'center', originY: 'center', width: 160, height: 160, fill: '#1A56DB', name: `Triangulo ${n}` })
    } else {
      obj = new fabric.Line([cx - 80, cy, cx + 80, cy], { stroke: '#1A56DB', strokeWidth: 3, name: `Linea ${n}` })
    }
    fc.add(obj)
    fc.setActiveObject(obj)
    fc.renderAll()
    pushHistory(fc)
    setShowShapeMenu(false)
  }

  const addImageFromFile = (file: File) => {
    const fc = fabricRef.current
    if (!fc) return
    const url = URL.createObjectURL(file)
    fabric.Image.fromURL(url, (img) => {
      if (!img || !fabricRef.current) return
      const f = fabricRef.current
      img.scaleToWidth(f.getWidth() * 0.8)
      img.set({
        left: f.getWidth() / 2,
        top: f.getHeight() / 2,
        originX: 'center',
        originY: 'center',
        name: file.name.replace(/\.[^.]+$/, ''),
      })
      f.add(img)
      f.setActiveObject(img)
      f.renderAll()
      pushHistory(f)
    })
  }

  const setBackgroundImage = (file: File) => {
    const fc = fabricRef.current
    if (!fc) return
    const url = URL.createObjectURL(file)
    fabric.Image.fromURL(url, (img) => {
      if (!img || !fabricRef.current) return
      const f = fabricRef.current
      f.setBackgroundImage(img, f.renderAll.bind(f), {
        scaleX: f.getWidth() / (img.width ?? 1),
        scaleY: f.getHeight() / (img.height ?? 1),
      })
      pushHistory(f)
    })
  }

  const addLogo = () => {
    const fc = fabricRef.current
    if (!fc || !businessLogoUrl) return
    fabric.Image.fromURL(
      businessLogoUrl,
      (img) => {
        if (!img || !fabricRef.current) return
        const f = fabricRef.current
        img.scaleToWidth(80)
        img.set({
          left: f.getWidth() - 16,
          top: f.getHeight() - 16,
          originX: 'right',
          originY: 'bottom',
          name: 'Logo',
        })
        f.add(img)
        f.setActiveObject(img)
        f.renderAll()
        pushHistory(f)
      },
      { crossOrigin: 'anonymous' },
    )
  }

  const clearCanvas = () => {
    const fc = fabricRef.current
    if (!fc) return
    fc.clear()
    fc.backgroundColor = bgColor
    fc.renderAll()
    setSelectedObj(null)
    setObjType(null)
    setLayers([])
    pushHistory(fc)
  }

  const doExport = () => {
    const fc = fabricRef.current
    if (!fc) return
    const dataUrl = fc.toDataURL({ format: 'png', quality: 1, multiplier })
    onExport(dataUrl)
  }

  const doSaveTemplate = async () => {
    const fc = fabricRef.current
    if (!fc || !saveName.trim() || !saveDesc.trim()) {
      setSaveError('Nombre y descripcion son obligatorios')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const supabase = createClient()

      // Generate preview PNG
      const prevMultiplier = Math.min(400 / fc.getWidth(), 400 / fc.getHeight())
      const previewDataUrl = fc.toDataURL({ format: 'png', quality: 0.85, multiplier: prevMultiplier })
      const arr = previewDataUrl.split(',')
      const mime = arr[0].match(/:(.*?);/)![1]
      const bstr = atob(arr[1])
      let n = bstr.length
      const u8 = new Uint8Array(n)
      while (n--) u8[n] = bstr.charCodeAt(n)
      const previewFile = new File([u8], `template-${Date.now()}.png`, { type: mime })

      const storagePath = `templates/previews/${Date.now()}.png`
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('ai-examples')
        .upload(storagePath, previewFile, { contentType: 'image/png', upsert: false })

      let previewUrl = ''
      if (!storageErr && storageData) {
        const { data: pub } = supabase.storage.from('ai-examples').getPublicUrl(storageData.path)
        previewUrl = pub.publicUrl
      }

      // Get canvas JSON
      const json = fc.toJSON(['id', 'name', 'selectable', 'evented'])

      const realW = format?.realWidth ?? (platform ? (CANVAS_CONFIGS[platform]?.[0] ?? 1080) : 1080)
      const realH = format?.realHeight ?? (platform ? (CANVAS_CONFIGS[platform]?.[1] ?? 1080) : 1080)

      const { error: insertErr } = await supabase.from('ai_examples').insert([{
        title: saveName.trim(),
        description: saveDesc.trim(),
        style_description: saveDesc.trim(),
        category: saveCategory,
        platform: savePlatform,
        business_types: saveBizTypes,
        style_tags: [],
        fabric_json: json,
        preview_url: previewUrl || null,
        image_url: previewUrl || null,
        is_template: true,
        is_active: saveActive,
        canvas_width: realW,
        canvas_height: realH,
        sort_order: 0,
      }])

      if (insertErr) {
        setSaveError(insertErr.message)
        setSaving(false)
        return
      }

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveModal(false)
        setSaveSuccess(false)
        setSaveName('')
        setSaveDesc('')
      }, 1800)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const deleteSelected = () => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject()
    if (!obj || !fc) return
    fc.remove(obj)
    fc.renderAll()
    setSelectedObj(null)
    setObjType(null)
    pushHistory(fc)
  }

  const centerH = () => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject()
    if (!obj || !fc) return
    obj.centerH()
    fc.renderAll()
    pushHistory(fc)
    setObjX(Math.round(obj.left ?? 0))
  }

  const centerV = () => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject()
    if (!obj || !fc) return
    obj.centerV()
    fc.renderAll()
    pushHistory(fc)
    setObjY(Math.round(obj.top ?? 0))
  }

  // ── Property appliers ─────────────────────────────────────────────────────

  const applyText = (key: string, value: unknown) => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject() as fabric.IText
    if (!obj || !fc) return
    obj.set(key as keyof fabric.IText, value as never)
    fc.renderAll()
    pushHistory(fc)
  }

  const applyShape = (key: string, value: unknown) => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject()
    if (!obj || !fc) return
    if (key === 'rx') {
      ;(obj as fabric.Rect).set({ rx: value as number, ry: value as number })
    } else {
      obj.set(key as keyof fabric.Object, value as never)
    }
    fc.renderAll()
    pushHistory(fc)
  }

  const applyCommon = (key: string, value: unknown) => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject()
    if (!obj || !fc) return
    obj.set(key as keyof fabric.Object, value as never)
    fc.renderAll()
    pushHistory(fc)
  }

  const applyImageFilters = () => {
    const fc = fabricRef.current
    const obj = fc?.getActiveObject() as fabric.Image
    if (!obj || !(obj instanceof fabric.Image) || !fc) return
    const filters: fabric.IBaseFilter[] = []
    if (imgBrightness !== 0)
      filters.push(new fabric.Image.filters.Brightness({ brightness: imgBrightness }))
    if (imgContrast !== 0)
      filters.push(new fabric.Image.filters.Contrast({ contrast: imgContrast }))
    if (imgFilter === 'grayscale') filters.push(new fabric.Image.filters.Grayscale())
    else if (imgFilter === 'sepia') filters.push(new fabric.Image.filters.Sepia())
    else if (imgFilter === 'blur')
      filters.push(new fabric.Image.filters.Blur({ blur: 0.08 }))
    obj.filters = filters
    obj.applyFilters()
    fc.renderAll()
    pushHistory(fc)
  }

  // ── Style helpers ─────────────────────────────────────────────────────────

  const toolBtn = (active = false): React.CSSProperties => ({
    width: 30, height: 30, borderRadius: 7, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: active ? '#EFF6FF' : 'transparent',
    color: active ? '#2563EB' : '#6B7280', flexShrink: 0,
  })

  const divider: React.CSSProperties = {
    width: 1, height: 18, background: '#E5E7EB', margin: '0 3px', flexShrink: 0,
  }

  const thumbSize = format ? getThumbSize(format) : { w: 90, h: 90 }
  const templates = buildTemplates(dispW, dispH)

  const platformLabel = platform
    ? platform.charAt(0).toUpperCase() + platform.slice(1)
    : null
  const platformColor = platform ? (PLATFORM_COLORS[platform] ?? '#6B7280') : '#6B7280'

  // ── Format info bar ───────────────────────────────────────────────────────
  const renderFormatBar = () => {
    if (!platform || !format) return null
    const FormatIcon = FORMAT_ICONS[format.icon] ?? Square

    return (
      <div
        style={{
          background: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        {/* Platform badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 999,
            background: platformColor + '18',
            color: platformColor,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {platformLabel}
        </span>

        {/* Format icon + info */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            color: '#6B7280',
          }}
        >
          <FormatIcon size={13} color="#9CA3AF" />
          {format.label} · {format.ratio} · {format.realWidth}x{format.realHeight}px
        </span>

        {/* Help badge */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: '1px solid #D1D5DB',
              background: '#FFFFFF',
              color: '#6B7280',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ?
          </button>
          {showTooltip && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 22,
                zIndex: 100,
                background: '#111827',
                color: '#FFFFFF',
                fontSize: 11,
                borderRadius: 6,
                padding: '6px 10px',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              Resolucion optima para {platformLabel} — {format.label}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
      onClick={() => setShowShapeMenu(false)}
    >
      {/* ── Template banner ── */}
      {templateToLoad && (
        <div style={{
          background: '#EEF3FE', borderBottom: '1px solid #BFDBFE',
          padding: '8px 16px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={14} color="#1A56DB" />
            <div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF' }}>
                Plantilla cargada: {templateToLoad.title}
              </span>
              <span style={{ fontSize: 11, color: '#3B82F6', marginLeft: 8 }}>
                Haz doble clic en cualquier texto para editarlo
              </span>
            </div>
          </div>
          <button
            onClick={onClearTemplate}
            style={{ fontSize: 12, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Limpiar y empezar desde cero
          </button>
        </div>
      )}

      {/* ── Format info bar ── */}
      {renderFormatBar()}

      {/* ── Toolbar ── */}
      <div
        style={{
          height: 44, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB',
          display: 'flex', alignItems: 'center', gap: 2, padding: '0 10px',
          flexShrink: 0, overflowX: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Group 1 — tools */}
        <button
          style={toolBtn()}
          title="Seleccionar"
          onClick={() => {
            fabricRef.current?.discardActiveObject()
            fabricRef.current?.renderAll()
          }}
        >
          <MousePointer size={15} />
        </button>

        <button style={toolBtn()} title="Anadir texto" onClick={addText}>
          <Type size={15} />
        </button>

        <button
          style={toolBtn()}
          title="Anadir imagen"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon size={15} />
        </button>

        {/* Shape with dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            style={toolBtn(showShapeMenu)}
            title="Anadir forma"
            onClick={(e) => { e.stopPropagation(); setShowShapeMenu((s) => !s) }}
          >
            <Square size={15} />
          </button>
          {showShapeMenu && (
            <div
              style={{
                position: 'absolute', top: 34, left: 0, zIndex: 200,
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: 8, padding: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                minWidth: 132, display: 'flex', flexDirection: 'column', gap: 1,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {(
                [
                  { type: 'rect'     as const, label: 'Rectangulo', Icon: Square   },
                  { type: 'circle'   as const, label: 'Circulo',    Icon: Circle   },
                  { type: 'triangle' as const, label: 'Triangulo',  Icon: Triangle },
                  { type: 'line'     as const, label: 'Linea',      Icon: Minus    },
                ] as const
              ).map(({ type, label, Icon }) => (
                <button
                  key={type}
                  onClick={() => addShape(type)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', border: 'none', background: 'transparent',
                    cursor: 'pointer', borderRadius: 6, fontSize: 12, color: '#374151',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={divider} />

        {/* Group 2 — background */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
          title="Color de fondo"
        >
          <input
            type="color"
            value={bgColor}
            onChange={(e) => {
              setBgColor(e.target.value)
              const fc = fabricRef.current
              if (!fc) return
              fc.setBackgroundColor(e.target.value, fc.renderAll.bind(fc))
              pushHistory(fc)
            }}
            style={{
              width: 22, height: 22, borderRadius: 4, border: '1px solid #E5E7EB',
              cursor: 'pointer', padding: 1,
            }}
          />
          <span style={{ fontSize: 11, color: '#6B7280', whiteSpace: 'nowrap' }}>Fondo</span>
        </label>

        <button
          style={toolBtn()}
          title="Imagen de fondo"
          onClick={() => bgFileInputRef.current?.click()}
        >
          <ImagePlus size={15} />
        </button>

        {businessLogoUrl && (
          <button
            style={{ ...toolBtn(), fontSize: 10, fontWeight: 700 }}
            title="Anadir logo del negocio"
            onClick={addLogo}
          >
            Logo
          </button>
        )}

        <div style={divider} />

        {/* Group 3 — history */}
        <button
          style={{ ...toolBtn(), opacity: canUndo ? 1 : 0.35 }}
          title="Deshacer (Ctrl+Z)"
          onClick={undo}
          disabled={!canUndo}
        >
          <Undo2 size={15} />
        </button>
        <button
          style={{ ...toolBtn(), opacity: canRedo ? 1 : 0.35 }}
          title="Rehacer (Ctrl+Y)"
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 size={15} />
        </button>

        <div style={divider} />

        {/* Group 4 — actions */}
        <button
          style={toolBtn()}
          title="Limpiar todo"
          onClick={clearCanvas}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6B7280' }}
        >
          <Trash2 size={15} />
        </button>

        <div style={{ flex: 1 }} />

        {isAdmin && (
          <button
            onClick={() => { setSaveModal(true); setSaveError(''); setSaveSuccess(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid #E5E7EB', background: '#FFFFFF',
              color: '#374151', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A56DB'; e.currentTarget.style.color = '#1A56DB' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#374151' }}
          >
            <BookmarkPlus size={14} />
            Guardar plantilla
          </button>
        )}

        <button
          onClick={doExport}
          style={{
            padding: '5px 14px', borderRadius: 8, border: 'none',
            background: '#2563EB', color: '#FFFFFF',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
          }}
        >
          Exportar
        </button>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) addImageFromFile(f)
            e.target.value = ''
          }}
        />
        <input
          ref={bgFileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setBackgroundImage(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left panel */}
        <div
          style={{
            width: 196, background: '#FFFFFF', borderRight: '1px solid #E5E7EB',
            display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
          }}
        >
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
            {(['templates', 'layers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                style={{
                  flex: 1, padding: '9px 2px', border: 'none', background: 'transparent',
                  fontSize: 13, fontWeight: leftTab === tab ? 600 : 400,
                  color: leftTab === tab ? '#111827' : '#9CA3AF',
                  borderBottom: leftTab === tab ? '2px solid #2563EB' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {tab === 'templates' ? 'Plantillas' : 'Capas'}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {leftTab === 'templates' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      const fc = fabricRef.current
                      if (!fc) return
                      tpl.apply(fc)
                      pushHistory(fc)
                      setSelectedObj(null)
                      setObjType(null)
                      rebuildLayers(fc)
                      setBgColor(tpl.thumbBg)
                    }}
                    style={{
                      border: '1px solid #E5E7EB', borderRadius: 8,
                      overflow: 'hidden', cursor: 'pointer',
                      background: '#FFFFFF', padding: 0, textAlign: 'left',
                      boxShadow: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2563EB'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E5E7EB'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: thumbSize.w === thumbSize.h ? 62 : thumbSize.h > thumbSize.w ? 80 : 42,
                        background: '#F3F4F6',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 5, padding: 10,
                      }}
                    >
                      <div style={{ width: 80, height: 6, borderRadius: 4, background: tpl.thumbAccent, opacity: 0.7 }} />
                      <div style={{ width: 56, height: 4, borderRadius: 4, background: '#D1D5DB' }} />
                    </div>
                    <div style={{ padding: '5px 8px', fontSize: 12, fontWeight: 500, color: '#6B7280' }}>
                      {tpl.name}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {layers.length === 0 ? (
                  <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 24 }}>
                    Sin capas
                  </p>
                ) : (
                  layers.map((layer, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const fc = fabricRef.current
                        if (!fc) return
                        fc.setActiveObject(layer.obj)
                        fc.renderAll()
                        setSelectedObj(layer.obj)
                        syncFromObj(layer.obj)
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 7px', borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${selectedObj === layer.obj ? '#2563EB' : 'transparent'}`,
                        background: selectedObj === layer.obj ? '#EFF6FF' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedObj !== layer.obj) e.currentTarget.style.background = '#F3F4F6'
                      }}
                      onMouseLeave={(e) => {
                        if (selectedObj !== layer.obj) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, flexShrink: 0 }}>
                        {layer.type === 'text' ? 'T' : layer.type === 'image' ? 'IMG' : '▪'}
                      </span>
                      <span
                        style={{
                          flex: 1, fontSize: 11, color: '#374151',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {layer.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          layer.obj.set('visible', !layer.visible)
                          fabricRef.current?.renderAll()
                          rebuildLayers(fabricRef.current!)
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 1, color: '#9CA3AF', flexShrink: 0 }}
                      >
                        {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const fc = fabricRef.current
                          if (!fc) return
                          fc.remove(layer.obj)
                          fc.renderAll()
                          pushHistory(fc)
                          if (selectedObj === layer.obj) { setSelectedObj(null); setObjType(null) }
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 1, color: '#9CA3AF', flexShrink: 0 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF' }}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Canvas area */}
        <div
          style={{
            flex: 1, background: '#F3F4F6', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'auto', padding: 20, position: 'relative',
          }}
          onClick={() => {
            fabricRef.current?.discardActiveObject()
            fabricRef.current?.renderAll()
          }}
        >
          <div
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <canvas ref={canvasRef} />
          </div>

          {/* Template hint toast */}
          {showTemplateHint && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 50,
              background: '#111827', color: '#FFFFFF',
              borderRadius: 8, padding: '8px 14px',
              fontSize: 12, fontWeight: 500,
              boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            }}>
              Haz doble clic en los textos para editarlos
            </div>
          )}
        </div>

        {/* Right panel — properties */}
        {selectedObj && objType && (
          <div
            style={{
              width: 196, background: '#FFFFFF', borderLeft: '1px solid #E5E7EB',
              overflowY: 'auto', padding: '12px 12px 20px', flexShrink: 0,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Propiedades
            </p>

            {/* ── Text props ── */}
            {objType === 'text' && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Texto</span>
                  <textarea
                    value={textContent}
                    rows={3}
                    onChange={(e) => { setTextContent(e.target.value); applyText('text', e.target.value) }}
                    style={{ ...PROP_INPUT, resize: 'vertical', lineHeight: 1.4 }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Fuente</span>
                  <select
                    value={fontFamily}
                    onChange={(e) => { setFontFamily(e.target.value); applyText('fontFamily', e.target.value) }}
                    style={PROP_INPUT}
                  >
                    {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Tamano: {fontSize}px</span>
                  <input
                    type="range" min={10} max={200} value={fontSize}
                    onChange={(e) => { const v = +e.target.value; setFontSize(v); applyText('fontSize', v) }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Color</span>
                  <input
                    type="color" value={textColor}
                    onChange={(e) => { setTextColor(e.target.value); applyText('fill', e.target.value) }}
                    style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid #E5E7EB', cursor: 'pointer' }}
                  />
                </div>
                {/* Bold / Italic / Underline */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {[
                    { key: 'bold',      label: 'N', val: isBold,      prop: 'fontWeight', on: 'bold',   off: 'normal', set: setIsBold,      style: { fontWeight: 700 } },
                    { key: 'italic',    label: 'I', val: isItalic,    prop: 'fontStyle',  on: 'italic', off: 'normal', set: setIsItalic,    style: { fontStyle: 'italic' } },
                    { key: 'underline', label: 'U', val: isUnderline, prop: 'underline',  on: true,     off: false,    set: setIsUnderline, style: { textDecoration: 'underline' } },
                  ].map(({ key, label, val, prop, on, off, set, style }) => (
                    <button
                      key={key}
                      onClick={() => { const nv = !val; set(nv); applyText(prop, nv ? on : off) }}
                      style={{
                        flex: 1, height: 28, border: '1px solid #E5E7EB', borderRadius: 6,
                        background: val ? '#EFF6FF' : '#FFFFFF',
                        color: val ? '#2563EB' : '#374151',
                        cursor: 'pointer', fontSize: 12, ...style,
                      }}
                    >
                      {label === 'N' ? <Bold size={12} /> : label === 'I' ? <Italic size={12} /> : <Underline size={12} />}
                    </button>
                  ))}
                </div>
                {/* Alignment */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  {([
                    { val: 'left',   Icon: AlignLeft   },
                    { val: 'center', Icon: AlignCenter },
                    { val: 'right',  Icon: AlignRight  },
                  ] as const).map(({ val, Icon }) => (
                    <button
                      key={val}
                      onClick={() => { setTextAlign(val); applyText('textAlign', val) }}
                      style={{
                        flex: 1, height: 28, border: '1px solid #E5E7EB', borderRadius: 6,
                        background: textAlign === val ? '#EFF6FF' : '#FFFFFF',
                        color: textAlign === val ? '#2563EB' : '#374151',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon size={12} />
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Image props ── */}
            {objType === 'image' && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Brillo: {imgBrightness > 0 ? '+' : ''}{imgBrightness.toFixed(2)}</span>
                  <input
                    type="range" min={-1} max={1} step={0.05} value={imgBrightness}
                    onChange={(e) => setImgBrightness(+e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Contraste: {imgContrast > 0 ? '+' : ''}{imgContrast.toFixed(2)}</span>
                  <input
                    type="range" min={-1} max={1} step={0.05} value={imgContrast}
                    onChange={(e) => setImgContrast(+e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Filtro especial</span>
                  <select value={imgFilter} onChange={(e) => setImgFilter(e.target.value)} style={PROP_INPUT}>
                    <option value="none">Normal</option>
                    <option value="grayscale">Escala de grises</option>
                    <option value="sepia">Sepia</option>
                    <option value="blur">Desenfoque</option>
                  </select>
                </div>
                <button
                  onClick={applyImageFilters}
                  style={{ width: '100%', padding: '7px 0', borderRadius: 6, border: 'none', background: '#2563EB', color: '#FFFFFF', fontWeight: 600, cursor: 'pointer', fontSize: 12, marginBottom: 10 }}
                >
                  Aplicar filtros
                </button>
                <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                  <button
                    onClick={() => { const fc = fabricRef.current; const o = fc?.getActiveObject(); if (o && fc) { fc.sendBackwards(o); fc.renderAll(); rebuildLayers(fc) } }}
                    style={{ flex: 1, ...PROP_INPUT, cursor: 'pointer', fontSize: 10, padding: '5px 0', textAlign: 'center' }}
                  >
                    Atras
                  </button>
                  <button
                    onClick={() => { const fc = fabricRef.current; const o = fc?.getActiveObject(); if (o && fc) { fc.bringForward(o); fc.renderAll(); rebuildLayers(fc) } }}
                    style={{ flex: 1, ...PROP_INPUT, cursor: 'pointer', fontSize: 10, padding: '5px 0', textAlign: 'center' }}
                  >
                    Adelante
                  </button>
                </div>
              </>
            )}

            {/* ── Shape props ── */}
            {objType === 'shape' && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Relleno</span>
                  <input
                    type="color"
                    value={fillColor.startsWith('rgba') || fillColor === 'transparent' ? '#1A56DB' : fillColor}
                    onChange={(e) => { setFillColor(e.target.value); applyShape('fill', e.target.value) }}
                    style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid #E5E7EB', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Color de borde</span>
                  <input
                    type="color"
                    value={strokeColor === 'transparent' || !strokeColor ? '#E5E7EB' : strokeColor}
                    onChange={(e) => { setStrokeColor(e.target.value); applyShape('stroke', e.target.value) }}
                    style={{ width: '100%', height: 28, borderRadius: 6, border: '1px solid #E5E7EB', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Grosor borde: {strokeWidth}px</span>
                  <input
                    type="range" min={0} max={20} value={strokeWidth}
                    onChange={(e) => { const v = +e.target.value; setStrokeWidth(v); applyShape('strokeWidth', v) }}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span style={PROP_LABEL}>Radio esquinas: {cornerRadius}px</span>
                  <input
                    type="range" min={0} max={100} value={cornerRadius}
                    onChange={(e) => { const v = +e.target.value; setCornerRadius(v); applyShape('rx', v) }}
                    style={{ width: '100%' }}
                  />
                </div>
              </>
            )}

            {/* ── Common props ── */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: 10, marginTop: 4 }}>
              <div style={{ marginBottom: 10 }}>
                <span style={PROP_LABEL}>Opacidad: {objOpacity}%</span>
                <input
                  type="range" min={0} max={100} value={objOpacity}
                  onChange={(e) => { const v = +e.target.value; setObjOpacity(v); applyCommon('opacity', v / 100) }}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                {[
                  { label: 'X', val: objX, set: setObjX, prop: 'left' },
                  { label: 'Y', val: objY, set: setObjY, prop: 'top'  },
                ].map(({ label, val, set, prop }) => (
                  <div key={label}>
                    <span style={{ ...PROP_LABEL, marginBottom: 2 }}>{label}</span>
                    <input
                      type="number" value={val}
                      onChange={(e) => {
                        const v = +e.target.value
                        set(v)
                        const fc = fabricRef.current
                        const obj = fc?.getActiveObject()
                        if (obj && fc) { obj.set(prop as keyof fabric.Object, v as never); fc.renderAll() }
                      }}
                      style={{ ...PROP_INPUT, padding: '4px 6px' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 10 }}>
                <span style={PROP_LABEL}>Rotacion: {objAngle}°</span>
                <input
                  type="range" min={-180} max={180} value={objAngle}
                  onChange={(e) => {
                    const v = +e.target.value
                    setObjAngle(v)
                    const fc = fabricRef.current
                    const obj = fc?.getActiveObject()
                    if (obj && fc) { obj.set('angle', v); fc.renderAll() }
                  }}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <button
                  onClick={centerH}
                  style={{ flex: 1, ...PROP_INPUT, cursor: 'pointer', fontSize: 10, padding: '5px 0', textAlign: 'center' }}
                >
                  Centrar H
                </button>
                <button
                  onClick={centerV}
                  style={{ flex: 1, ...PROP_INPUT, cursor: 'pointer', fontSize: 10, padding: '5px 0', textAlign: 'center' }}
                >
                  Centrar V
                </button>
              </div>
              <button
                onClick={deleteSelected}
                style={{
                  width: '100%', padding: '7px 0', borderRadius: 6,
                  border: 'none', background: 'none',
                  color: '#DC2626', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#B91C1C' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#DC2626' }}
              >
                <Trash2 size={13} />
                Eliminar objeto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Save template modal ── */}
      {saveModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSaveModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#FFFFFF', borderRadius: 14, width: '100%', maxWidth: 480, padding: '24px 24px 20px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Guardar plantilla</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Nombre de la plantilla</label>
              <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Ej: Flyer 2x1 restaurante elegante"
                style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 11px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1A56DB' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Descripcion del estilo</label>
              <textarea value={saveDesc} onChange={e => setSaveDesc(e.target.value)} rows={3}
                placeholder="Fondo oscuro, tipografia dorada, imagen centrada..."
                style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 11px', fontSize: 13, color: '#111827', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#1A56DB' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Categoria</label>
                <select value={saveCategory} onChange={e => setSaveCategory(e.target.value)}
                  style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 11px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit' }}>
                  {['flyer','post','historia','menu','carta','promocion','anuncio','newsletter'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Plataforma</label>
                <select value={savePlatform} onChange={e => setSavePlatform(e.target.value)}
                  style={{ border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '8px 11px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit' }}>
                  {['instagram','facebook','tiktok','whatsapp','todas'].map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Tipos de negocio</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['restaurante','peluqueria','tienda','gimnasio','clinica','hotel','academia','inmobiliaria'].map(bt => (
                  <label key={bt} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                    <input type="checkbox" checked={saveBizTypes.includes(bt)}
                      onChange={() => setSaveBizTypes(prev => prev.includes(bt) ? prev.filter(x => x !== bt) : [...prev, bt])} />
                    {bt.charAt(0).toUpperCase() + bt.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              <span
                onClick={() => setSaveActive(v => !v)}
                style={{ width: 36, height: 20, borderRadius: 10, background: saveActive ? '#1A56DB' : '#E5E7EB', position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'background 0.2s', display: 'inline-block' }}
              >
                <span style={{ position: 'absolute', top: 2, left: saveActive ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s' }} />
              </span>
              Plantilla activa
            </label>

            {saveError && <p style={{ fontSize: 12, color: '#DC2626', margin: 0 }}>{saveError}</p>}
            {saveSuccess && <p style={{ fontSize: 12, color: '#0E9F6E', fontWeight: 600, margin: 0 }}>Plantilla guardada correctamente</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setSaveModal(false)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
              <button onClick={doSaveTemplate} disabled={saving}
                style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: saving ? '#9EB8F4' : '#1A56DB', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
