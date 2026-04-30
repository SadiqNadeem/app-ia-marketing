'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import type { BusinessKnowledge, KnowledgeType } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<KnowledgeType, string> = {
  pdf:       'PDF',
  audio:     'Audio',
  text:      'Texto',
  interview: 'Entrevista',
  image:     'Imagen',
  video:     'Video',
}

const TYPE_VARIANT: Record<KnowledgeType, 'info' | 'warning' | 'neutral' | 'success'> = {
  pdf:       'info',
  audio:     'warning',
  text:      'neutral',
  interview: 'success',
  image:     'info',
  video:     'success',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatFileSize(kb: number | null): string {
  if (!kb) return ''
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

const INTERVIEW_COMPLETE_MARKER = '[ENTREVISTA_COMPLETADA]'
const INITIAL_INTERVIEW_MESSAGE =
  'Hola. Voy a hacerte algunas preguntas para conocer mejor tu negocio. Empecemos: ¿cuáles son los productos o servicios principales que ofreces y a qué precio?'

type Tab = 'pdf' | 'audio' | 'media' | 'text'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}
function IconMic() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}
function IconImage() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}
function IconText() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="10" x2="3" y2="10"/>
      <line x1="21" y1="6" x2="3" y2="6"/>
      <line x1="21" y1="14" x2="3" y2="14"/>
      <line x1="17" y1="18" x2="3" y2="18"/>
    </svg>
  )
}
function IconVideo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
    </svg>
  )
}
function IconDatabase() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── Type icon/color maps ───────────────────────────────────────────────────────

type TypeIcon = () => React.ReactElement

const TYPE_ICON: Record<KnowledgeType, TypeIcon> = {
  pdf:       IconFile,
  audio:     IconMic,
  text:      IconText,
  interview: IconClipboard,
  image:     IconImage,
  video:     IconVideo,
}

