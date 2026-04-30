'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  AlignCenter, AlignLeft, AlignRight, Bold, BookmarkPlus,
  ChevronLeft, Download, FileDown, ImagePlus, Italic, Send, Trash2, Type,
} from 'lucide-react'
import type { KebabFlyerRef, ElementState } from '@/components/templates/KebabFlyerTemplate'

const KebabFlyerTemplate = dynamic(
  () => import('@/components/templates/KebabFlyerTemplate'),
  { ssr: false }
)

const FLYER_W = 1080
const FLYER_H = 1350

const FONTS = ['Inter', 'Georgia', 'Playfair Display', 'Montserrat', 'Oswald', 'Dancing Script', 'Arial Black']

type PanelTab = 'design' | 'text' | 'export'

export default function TemplateEditorPage() {
  const router   = useRouter()
  const supabase = createClient()

  const templateRef    = useRef<KebabFlyerRef>(null)
  const flyerContainer = useRef<HTMLDivElement>(null)
  const bgFileRef      = useRef<HTMLInputElement>(null)

  const [businessId,   setBusinessId]   = useState('')
  const [imageUrl,     setImageUrl]     = useState('')
  const [accentColor,  setAccentColor]  = useState('#D4AF37')
  const [scale,        setScale]        = useState(0.45)
  const [busy,         setBusy]         = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const [activeTab,    setActiveTab]    = useState<PanelTab>('design')
  const [selectedEl,   setSelectedEl]   = useState<ElementState | null>(null)
  const [businessName, setBusinessName] = useState('GOLDEN')
  const [subtitle,     setSubtitle]     = useState('K E B A B')
  const [offerText,    setOfferText]    = useState('OFERTA ESPECIAL')
  const [slogan,       setSlogan]       = useState('el mejor kebab')

  // Navigation guard
  const [isDirty,       setIsDirty]       = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [pendingUrl,    setPendingUrl]    = useState<string | null>(null)
  const origPushState = useRef<typeof history.pushState | null>(null)

  // Load business
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: biz } = await supabase.from('businesses').select('id, name, primary_color').eq('owner_id', user.id).single()
      if (biz) {
        setBusinessId(biz.id)
        if (biz.name) setBusinessName(biz.name)
        // Do NOT override accentColor with business primary — keep gold default
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scale on resize
  useEffect(() => {
    function calc() {
      const s = Math.max(0.2, Math.min((window.innerWidth - 280 - 80) / FLYER_W, (window.innerHeight - 52 - 80) / FLYER_H))
      setScale(s)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  // Intercept all in-app navigation when there are unsaved changes
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Patch history.pushState — Next.js router uses this internally
    const originalPush = window.history.pushState.bind(window.history)
    origPushState.current = originalPush

    window.history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
      const next = url?.toString() ?? ''
      const current = window.location.pathname + window.location.search
      if (next && next !== current) {
        setPendingUrl(next)
        setShowLeaveModal(true)
        return
      }
      originalPush(state, title, url)
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (origPushState.current) {
        window.history.pushState = origPushState.current
        origPushState.current = null
      }
    }
  }, [isDirty])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Capture ──────────────────────────────────────────────────────────────────
  async function captureFlyer(): Promise<string | null> {
    if (!flyerContainer.current) return null
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(flyerContainer.current, {
      scale: 1, useCORS: true, allowTaint: true, backgroundColor: null,
      width: FLYER_W, height: FLYER_H, logging: false,
    })
    return canvas.toDataURL('image/png', 1.0)
  }

  async function handleDownload() {
    setBusy(true)
    const dataUrl = await captureFlyer()
    setBusy(false)
    if (!dataUrl) { showToast('Error al exportar', false); return }
    const a = document.createElement('a'); a.href = dataUrl; a.download = `flyer-${Date.now()}.png`; a.click()
  }

  async function handleDownloadPdf() {
    setBusy(true)
    const dataUrl = await captureFlyer()
    if (!dataUrl) { setBusy(false); showToast('Error al exportar', false); return }
    const { jsPDF } = await import('jspdf')
    const pdfW = 210
    const pdfH = Math.round(FLYER_H / FLYER_W * pdfW)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [pdfW, pdfH] })
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfW, pdfH, '', 'FAST')
    pdf.save(`flyer-${Date.now()}.pdf`)
    setBusy(false)
  }

  async function uploadAndGetUrl(): Promise<string | null> {
    const dataUrl = await captureFlyer()
    if (!dataUrl || !businessId) return null
    const res = await fetch(dataUrl); const blob = await res.blob()
    const file = new File([blob], 'flyer.png', { type: 'image/png' })
    const path = `${businessId}/templates/${Date.now()}.png`
    const { error } = await supabase.storage.from('generated-images').upload(path, file, { contentType: 'image/png' })
    if (error) return null
    return supabase.storage.from('generated-images').getPublicUrl(path).data.publicUrl
  }

  async function handleSaveLibrary() {
    if (busy) return; setBusy(true)
    const url = await uploadAndGetUrl()
    if (!url) { setBusy(false); showToast('Error al guardar', false); return }
    await supabase.from('content_library').insert({ business_id: businessId, type: 'image', file_url: url })
    setBusy(false); showToast('Guardado en tu biblioteca')
  }

  async function handlePublish() {
    if (busy) return; setBusy(true)
    const url = await uploadAndGetUrl()
    if (!url) { setBusy(false); showToast('Error al exportar', false); return }
    setBusy(false); router.push(`/dashboard/create?image_url=${encodeURIComponent(url)}`)
  }

  // ── Leave modal actions ────────────────────────────────────────────────────
  function stayHere() {
    setShowLeaveModal(false)
    setPendingUrl(null)
  }

  async function saveAndLeave() {
    setShowLeaveModal(false)
    await handleSaveLibrary()
    navigatePending()
  }

  function discardAndLeave() {
    setShowLeaveModal(false)
    setIsDirty(false)
    navigatePending()
  }

  function navigatePending() {
    const url = pendingUrl
    setPendingUrl(null)
    if (!url) return
    // Restore original pushState before navigating
    if (origPushState.current) {
      window.history.pushState = origPushState.current
      origPushState.current = null
    }
    setIsDirty(false)
    // Use native navigation to avoid type restrictions on router.push
    window.location.href = url
  }

  // ── Sync: panel → template ────────────────────────────────────────────────
  function syncName(v: string)    { setIsDirty(true); setBusinessName(v); templateRef.current?.setBusinessName(v) }
  function syncSubtitle(v: string){ setIsDirty(true); setSubtitle(v);     templateRef.current?.setSubtitle(v) }
  function syncOffer(v: string)   { setIsDirty(true); setOfferText(v);    templateRef.current?.setOfferText(v) }
  function syncSlogan(v: string)  { setIsDirty(true); setSlogan(v);       templateRef.current?.setSlogan(v) }

  // ── Sync: template → panel (user edits directly on canvas) ───────────────
  const handleTextChange = useCallback((field: string, value: string) => {
    setIsDirty(true)
    if (field === 'businessName')    setBusinessName(value)
    if (field === 'businessSubtitle') setSubtitle(value)
    if (field === 'offerText')       setOfferText(value)
    if (field === 'sloganText')      setSlogan(value)
  }, [])

  // ── Selected element prop update ──────────────────────────────────────────
  function updateSelectedProp(prop: keyof ElementState, value: unknown) {
    if (!selectedEl) return
    const updated = { ...selectedEl, [prop]: value }
    setSelectedEl(updated as ElementState)
    templateRef.current?.updateElement(selectedEl.id, { [prop]: value } as Partial<ElementState>)
  }

  function deleteSelectedEl() {
    if (!selectedEl) return
    templateRef.current?.deleteElement(selectedEl.id)
    setSelectedEl(null)
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setIsDirty(true)
    setImageUrl(URL.createObjectURL(file))
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const secLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'block' }
  const inputSt:  React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #E5E7EB', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#111827', background: '#fff', outline: 'none' }
  const btnPrimary: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#1A56DB', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
  const btnSecondary: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }

  function TabButton({ id, label }: { id: PanelTab; label: string }) {
    const active = activeTab === id
    return (
      <button onClick={() => setActiveTab(id)} style={{ flex: 1, padding: '9px 4px', fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#1A56DB' : '#6B7280', background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#1A56DB' : 'transparent'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
        {label}
      </button>
    )
  }

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-jakarta, sans-serif)' }}>

      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: toast.ok ? '#15803D' : '#DC2626', color: '#fff', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Leave confirmation modal */}
      {showLeaveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '28px 24px', maxWidth: 380, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#111827' }}>
              Tienes cambios sin guardar
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              Si sales ahora perderias el diseno actual. Que quieres hacer?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={saveAndLeave} disabled={busy}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#1A56DB', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.8 : 1 }}>
                {busy ? 'Guardando...' : 'Guardar en biblioteca y salir'}
              </button>
              <button onClick={discardAndLeave}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                Descartar cambios y salir
              </button>
              <button onClick={stayHere}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                Continuar editando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div style={{ height: 52, flexShrink: 0, background: '#fff', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.push('/dashboard/examples')} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, padding: 0 }}>
            <ChevronLeft size={16} /> Atras
          </button>
          <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Editar plantilla</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={handleSaveLibrary} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            <BookmarkPlus size={13} /> Biblioteca
          </button>
          <button onClick={handleDownload} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            <Download size={13} /> PNG
          </button>
          <button onClick={handleDownloadPdf} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            <FileDown size={13} /> PDF
          </button>
          <button onClick={handlePublish} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', background: busy ? '#93C5FD' : '#1A56DB', color: '#fff', cursor: 'pointer' }}>
            <Send size={13} /> Publicar
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div style={{ width: 280, flexShrink: 0, background: '#fff', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
            <TabButton id="design" label="Diseno" />
            <TabButton id="text"   label="Textos" />
            <TabButton id="export" label="Exportar" />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

            {/* ── TAB: DISEÑO ─────────────────────────────────────────── */}
            {activeTab === 'design' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Image upload */}
                <div>
                  <span style={secLabel}>Imagen del plato</span>
                  {imageUrl ? (
                    <div>
                      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB', aspectRatio: '4/3', position: 'relative', background: '#000' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="plato" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <button
                          onClick={() => setImageUrl('')}
                          style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                        >×</button>
                      </div>
                      <button onClick={() => bgFileRef.current?.click()} style={{ ...btnSecondary, marginTop: 8, padding: '7px' }}>
                        <ImagePlus size={13} /> Cambiar foto
                      </button>
                    </div>
                  ) : (
                    <div
                      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f) }}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onClick={() => bgFileRef.current?.click()}
                      style={{ border: `2px dashed ${dragOver ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: dragOver ? '#EEF3FE' : '#FAFAFA', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ImagePlus size={22} color="#9CA3AF" />
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#374151', margin: '0 0 2px' }}>Sube la foto del plato</p>
                        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>PNG, JPG — arrastra o haz clic</p>
                      </div>
                    </div>
                  )}
                  <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
                </div>

                {/* Accent color */}
                <div>
                  <span style={secLabel}>Color dorado</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', background: '#FAFAFA' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <input type="color" value={accentColor} onChange={e => { setIsDirty(true); setAccentColor(e.target.value) }}
                        style={{ width: 32, height: 32, border: '2px solid #E5E7EB', borderRadius: 8, cursor: 'pointer', padding: 0, appearance: 'none' }} />
                    </div>
                    <input type="text" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      style={{ flex: 1, border: 'none', background: 'none', fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'monospace', fontWeight: 500 }} />
                    {/* Preset chips */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {['#D4AF37', '#C0A020', '#E8C84A', '#B8962E'].map(c => (
                        <div key={c} onClick={() => setAccentColor(c)}
                          style={{ width: 18, height: 18, borderRadius: 4, background: c, cursor: 'pointer', border: accentColor === c ? '2px solid #111' : '1px solid #E5E7EB' }} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Quick texts */}
                <div>
                  <span style={secLabel}>Textos rapidos</span>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 10px', lineHeight: 1.5 }}>
                    O haz clic directo sobre el diseno para editar
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {([
                      { label: 'Nombre del negocio', value: businessName, fn: syncName },
                      { label: 'Subtitulo',           value: subtitle,     fn: syncSubtitle },
                      { label: 'Oferta',              value: offerText,    fn: syncOffer },
                      { label: 'Slogan',              value: slogan,       fn: syncSlogan },
                    ] as const).map(f => (
                      <div key={f.label}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: '#6B7280', display: 'block', marginBottom: 3 }}>{f.label}</label>
                        <input type="text" value={f.value} onChange={e => (f.fn as (v: string) => void)(e.target.value)} style={{ ...inputSt, padding: '7px 10px', fontSize: 12 }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB: TEXTOS ─────────────────────────────────────────── */}
            {activeTab === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedEl ? (
                  <>
                    <div style={{ background: '#EEF3FE', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Type size={14} color="#1A56DB" />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1A56DB' }}>Elemento seleccionado</span>
                    </div>

                    {/* Font size */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={secLabel}>Tamano</span>
                        <span style={{ fontSize: 12, color: '#1A56DB', fontWeight: 600 }}>{selectedEl.fontSize}px</span>
                      </div>
                      <input type="range" min={10} max={280} value={selectedEl.fontSize}
                        onChange={e => updateSelectedProp('fontSize', Number(e.target.value))}
                        style={{ width: '100%' }} />
                    </div>

                    {/* Font family */}
                    <div>
                      <span style={secLabel}>Fuente</span>
                      <select value={selectedEl.fontFamily} onChange={e => updateSelectedProp('fontFamily', e.target.value)}
                        style={{ ...inputSt, padding: '7px 10px', fontSize: 12 }}>
                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>

                    {/* Color */}
                    <div>
                      <span style={secLabel}>Color del texto</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E5E7EB', borderRadius: 8, padding: '6px 10px' }}>
                        <input type="color" value={selectedEl.color.startsWith('#') ? selectedEl.color : '#ffffff'}
                          onChange={e => updateSelectedProp('color', e.target.value)}
                          style={{ width: 30, height: 30, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }} />
                        <span style={{ fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>{selectedEl.color}</span>
                      </div>
                    </div>

                    {/* Style buttons */}
                    <div>
                      <span style={secLabel}>Estilo</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {[
                          { icon: <Bold size={14} />,   prop: 'fontWeight',  on: 'bold',   off: 'normal',  active: selectedEl.fontWeight === 'bold' },
                          { icon: <Italic size={14} />, prop: 'fontStyle',   on: 'italic', off: 'normal',  active: selectedEl.fontStyle === 'italic' },
                        ].map((btn, i) => (
                          <button key={i} onClick={() => updateSelectedProp(btn.prop as keyof ElementState, btn.active ? btn.off : btn.on)}
                            style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid #E5E7EB', background: btn.active ? '#EEF3FE' : '#fff', color: btn.active ? '#1A56DB' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {btn.icon}
                          </button>
                        ))}
                        <div style={{ flex: 1 }} />
                        {([
                          { icon: <AlignLeft size={14} />,   value: 'left' as const },
                          { icon: <AlignCenter size={14} />, value: 'center' as const },
                          { icon: <AlignRight size={14} />,  value: 'right' as const },
                        ]).map((btn, i) => (
                          <button key={i} onClick={() => updateSelectedProp('textAlign', btn.value)}
                            style={{ width: 36, height: 32, borderRadius: 6, border: '1px solid #E5E7EB', background: selectedEl.textAlign === btn.value ? '#EEF3FE' : '#fff', color: selectedEl.textAlign === btn.value ? '#1A56DB' : '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {btn.icon}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Letter spacing */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={secLabel}>Espacio entre letras</span>
                        <span style={{ fontSize: 12, color: '#1A56DB', fontWeight: 600 }}>{selectedEl.letterSpacing}px</span>
                      </div>
                      <input type="range" min={-10} max={40} value={selectedEl.letterSpacing}
                        onChange={e => updateSelectedProp('letterSpacing', Number(e.target.value))}
                        style={{ width: '100%' }} />
                    </div>

                    {/* Line height */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={secLabel}>Altura de linea</span>
                        <span style={{ fontSize: 12, color: '#1A56DB', fontWeight: 600 }}>{selectedEl.lineHeight}</span>
                      </div>
                      <input type="range" min={0.7} max={3} step={0.05} value={selectedEl.lineHeight}
                        onChange={e => updateSelectedProp('lineHeight', Number(e.target.value))}
                        style={{ width: '100%' }} />
                    </div>

                    {/* Delete */}
                    <div style={{ paddingTop: 4, borderTop: '1px solid #F3F4F6' }}>
                      <button onClick={deleteSelectedEl}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <Trash2 size={14} /> Eliminar elemento
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Type size={24} color="#D1D5DB" />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>Ningún elemento seleccionado</p>
                      <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>Haz clic sobre cualquier texto del diseno para editarlo</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: EXPORTAR ───────────────────────────────────────── */}
            {activeTab === 'export' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 6px', lineHeight: 1.5 }}>
                  Exporta tu diseno en alta resolucion (1080 x 1350 px)
                </p>
                <button onClick={handleDownload} disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>
                  <Download size={15} /> {busy ? 'Exportando...' : 'Descargar PNG'}
                </button>
                <button onClick={handleDownloadPdf} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>
                  <FileDown size={15} /> Descargar PDF
                </button>
                <div style={{ height: 1, background: '#E5E7EB', margin: '4px 0' }} />
                <button onClick={handleSaveLibrary} disabled={busy} style={{ ...btnSecondary, opacity: busy ? 0.6 : 1 }}>
                  <BookmarkPlus size={15} /> Guardar en biblioteca
                </button>
                <button onClick={handlePublish} disabled={busy} style={{ ...btnPrimary, background: busy ? '#93C5FD' : '#1A56DB', opacity: busy ? 0.6 : 1 }}>
                  <Send size={15} /> Publicar ahora
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── CANVAS AREA ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, background: '#E8E8E8', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'auto', padding: 24 }}>
          <div style={{ width: FLYER_W * scale, height: FLYER_H * scale, position: 'relative', flexShrink: 0 }}>
            <div ref={flyerContainer} style={{ width: FLYER_W, height: FLYER_H, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
              <KebabFlyerTemplate
                ref={templateRef}
                imageUrl={imageUrl || undefined}
                accentColor={accentColor}
                scale={scale}
                onElementSelect={(el) => { setSelectedEl(el); if (el) setActiveTab('text') }}
                onTextChange={handleTextChange}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
