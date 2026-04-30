'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { fabric } from 'fabric'
import {
  AlignCenterHorizontal, AlignCenterVertical, ArrowDown, ArrowRight, ArrowUp,
  Circle, Copy, ImagePlus, Maximize2, Minus, Plus, Square, Trash2, ZoomIn, ZoomOut,
} from 'lucide-react'

// ── Public API ────────────────────────────────────────────────────────────────
export interface FabricEditorHandle {
  getDataUrl: () => string
  downloadPng: (filename?: string) => void
}

export interface FabricEditorProps {
  exampleImageUrl: string
  fabricJson?: string | null
  businessName: string
  businessId: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
type Format = '1:1' | '9:16' | '16:9'
type BgFilter = '' | 'grayscale' | 'sepia' | 'blur'

const DISPLAY: Record<Format, [number, number]> = {
  '1:1':  [500, 500],
  '9:16': [281, 500],
  '16:9': [500, 281],
}

const LOGICAL: Record<Format, [number, number]> = {
  '1:1':  [1080, 1080],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
}

const FONTS = ['Inter', 'Playfair Display', 'Montserrat', 'Oswald', 'Dancing Script']

const FORMAT_OPTIONS: { value: Format; ratio: string; label: string }[] = [
  { value: '1:1',  ratio: '1:1',  label: 'Post cuadrado' },
  { value: '9:16', ratio: '9:16', label: 'Historia' },
  { value: '16:9', ratio: '16:9', label: 'Horizontal' },
]

let _uid = 0
function uid() { return `t${++_uid}_${Date.now()}` }

// ── Types ─────────────────────────────────────────────────────────────────────
interface TextItem {
  id: string
  name: string
  text: string
  fill: string
  fontSize: number
  fontFamily: string
  obj: fabric.IText
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getFilters(brightness: number, contrast: number, filter: BgFilter): fabric.IBaseFilter[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const F = fabric.Image.filters as any
  const arr: fabric.IBaseFilter[] = [
    new F.Brightness({ brightness }),
    new F.Contrast({ contrast }),
  ]
  if (filter === 'grayscale') arr.push(new F.Grayscale())
  if (filter === 'sepia')     arr.push(new F.Sepia())
  if (filter === 'blur')      arr.push(new F.Blur({ blur: 0.12 }))
  return arr
}

// ── Component ─────────────────────────────────────────────────────────────────
const FabricEditor = forwardRef<FabricEditorHandle, FabricEditorProps>(
  ({ exampleImageUrl, fabricJson, businessName }, ref) => {
    const canvasElRef   = useRef<HTMLCanvasElement>(null)
    const fabricRef     = useRef<fabric.Canvas | null>(null)
    const canvasWrapRef = useRef<HTMLDivElement>(null)
    const bgFileRef     = useRef<HTMLInputElement>(null)
    const formatRef     = useRef<Format>('1:1')

    // — State
    const [format,       setFormat]       = useState<Format>('1:1')
    const [hasBgImg,     setHasBgImg]     = useState(!!exampleImageUrl)
    const [bgColor,      setBgColor]      = useState('#1A1A1A')
    const [brightness,   setBrightness]   = useState(0)
    const [contrast,     setContrast]     = useState(0)
    const [opacity,      setOpacity]      = useState(100)
    const [bgFilter,     setBgFilter]     = useState<BgFilter>('')
    const [textItems,    setTextItems]    = useState<TextItem[]>([])
    const [selectedId,   setSelectedId]   = useState<string | null>(null)
    const [toolbarPos,   setToolbarPos]   = useState<{ x: number; y: number } | null>(null)
    const [zoom,         setZoom]         = useState(1)

    // ── Expose methods to page ──────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getDataUrl() {
        const canvas = fabricRef.current
        if (!canvas) return ''
        const multiplier = LOGICAL[formatRef.current][0] / DISPLAY[formatRef.current][0]
        return canvas.toDataURL({ format: 'png', quality: 1, multiplier })
      },
      downloadPng(filename = 'diseno.png') {
        const url = this.getDataUrl()
        if (!url) return
        const a = document.createElement('a')
        a.href = url; a.download = filename; a.click()
      },
    }))

    // ── Sync text items from canvas ─────────────────────────────────────
    const syncTexts = useCallback(() => {
      const canvas = fabricRef.current
      if (!canvas) return
      const items: TextItem[] = canvas.getObjects()
        .filter(o => o instanceof fabric.IText || o instanceof fabric.Text)
        .map((o, i) => {
          const t = o as fabric.IText & { id?: string; name?: string }
          if (!t.id) t.id = uid()
          return {
            id: t.id,
            name: t.name ?? `Texto ${i + 1}`,
            text: t.text ?? '',
            fill: typeof t.fill === 'string' ? t.fill : '#ffffff',
            fontSize: t.fontSize ?? 32,
            fontFamily: t.fontFamily ?? 'Inter',
            obj: t as fabric.IText,
          }
        })
      setTextItems(items)
    }, [])

    // ── Toolbar position ────────────────────────────────────────────────
    const updateToolbar = useCallback((obj: fabric.Object | null) => {
      if (!obj) { setToolbarPos(null); return }
      const br = obj.getBoundingRect()
      setToolbarPos({ x: br.left + br.width / 2, y: Math.max(4, br.top - 48) })
    }, [])

    // ── Apply bg image filters ──────────────────────────────────────────
    const applyFilters = useCallback((b: number, c: number, o: number, f: BgFilter) => {
      const canvas = fabricRef.current
      if (!canvas) return
      const bgImg = canvas.backgroundImage as fabric.Image | null
      if (!bgImg) return
      bgImg.filters = getFilters(b, c, f)
      bgImg.applyFilters()
      bgImg.set({ opacity: o / 100 })
      canvas.renderAll()
    }, [])

    // ── Load URL as background image ────────────────────────────────────
    function loadBgImage(url: string) {
      if (!fabricRef.current) return
      const [w, h] = [fabricRef.current.getWidth(), fabricRef.current.getHeight()]
      fabric.Image.fromURL(
        url,
        (img) => {
          // Canvas may have been disposed while the image was loading
          const c = fabricRef.current
          if (!c) return
          img.set({
            left: 0, top: 0, originX: 'left', originY: 'top',
            scaleX: w / (img.width ?? 1),
            scaleY: h / (img.height ?? 1),
          })
          c.setBackgroundImage(img, c.renderAll.bind(c))
          setHasBgImg(true)
        },
        { crossOrigin: 'anonymous' }
      )
    }

    // ── Add default starter texts ───────────────────────────────────────
    function addDefaultTexts(canvas: fabric.Canvas) {
      const [w, h] = [canvas.getWidth(), canvas.getHeight()]
      const shadow = (blur: number) =>
        new fabric.Shadow({ color: 'rgba(0,0,0,0.55)', blur, offsetX: 0, offsetY: 2 })

      const t1 = new fabric.IText(businessName || 'Nombre de tu negocio', {
        left: w / 2, top: h * 0.12, originX: 'center', originY: 'center',
        fontSize: Math.round(h * 0.058), fontWeight: 'bold', fill: '#FFFFFF',
        fontFamily: 'Inter', textAlign: 'center', name: 'Nombre del negocio',
        shadow: shadow(8),
      } as fabric.ITextOptions)
      ;(t1 as unknown as { id: string }).id = uid()

      const t2 = new fabric.IText('Tu oferta aqui', {
        left: w / 2, top: h * 0.5, originX: 'center', originY: 'center',
        fontSize: Math.round(h * 0.092), fontWeight: 'bold', fill: '#D4AF37',
        fontFamily: 'Montserrat', textAlign: 'center', name: 'Oferta principal',
        shadow: shadow(12),
      } as fabric.ITextOptions)
      ;(t2 as unknown as { id: string }).id = uid()

      const t3 = new fabric.IText('Mas informacion', {
        left: w / 2, top: h * 0.88, originX: 'center', originY: 'center',
        fontSize: Math.round(h * 0.038), fill: '#FFFFFF',
        fontFamily: 'Inter', textAlign: 'center', name: 'Llamada a la accion',
        shadow: shadow(6),
      } as fabric.ITextOptions)
      ;(t3 as unknown as { id: string }).id = uid()

      canvas.add(t1, t2, t3)
      canvas.renderAll()
    }

    // ── Canvas initialization (once on mount) ───────────────────────────
    useEffect(() => {
      if (!canvasElRef.current) return
      const [w, h] = DISPLAY['1:1']

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: w, height: h,
        backgroundColor: bgColor,
        preserveObjectStacking: true,
        selection: true,
      })
      fabricRef.current = canvas

      canvas.on('object:added',    syncTexts)
      canvas.on('object:removed',  syncTexts)
      canvas.on('object:modified', syncTexts)
      canvas.on('text:changed',    syncTexts)
      canvas.on('selection:created', (e: fabric.IEvent) => {
        const obj = (e as unknown as { selected: fabric.Object[] }).selected?.[0] ?? null
        setSelectedId(obj ? ((obj as unknown as { id?: string }).id ?? null) : null)
        updateToolbar(obj)
      })
      canvas.on('selection:updated', (e: fabric.IEvent) => {
        const obj = (e as unknown as { selected: fabric.Object[] }).selected?.[0] ?? null
        setSelectedId(obj ? ((obj as unknown as { id?: string }).id ?? null) : null)
        updateToolbar(obj)
      })
      canvas.on('selection:cleared', () => { setSelectedId(null); setToolbarPos(null) })
      canvas.on('object:moving',  (e: fabric.IEvent) => updateToolbar(e.target ?? null))
      canvas.on('object:scaling', (e: fabric.IEvent) => updateToolbar(e.target ?? null))

      if (fabricJson) {
        canvas.loadFromJSON(fabricJson, () => { canvas.renderAll(); syncTexts() })
        setHasBgImg(true)
      } else {
        if (exampleImageUrl) loadBgImage(exampleImageUrl)
        addDefaultTexts(canvas)
      }

      return () => {
        canvas.off()
        canvas.dispose()
        fabricRef.current = null
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Format change (resize canvas in-place) ──────────────────────────
    function changeFormat(newFmt: Format) {
      const canvas = fabricRef.current
      if (!canvas) { setFormat(newFmt); formatRef.current = newFmt; return }

      const [oldW, oldH] = DISPLAY[formatRef.current]
      const [newW, newH] = DISPLAY[newFmt]
      const scaleX = newW / oldW
      const scaleY = newH / oldH

      canvas.getObjects().forEach(obj => {
        obj.set({
          left:   (obj.left  ?? 0) * scaleX,
          top:    (obj.top   ?? 0) * scaleY,
          scaleX: (obj.scaleX ?? 1) * scaleX,
          scaleY: (obj.scaleY ?? 1) * scaleY,
        })
        obj.setCoords()
      })

      const bgImg = canvas.backgroundImage as fabric.Image | null
      if (bgImg) {
        bgImg.set({
          scaleX: newW / (bgImg.width ?? 1),
          scaleY: newH / (bgImg.height ?? 1),
        })
      }

      canvas.setWidth(newW)
      canvas.setHeight(newH)
      canvas.renderAll()
      setFormat(newFmt)
      formatRef.current = newFmt
    }

    // ── Canvas actions ──────────────────────────────────────────────────
    function addText() {
      const canvas = fabricRef.current
      if (!canvas) return
      const [w, h] = [canvas.getWidth(), canvas.getHeight()]
      const obj = new fabric.IText('Texto nuevo', {
        left: w / 2, top: h / 2, originX: 'center', originY: 'center',
        fontSize: 40, fontWeight: 'bold', fill: '#FFFFFF',
        fontFamily: 'Inter', textAlign: 'center', name: `Texto ${textItems.length + 1}`,
      } as fabric.ITextOptions)
      ;(obj as unknown as { id: string }).id = uid()
      canvas.add(obj)
      canvas.setActiveObject(obj)
      canvas.renderAll()
    }

    function addShape(type: 'rect' | 'circle' | 'line' | 'arrow') {
      const canvas = fabricRef.current
      if (!canvas) return
      const [w, h] = [canvas.getWidth(), canvas.getHeight()]
      let obj: fabric.Object

      switch (type) {
        case 'rect':
          obj = new fabric.Rect({
            left: w / 2, top: h / 2, originX: 'center', originY: 'center',
            width: 200, height: 80, fill: 'rgba(26,86,219,0.45)',
            stroke: '#1A56DB', strokeWidth: 2, rx: 8, ry: 8, name: 'Rectangulo',
          })
          break
        case 'circle':
          obj = new fabric.Circle({
            left: w / 2, top: h / 2, originX: 'center', originY: 'center',
            radius: 60, fill: 'rgba(26,86,219,0.4)',
            stroke: '#1A56DB', strokeWidth: 2, name: 'Circulo',
          })
          break
        case 'line':
          obj = new fabric.Line([0, 0, 200, 0], {
            left: w / 2, top: h / 2, originX: 'center', originY: 'center',
            stroke: '#FFFFFF', strokeWidth: 3, name: 'Linea',
          })
          break
        default:
          obj = new fabric.Triangle({
            left: w / 2, top: h / 2, originX: 'center', originY: 'center',
            width: 60, height: 60, fill: '#D4AF37', angle: 90, name: 'Flecha',
          })
      }
      ;(obj as unknown as { id: string }).id = uid()
      canvas.add(obj)
      canvas.setActiveObject(obj)
      canvas.renderAll()
    }

    function deleteSelected() {
      const canvas = fabricRef.current; if (!canvas) return
      const obj = canvas.getActiveObject(); if (obj) { canvas.remove(obj); canvas.renderAll() }
    }

    function duplicateSelected() {
      const canvas = fabricRef.current; if (!canvas) return
      const obj = canvas.getActiveObject(); if (!obj) return
      obj.clone((cloned: fabric.Object) => {
        cloned.set({ left: (obj.left ?? 0) + 20, top: (obj.top ?? 0) + 20 })
        ;(cloned as unknown as { id: string }).id = uid()
        canvas.add(cloned); canvas.setActiveObject(cloned); canvas.renderAll()
      })
    }

    function bringForward()  { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { c.bringForward(o); c.renderAll() } }
    function sendBackward()  { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { c.sendBackwards(o); c.renderAll() } }
    function centerHoriz()   { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { o.set({ left: c.getWidth() / 2, originX: 'center' }); c.renderAll(); updateToolbar(o) } }
    function centerVert()    { const c = fabricRef.current; const o = c?.getActiveObject(); if (c && o) { o.set({ top: c.getHeight() / 2, originY: 'center' }); c.renderAll(); updateToolbar(o) } }

    function setZoomLevel(z: number) {
      const canvas = fabricRef.current; if (!canvas) return
      const clamped = Math.max(0.2, Math.min(3, z))
      canvas.setZoom(clamped); setZoom(clamped)
    }

    function updateTextProp(id: string, prop: string, value: unknown) {
      const item = textItems.find(t => t.id === id); if (!item) return
      item.obj.set({ [prop]: value } as Partial<fabric.IText>)
      fabricRef.current?.renderAll()
      syncTexts()
    }

    function handleBgFile(file: File) {
      if (!fabricRef.current) return
      const [w, h] = [fabricRef.current.getWidth(), fabricRef.current.getHeight()]
      const url = URL.createObjectURL(file)
      fabric.Image.fromURL(url, (img) => {
        const c = fabricRef.current
        if (!c) return
        img.set({ left: 0, top: 0, originX: 'left', originY: 'top', scaleX: w / (img.width ?? 1), scaleY: h / (img.height ?? 1) })
        c.setBackgroundImage(img, c.renderAll.bind(c))
        setHasBgImg(true)
      })
    }

    function removeBgImage() {
      const canvas = fabricRef.current; if (!canvas) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canvas.setBackgroundImage(null as any, canvas.renderAll.bind(canvas))
      canvas.setBackgroundColor(bgColor, canvas.renderAll.bind(canvas))
      setHasBgImg(false)
    }

    // ── Slider handlers (pass new value directly to avoid stale state) ──
    function handleBrightness(v: number) { setBrightness(v); applyFilters(v, contrast, opacity, bgFilter) }
    function handleContrast(v: number)   { setContrast(v);   applyFilters(brightness, v, opacity, bgFilter) }
    function handleOpacity(v: number)    { setOpacity(v);    applyFilters(brightness, contrast, v, bgFilter) }
    function handleFilter(f: BgFilter)   { setBgFilter(f);   applyFilters(brightness, contrast, opacity, f) }
    function handleBgColor(c: string) {
      setBgColor(c)
      if (!hasBgImg) fabricRef.current?.setBackgroundColor(c, fabricRef.current?.renderAll.bind(fabricRef.current))
    }

    // ── Styles ──────────────────────────────────────────────────────────
    const secStyle: React.CSSProperties = { borderBottom: '1px solid #E5E7EB', padding: '14px 16px' }
    const secLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'block' }
    const smallBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer' }
    const toolBtn: React.CSSProperties  = { width: 26, height: 26, border: 'none', background: 'none', borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }
    const zoomBtn: React.CSSProperties  = { background: 'none', border: 'none', cursor: 'pointer', color: '#374151', padding: '2px 4px', display: 'flex', alignItems: 'center' }

    return (
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────── */}
        <div style={{ width: 300, flexShrink: 0, background: '#FAFAFA', borderRight: '1px solid #E5E7EB', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Background Image */}
          <div style={secStyle}>
            <span style={secLabel}>Imagen de fondo</span>
            {exampleImageUrl && (
              <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: '2px solid #E5E7EB', aspectRatio: '1', position: 'relative', background: '#F3F4F6' }}>
                <img src={exampleImageUrl} alt="fondo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => bgFileRef.current?.click()} style={smallBtn}>
                <ImagePlus size={13} /> Cambiar imagen
              </button>
              {hasBgImg && (
                <button onClick={removeBgImage} style={{ ...smallBtn, color: '#E02424', border: '1px solid #FECACA' }}>
                  Quitar
                </button>
              )}
            </div>
            <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleBgFile(f); e.target.value = '' }} />
          </div>

          {/* Background Color (no bg image) */}
          {!hasBgImg && (
            <div style={secStyle}>
              <span style={secLabel}>Color de fondo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="color" value={bgColor} onChange={e => handleBgColor(e.target.value)}
                  style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
                <input type="text" value={bgColor} onChange={e => handleBgColor(e.target.value)}
                  style={{ width: 80, fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 8px', fontFamily: 'monospace', color: '#111827', outline: 'none' }} />
              </div>
            </div>
          )}

          {/* Texts */}
          <div style={secStyle}>
            <span style={secLabel}>Textos</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {textItems.map(item => (
                <div
                  key={item.id}
                  style={{ border: `1.5px solid ${selectedId === item.id ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 8, padding: '10px 10px 8px', background: '#fff', cursor: 'pointer' }}
                  onClick={() => {
                    fabricRef.current?.setActiveObject(item.obj)
                    fabricRef.current?.renderAll()
                    setSelectedId(item.id)
                    updateToolbar(item.obj)
                  }}
                >
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', margin: '0 0 5px' }}>{item.name}</p>
                  <textarea
                    value={item.text}
                    onChange={e => updateTextProp(item.id, 'text', e.target.value)}
                    rows={2}
                    onClick={e => e.stopPropagation()}
                    style={{ width: '100%', fontSize: 13, border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 8px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', color: '#111827', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 5, marginTop: 6, alignItems: 'center' }}>
                    <input type="color"
                      value={item.fill.startsWith('#') ? item.fill : '#ffffff'}
                      onChange={e => updateTextProp(item.id, 'fill', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      title="Color del texto"
                      style={{ width: 26, height: 26, border: '1px solid #E5E7EB', borderRadius: 4, cursor: 'pointer', padding: 0, flexShrink: 0 }} />
                    <select
                      value={item.fontFamily}
                      onChange={e => updateTextProp(item.id, 'fontFamily', e.target.value)}
                      onClick={e => e.stopPropagation()}
                      style={{ flex: 1, fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 5, padding: '4px 3px', color: '#374151', background: '#fff', outline: 'none', minWidth: 0 }}
                    >
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="range" min={8} max={200} value={item.fontSize}
                      onChange={e => updateTextProp(item.id, 'fontSize', Number(e.target.value))}
                      onClick={e => e.stopPropagation()}
                      title={`${item.fontSize}px`}
                      style={{ width: 52, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 22, flexShrink: 0 }}>{item.fontSize}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addText}
              style={{ marginTop: 10, width: '100%', padding: '7px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1.5px dashed #D1D5DB', background: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Plus size={13} /> Anadir texto
            </button>
          </div>

          {/* Shapes */}
          <div style={secStyle}>
            <span style={secLabel}>Formas</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { type: 'rect'   as const, icon: <Square size={15} />,     label: 'Rectangulo' },
                { type: 'circle' as const, icon: <Circle size={15} />,     label: 'Circulo' },
                { type: 'line'   as const, icon: <Minus size={15} />,      label: 'Linea' },
                { type: 'arrow'  as const, icon: <ArrowRight size={15} />, label: 'Flecha' },
              ]).map(s => (
                <button key={s.type} onClick={() => addShape(s.type)}
                  style={{ ...smallBtn, justifyContent: 'center', flexDirection: 'column', gap: 4, padding: '10px 6px' }}>
                  {s.icon}
                  <span style={{ fontSize: 11 }}>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Image adjustments (only when bg image) */}
          {hasBgImg && (
            <div style={secStyle}>
              <span style={secLabel}>Ajustes de imagen</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  { label: 'Brillo',    val: brightness, min: -1, max: 1, step: 0.01, fn: handleBrightness },
                  { label: 'Contraste', val: contrast,   min: -1, max: 1, step: 0.01, fn: handleContrast },
                  { label: `Opacidad`, val: opacity,    min: 0,  max: 100, step: 1,  fn: handleOpacity },
                ] as const).map(s => (
                  <div key={s.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: '#374151' }}>{s.label}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {s.label === 'Opacidad' ? `${s.val}%` : (s.val as number).toFixed(2)}
                      </span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.val}
                      onChange={e => (s.fn as (v: number) => void)(Number(e.target.value))}
                      style={{ width: '100%' }} />
                  </div>
                ))}
                <div>
                  <span style={{ fontSize: 12, color: '#374151', marginBottom: 4, display: 'block' }}>Filtro</span>
                  <select value={bgFilter} onChange={e => handleFilter(e.target.value as BgFilter)}
                    style={{ width: '100%', fontSize: 12, border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', color: '#374151', background: '#fff', outline: 'none' }}>
                    <option value="">Sin filtro</option>
                    <option value="grayscale">Escala de grises</option>
                    <option value="sepia">Sepia</option>
                    <option value="blur">Blur suave</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Format */}
          <div style={secStyle}>
            <span style={secLabel}>Formato</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FORMAT_OPTIONS.map(f => (
                <button key={f.value} onClick={() => changeFormat(f.value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 7, fontSize: 12, fontWeight: format === f.value ? 600 : 400, border: format === f.value ? '1.5px solid #1A56DB' : '1.5px solid #E5E7EB', background: format === f.value ? '#EEF3FE' : '#fff', color: format === f.value ? '#1A56DB' : '#374151', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 10, color: format === f.value ? '#1A56DB' : '#9CA3AF', minWidth: 30 }}>{f.ratio}</span>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── CANVAS AREA ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>

          {/* Canvas wrapper */}
          <div ref={canvasWrapRef} style={{ position: 'relative', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
            <canvas ref={canvasElRef} />

            {/* Floating toolbar */}
            {toolbarPos && selectedId && (
              <div style={{ position: 'absolute', left: toolbarPos.x, top: toolbarPos.y, transform: 'translateX(-50%)', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 5px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)', display: 'flex', gap: 1, zIndex: 200, pointerEvents: 'all' }}>
                {([
                  { icon: <ArrowUp size={12} />,               action: bringForward,    title: 'Subir capa' },
                  { icon: <ArrowDown size={12} />,             action: sendBackward,    title: 'Bajar capa' },
                  { icon: <Copy size={12} />,                  action: duplicateSelected, title: 'Duplicar' },
                  { icon: <AlignCenterHorizontal size={12} />, action: centerHoriz,     title: 'Centrar horizontal' },
                  { icon: <AlignCenterVertical size={12} />,   action: centerVert,      title: 'Centrar vertical' },
                  { icon: <Trash2 size={12} color="#EF4444" />, action: deleteSelected, title: 'Eliminar' },
                ]).map((btn, i) => (
                  <button key={i} onClick={btn.action} title={btn.title} style={toolBtn}>
                    {btn.icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zoom controls */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 3, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '4px 8px', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            <button onClick={() => setZoomLevel(zoom - 0.1)} style={zoomBtn} title="Alejar"><ZoomOut size={14} /></button>
            <span style={{ fontSize: 12, color: '#374151', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoomLevel(zoom + 0.1)} style={zoomBtn} title="Acercar"><ZoomIn size={14} /></button>
            <button onClick={() => setZoomLevel(1)} style={zoomBtn} title="Restablecer"><Maximize2 size={14} /></button>
          </div>
        </div>
      </div>
    )
  }
)

FabricEditor.displayName = 'FabricEditor'
export default FabricEditor