const TYPE_COLORS: Record<KnowledgeType, { color: string; bg: string; border: string }> = {
  pdf:       { color: '#1A56DB', bg: '#EEF3FE', border: '#BFDBFE' },
  audio:     { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  text:      { color: '#5A6070', bg: '#F3F4F6', border: '#E5E7EB' },
  interview: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  image:     { color: '#1A56DB', bg: '#EEF3FE', border: '#BFDBFE' },
  video:     { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const supabase = createClient()
  const isMobile = useIsMobile()

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [knowledge, setKnowledge] = useState<BusinessKnowledge[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      if (biz) setBusinessId(biz.id)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchKnowledge = useCallback(async (bizId: string) => {
    setLoadingKnowledge(true)
    const { data } = await supabase
      .from('business_knowledge')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })
    setKnowledge((data as BusinessKnowledge[]) ?? [])
    setLoadingKnowledge(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (businessId) fetchKnowledge(businessId)
  }, [businessId, fetchKnowledge])

  async function handleDelete(item: BusinessKnowledge) {
    if (!confirm(`Eliminar "${item.title}"?`)) return
    await fetch('/api/knowledge/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, business_id: item.business_id }),
    })
    if (businessId) fetchKnowledge(businessId)
  }

  const existingInterview = knowledge.find((k) => k.type === 'interview')

  return (
    <>
      <style>{`
        @keyframes kDotPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.9); }
          30% { opacity: 1; transform: scale(1.1); }
        }
      `}</style>

      <div style={{ padding: isMobile ? '16px' : '28px', background: '#F9FAFB', minHeight: '100vh' }}>
        <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
          <h1 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.3px' }}>
            Información del negocio
          </h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#9EA3AE' }}>
            Cuanta más información añadas, más personalizado será el contenido generado.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
          gap: isMobile ? '14px' : '20px',
          alignItems: 'start',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '14px' : '20px' }}>
            <DocumentsCard knowledge={knowledge} loading={loadingKnowledge} onDelete={handleDelete} />
            <AddKnowledgePanel businessId={businessId} onSaved={() => businessId && fetchKnowledge(businessId)} />
          </div>
          <div style={{
            position: isMobile ? 'static' : 'sticky',
            top: 0,
            height: isMobile ? '400px' : 'calc(100vh - 52px - 56px - 28px)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <InterviewPanel
              businessId={businessId}
              existingInterview={existingInterview ?? null}
              onInterviewComplete={() => businessId && fetchKnowledge(businessId)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ── DocumentsCard ─────────────────────────────────────────────────────────────

function DocumentsCard({ knowledge, loading, onDelete }: { knowledge: BusinessKnowledge[]; loading: boolean; onDelete: (item: BusinessKnowledge) => void }) {
  return (
    <Card padding="md">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#111827', margin: 0 }}>Documentos guardados</h2>
        {knowledge.length > 0 && (
          <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: '#F3F4F6', color: '#5A6070' }}>
            {knowledge.length}
          </span>
        )}
      </div>
      {loading ? (
        <p style={{ fontSize: '13px', color: '#9EA3AE' }}>Cargando...</p>
      ) : knowledge.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#9EA3AE' }}>
            <IconDatabase />
          </div>
          <p style={{ fontSize: '13px', color: '#5A6070', marginBottom: 4 }}>Aún no has añadido información</p>
          <p style={{ fontSize: '12px', color: '#9EA3AE' }}>Usa los formularios de abajo para empezar.</p>
        </div>
      ) : (
        <div>{knowledge.map((item) => <KnowledgeRow key={item.id} item={item} onDelete={() => onDelete(item)} />)}</div>
      )}
    </Card>
  )
}

// ── KnowledgeRow ──────────────────────────────────────────────────────────────

function KnowledgeRow({ item, onDelete }: { item: BusinessKnowledge; onDelete: () => void }) {
  const TypeIcon = TYPE_ICON[item.type] ?? IconFile
  const colors = TYPE_COLORS[item.type] ?? TYPE_COLORS.text
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #EAECF0' }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: colors.bg, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.color }}>
        <TypeIcon />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
          <Badge variant={TYPE_VARIANT[item.type]}>{TYPE_LABEL[item.type]}</Badge>
        </div>
        <p style={{ fontSize: 11, color: '#9EA3AE', marginBottom: 4 }}>
          {formatDate(item.created_at)}{item.file_size_kb ? ` · ${formatFileSize(item.file_size_kb)}` : ''}
        </p>
        <p style={{ fontSize: 12, color: '#5A6070', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
          {item.extracted_text}
        </p>
      </div>
      <button onClick={onDelete}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#9EA3AE', flexShrink: 0, padding: '2px 0', transition: 'color 120ms' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#DC2626' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9EA3AE' }}>
        Eliminar
      </button>
    </div>
  )
}

// ── AddKnowledgePanel ─────────────────────────────────────────────────────────

function AddKnowledgePanel({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('pdf')
  const tabs: { key: Tab; label: string }[] = [
    { key: 'pdf', label: 'Subir PDF' }, { key: 'audio', label: 'Audio' },
    { key: 'media', label: 'Imágenes y videos' }, { key: 'text', label: 'Texto libre' },
  ]
  return (
    <Card padding="md">
      <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: 16 }}>Añadir información</h2>
      <div style={{ display: 'flex', borderBottom: '1px solid #EAECF0', marginBottom: 20 }}>
        {tabs.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13, fontWeight: activeTab === key ? 600 : 400, color: activeTab === key ? '#1A56DB' : '#5A6070', borderBottom: activeTab === key ? '2px solid #1A56DB' : '2px solid transparent', marginBottom: -1, transition: 'color 120ms', whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>
      {activeTab === 'pdf'   && <PdfTab   businessId={businessId} onSaved={onSaved} />}
      {activeTab === 'audio' && <AudioTab businessId={businessId} onSaved={onSaved} />}
      {activeTab === 'media' && <MediaTab businessId={businessId} onSaved={onSaved} />}
      {activeTab === 'text'  && <TextTab  businessId={businessId} onSaved={onSaved} />}
    </Card>
  )
}

// ── SuccessBanner ─────────────────────────────────────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
      <span style={{ color: '#16A34A', display: 'flex', alignItems: 'center', flexShrink: 0 }}><IconCheck /></span>
      <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>{message}</span>
    </div>
  )
}

// ── PdfTab ────────────────────────────────────────────────────────────────────

function PdfTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload() {
    if (!file || !title.trim() || !businessId) return
    setLoading(true); setError(''); setSuccess(false); setPreview('')
    const fd = new FormData()
    fd.append('file', file); fd.append('business_id', businessId); fd.append('title', title.trim())
    try {
      const res = await fetch('/api/knowledge/upload-pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al procesar el PDF'); return }
      setPreview(data.extracted_text_preview ?? ''); setSuccess(true); setFile(null); setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      onSaved()
    } catch { setError('Error de red. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Selecciona un PDF</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Examinar</Button>
          <span style={{ fontSize: 13, color: file ? '#374151' : '#9EA3AE' }}>{file ? file.name : 'Ningún archivo seleccionado'}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Título del documento</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carta del restaurante, Lista de precios..." style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      {error && <p style={{ fontSize: 13, color: '#DC2626' }}>{error}</p>}
      {success && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SuccessBanner message="Texto extraído y guardado correctamente" />
          {preview && <textarea readOnly value={preview} style={{ width: '100%', height: 90, fontSize: 12, color: '#5A6070', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 10px', resize: 'none', background: '#F9FAFB', boxSizing: 'border-box' }} />}
        </div>
      )}
      <Button onClick={handleUpload} loading={loading} disabled={!file || !title.trim() || !businessId} style={{ alignSelf: 'flex-start' } as React.CSSProperties}>
        {loading ? 'Extrayendo texto...' : 'Subir y extraer texto'}
      </Button>
    </div>
  )
}

// ── AudioTab ──────────────────────────────────────────────────────────────────

function AudioTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startRecording() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr; chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setFile(new File([blob], `grabacion_${Date.now()}.webm`, { type: 'audio/webm' }))
      }
      mr.start(); setRecording(true); setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    }).catch(() => setError('No se pudo acceder al micrófono.'))
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  async function handleTranscribe() {
    if (!file || !title.trim() || !businessId) return
    setLoading(true); setError(''); setSuccess(false)
    const fd = new FormData()
    fd.append('file', file); fd.append('business_id', businessId); fd.append('title', title.trim())
    try {
      const res = await fetch('/api/knowledge/upload-audio', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al transcribir'); return }
      setSuccess(true); setFile(null); setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      onSaved()
    } catch { setError('Error de red. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Selecciona un audio</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".mp3,.mp4,.m4a,.wav,.webm,audio/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Examinar</Button>
          {recording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#DC2626', display: 'inline-block' }} />
              <span style={{ fontSize: 13, color: '#5A6070' }}>Grabando {seconds}s</span>
              <Button variant="danger" size="sm" onClick={stopRecording}>Detener</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={startRecording}>Grabar audio</Button>
          )}
          {file && !recording && <span style={{ fontSize: 13, color: '#374151' }}>{file.name}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Título del audio</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descripción de mi negocio, Nuestra historia..." style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      {error && <p style={{ fontSize: 13, color: '#DC2626' }}>{error}</p>}
      {success && <SuccessBanner message="Audio transcrito y guardado" />}
      <Button onClick={handleTranscribe} loading={loading} disabled={!file || !title.trim() || !businessId} style={{ alignSelf: 'flex-start' } as React.CSSProperties}>
        {loading ? 'Transcribiendo...' : 'Transcribir y guardar'}
      </Button>
    </div>
  )
}

// ── MediaTab ──────────────────────────────────────────────────────────────────

interface MediaFileItem {
  file: File; title: string; description: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  result?: { type: 'image' | 'video'; extractedText?: string }
  error?: string
}

function MediaTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [items, setItems] = useState<MediaFileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function addFiles(files: FileList | null) {
    if (!files) return
    setItems((prev) => [...prev, ...Array.from(files).map((f) => ({ file: f, title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '), description: '', status: 'pending' as const }))])
  }

  function updateItem(idx: number, patch: Partial<MediaFileItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function handleUploadAll() {
    if (!businessId) return
    setUploading(true)
    for (let i = 0; i < items.length; i++) {
      if (items[i].status !== 'pending') continue
      updateItem(i, { status: 'uploading' })
      const fd = new FormData()
      fd.append('file', items[i].file); fd.append('business_id', businessId)
      fd.append('title', items[i].title.trim() || items[i].file.name)
      if (items[i].description.trim()) fd.append('description', items[i].description.trim())
      try {
        const res = await fetch('/api/knowledge/upload-media', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) { updateItem(i, { status: 'error', error: data.error ?? 'Error al subir' }) }
        else { updateItem(i, { status: 'done', result: { type: data.type, extractedText: data.extracted_text } }); onSaved() }
      } catch { updateItem(i, { status: 'error', error: 'Error de red.' }) }
    }
    setUploading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files) }}
        style={{ height: 100, border: `1.5px dashed ${isDragging ? '#1A56DB' : '#EAECF0'}`, borderRadius: 10, background: isDragging ? '#EEF3FE' : '#FAFAFA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 120ms', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, color: '#9EA3AE' }}><IconImage /><IconVideo /></div>
        <p style={{ fontSize: 13, color: '#5A6070', margin: 0 }}>Arrastra archivos aquí o haz clic para seleccionar</p>
        <p style={{ fontSize: 11, color: '#9EA3AE', margin: 0 }}>JPG, PNG, MP4, MOV — máx. 10 MB imágenes · 100 MB vídeos</p>
      </div>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid #EAECF0', background: item.status === 'done' ? '#F0FDF4' : item.status === 'error' ? '#FEF2F2' : '#fff' }}>
              <span style={{ color: '#9EA3AE', display: 'flex' }}>{item.file.type.startsWith('image/') ? <IconImage /> : <IconVideo />}</span>
              {item.status === 'pending' ? (
                <input value={item.title} onChange={(e) => updateItem(idx, { title: e.target.value })} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, color: '#111827', background: 'transparent' }} />
              ) : (
                <span style={{ flex: 1, fontSize: 13, color: item.status === 'done' ? '#166534' : item.status === 'error' ? '#DC2626' : '#111827' }}>
                  {item.file.name}{item.status === 'done' && ' — Guardado'}{item.status === 'uploading' && ' — Subiendo...'}{item.status === 'error' && ` — ${item.error}`}
                </span>
              )}
              {item.status === 'pending' && (
                <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9EA3AE', padding: 2, fontSize: 16, lineHeight: 1 }}>×</button>
              )}
            </div>
          ))}
          {items.some((it) => it.status === 'pending') && (
            <Button onClick={handleUploadAll} loading={uploading} disabled={!businessId} style={{ alignSelf: 'flex-start' } as React.CSSProperties}>
              {uploading ? 'Subiendo...' : `Subir ${items.filter((it) => it.status === 'pending').length} archivo${items.filter((it) => it.status === 'pending').length > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ── TextTab ───────────────────────────────────────────────────────────────────

function TextTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const MAX = 3000

  async function handleSave() {
    if (!title.trim() || !text.trim() || !businessId) return
    setLoading(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/knowledge/save-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_id: businessId, title: title.trim(), text: text.trim() }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setSuccess(true); setTitle(''); setText(''); onSaved()
      setTimeout(() => setSuccess(false), 4000)
    } catch { setError('Error de red. Inténtalo de nuevo.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Título</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Información sobre el menú, Nuestros valores..." style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Contenido</label>
        <textarea value={text} onChange={(e) => { if (e.target.value.length <= MAX) setText(e.target.value) }} placeholder="Escribe cualquier información sobre tu negocio..." rows={5}
          style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: '1.5' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: '#9EA3AE' }}>{text.length} / {MAX}</span>
        </div>
      </div>
      {error && <p style={{ fontSize: 13, color: '#DC2626' }}>{error}</p>}
      {success && <SuccessBanner message="Información guardada correctamente" />}
      <Button onClick={handleSave} loading={loading} disabled={!title.trim() || !text.trim() || !businessId} style={{ alignSelf: 'flex-start' } as React.CSSProperties}>
        Guardar
      </Button>
    </div>
  )
}

// ── InterviewPanel ────────────────────────────────────────────────────────────

function InterviewPanel({ businessId, existingInterview, onInterviewComplete }: { businessId: string | null; existingInterview: BusinessKnowledge | null; onInterviewComplete: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'init', role: 'assistant', content: INITIAL_INTERVIEW_MESSAGE }])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isLoading])

  function reset() {
    setMessages([{ id: 'init', role: 'assistant', content: INITIAL_INTERVIEW_MESSAGE }])
    setCompleted(false); setInput(''); setShowNew(false)
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || !businessId) return
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: trimmed }
    const aId = `a_${Date.now() + 1}`
    setMessages((prev) => [...prev, userMsg, { id: aId, role: 'assistant', content: '' }])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)
    try {
      const res = await fetch('/api/knowledge/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [...messages, userMsg].map(({ role, content }) => ({ role, content })), business_id: businessId }) })
      if (!res.ok || !res.body) throw new Error()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const markerIdx = accumulated.indexOf(INTERVIEW_COMPLETE_MARKER)
        setMessages((prev) => prev.map((m) => m.id === aId ? { ...m, content: markerIdx >= 0 ? accumulated.slice(0, markerIdx) : accumulated } : m))
      }
      if (accumulated.includes(INTERVIEW_COMPLETE_MARKER)) { setCompleted(true); onInterviewComplete() }
    } catch {
      setMessages((prev) => prev.map((m) => m.id === aId ? { ...m, content: 'Ocurrió un error. Por favor inténtalo de nuevo.' } : m))
    } finally { setIsLoading(false) }
  }, [isLoading, messages, businessId, onInterviewComplete])

  const canSend = input.trim().length > 0 && !isLoading && !!businessId && !completed

  return (
    <Card style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Cuestionario del negocio</p>
        <p style={{ fontSize: 12, color: '#9EA3AE', marginTop: 2 }}>Responde las preguntas para personalizar el contenido</p>
      </div>

      {existingInterview && !showNew && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #EAECF0', background: '#F0FDF4', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#16A34A', display: 'flex' }}><IconCheck /></span>
          <span style={{ fontSize: 12, color: '#166534', flex: 1 }}>Completado el {formatDate(existingInterview.created_at)}</span>
          <Button variant="secondary" size="sm" onClick={() => { setShowNew(true); reset() }}>Nuevo</Button>
        </div>
      )}

      {completed && (
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #EAECF0', background: '#F0FDF4', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#16A34A', display: 'flex' }}><IconCheck /></span>
          <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>Completado — información guardada</span>
          <button onClick={reset} style={{ marginLeft: 'auto', fontSize: 12, color: '#9EA3AE', background: 'none', border: 'none', cursor: 'pointer' }}>Nuevo cuestionario</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '88%', padding: '9px 13px', borderRadius: msg.role === 'user' ? '12px 3px 12px 12px' : '3px 12px 12px 12px', background: msg.role === 'user' ? '#111827' : '#F3F4F6', color: msg.role === 'user' ? 'white' : '#111827', fontSize: 13, lineHeight: 1.55, wordBreak: 'break-word' }}>
              {msg.content || (isLoading && msg.role === 'assistant' ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 18 }}>
                  {[0, 1, 2].map((i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#9EA3AE', display: 'inline-block', animation: `kDotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              ) : msg.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 20px', borderTop: '1px solid #EAECF0', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
        <textarea ref={textareaRef} value={input}
          onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px' }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
          placeholder={completed ? 'Cuestionario completado' : 'Escribe tu respuesta...'}
          disabled={completed} rows={1}
          style={{ flex: 1, resize: 'none', border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit', lineHeight: '1.5', minHeight: 36, maxHeight: 80, background: completed ? '#F9FAFB' : '#fff' }} />
        <button onClick={() => sendMessage(input)} disabled={!canSend}
          style={{ width: 34, height: 34, borderRadius: 8, background: canSend ? '#111827' : '#F3F4F6', border: 'none', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 120ms' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={canSend ? 'white' : '#9EA3AE'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </Card>
  )
}
