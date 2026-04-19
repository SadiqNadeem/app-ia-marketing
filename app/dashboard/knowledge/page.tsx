'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { BusinessKnowledge, KnowledgeType } from '@/types'

// ── Helpers ────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<KnowledgeType, string> = {
  pdf: 'PDF',
  audio: 'Audio',
  text: 'Texto',
  interview: 'Entrevista',
  image: 'Imagen',
  video: 'Video',
}

const TYPE_VARIANT: Record<KnowledgeType, 'info' | 'warning' | 'neutral' | 'success'> = {
  pdf: 'info',
  audio: 'warning',
  text: 'neutral',
  interview: 'success',
  image: 'info',
  video: 'success',
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
  'Hola. Voy a hacerte algunas preguntas para conocer mejor tu negocio y asi poder generar contenido mucho mas preciso y personalizado. Empecemos: cuales son los productos o servicios principales que ofreces y a que precio?'

type Tab = 'pdf' | 'audio' | 'media' | 'text'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// ── Main Page ──────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const supabase = createClient()

  const [businessId, setBusinessId] = useState<string | null>(null)
  const [knowledge, setKnowledge] = useState<BusinessKnowledge[]>([])
  const [loadingKnowledge, setLoadingKnowledge] = useState(true)

  // ── Init ──────────────────────────────────────────────────────
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
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ id: item.id, business_id: item.business_id }),
    })
    if (businessId) fetchKnowledge(businessId)
  }

  const existingInterview = knowledge.find((k) => k.type === 'interview')

  return (
    <>
      <style>{`
        @keyframes kDotPulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      <div style={{ padding: '32px', background: '#F9FAFB', minHeight: '100vh' }}>
        {/* Page header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#0F0F0F', margin: 0, letterSpacing: '-0.3px' }}>
            Informacion del negocio
          </h1>
          <p style={{ marginTop: '4px', fontSize: '13px', color: '#5A6070' }}>
            Todo lo que la IA sabe sobre tu negocio
          </p>
        </div>

        {/* Two-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '55% 1fr', gap: '24px', alignItems: 'start' }}>

          {/* ── LEFT: Knowledge list + Add forms ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Knowledge list */}
            <Card padding="md">
              <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0F0F0F', marginBottom: '16px' }}>
                Documentos guardados
              </h2>

              {loadingKnowledge ? (
                <p style={{ fontSize: '13px', color: '#5A6070' }}>Cargando...</p>
              ) : knowledge.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#5A6070' }}>
                  Aun no has anadido informacion. Usa los formularios de abajo para empezar.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {knowledge.map((item) => (
                    <KnowledgeCard
                      key={item.id}
                      item={item}
                      onDelete={() => handleDelete(item)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* Add tabs */}
            <AddKnowledgePanel
              businessId={businessId}
              onSaved={() => businessId && fetchKnowledge(businessId)}
            />
          </div>

          {/* ── RIGHT: Interview chatbot ── */}
          <InterviewPanel
            businessId={businessId}
            existingInterview={existingInterview ?? null}
            onInterviewComplete={() => businessId && fetchKnowledge(businessId)}
          />
        </div>
      </div>
    </>
  )
}

// ── KnowledgeCard ──────────────────────────────────────────────────────

function KnowledgeCard({ item, onDelete }: { item: BusinessKnowledge; onDelete: () => void }) {
  const isImage = item.type === 'image'
  const isVideo = item.type === 'video'

  // Badge background override for image/video
  const badgeBg = isImage ? '#EEF3FE' : isVideo ? '#F0FDF4' : undefined

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #EAECF0',
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
      }}
    >
      {/* Thumbnail for images */}
      {isImage && item.original_file_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.original_file_url}
          alt={item.title}
          style={{
            width: 40,
            height: 40,
            objectFit: 'cover',
            borderRadius: 6,
            border: '1px solid #EAECF0',
            flexShrink: 0,
          }}
        />
      )}

      {/* Video icon placeholder */}
      {isVideo && (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            border: '1px solid #EAECF0',
            background: '#F0FDF4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.title}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                padding: '1px 7px',
                borderRadius: 999,
                background: badgeBg ?? '#F3F4F6',
                color: isImage ? '#1A56DB' : isVideo ? '#16A34A' : '#5A6070',
                border: `1px solid ${isImage ? '#DBEAFE' : isVideo ? '#BBF7D0' : '#EAECF0'}`,
                flexShrink: 0,
              }}
            >
              {TYPE_LABEL[item.type]}
            </span>
          </div>
          <button
            onClick={onDelete}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#E02424',
              flexShrink: 0,
              padding: '2px 4px',
            }}
          >
            Eliminar
          </button>
        </div>
        <span style={{ fontSize: '11px', color: '#9EA3AE' }}>
          {formatDate(item.created_at)}
          {item.file_size_kb ? ` · ${formatFileSize(item.file_size_kb)}` : ''}
        </span>
        <p style={{ fontSize: '12px', color: '#5A6070', lineHeight: '1.5', marginTop: 4 }}>
          {item.extracted_text.slice(0, 120)}{item.extracted_text.length > 120 ? '...' : ''}
        </p>
      </div>
    </div>
  )
}

// ── AddKnowledgePanel ──────────────────────────────────────────────────

function AddKnowledgePanel({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('pdf')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pdf',   label: 'Subir PDF' },
    { key: 'audio', label: 'Subir audio' },
    { key: 'media', label: 'Imagenes y videos' },
    { key: 'text',  label: 'Texto libre' },
  ]

  return (
    <Card padding="md">
      <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0F0F0F', marginBottom: '16px' }}>
        Anadir informacion
      </h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid #EAECF0', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              fontSize: '13px',
              fontWeight: activeTab === key ? 600 : 400,
              color: activeTab === key ? '#1A56DB' : '#5A6070',
              borderBottom: activeTab === key ? '2px solid #1A56DB' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'color 120ms ease',
              whiteSpace: 'nowrap',
            }}
          >
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

// ── PdfTab ─────────────────────────────────────────────────────────────

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
    setLoading(true)
    setError('')
    setSuccess(false)
    setPreview('')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('business_id', businessId)
    fd.append('title', title.trim())

    try {
      const res = await fetch('/api/knowledge/upload-pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al procesar el PDF'); return }
      setPreview(data.extracted_text_preview ?? '')
      setSuccess(true)
      setFile(null)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      onSaved()
    } catch {
      setError('Error de red. Intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F' }}>Selecciona un PDF</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Examinar</Button>
          {file && <span style={{ fontSize: '13px', color: '#5A6070' }}>{file.name}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F' }}>Titulo del documento</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Carta del restaurante, Lista de precios..." style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#0F0F0F', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <Button onClick={handleUpload} loading={loading} disabled={!file || !title.trim() || !businessId}>
        {loading ? 'Extrayendo texto del PDF...' : 'Subir y extraer texto'}
      </Button>
      {error && <p style={{ fontSize: '13px', color: '#E02424' }}>{error}</p>}
      {success && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Badge variant="success">Texto extraido y guardado correctamente</Badge>
          {preview && (
            <textarea readOnly value={preview} style={{ width: '100%', height: '100px', fontSize: '12px', color: '#5A6070', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px', resize: 'none', background: '#F9FAFB', boxSizing: 'border-box' }} />
          )}
        </div>
      )}
    </div>
  )
}

// ── AudioTab ───────────────────────────────────────────────────────────

function AudioTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [transcription, setTranscription] = useState('')
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
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setFile(new File([blob], `grabacion_${Date.now()}.webm`, { type: 'audio/webm' }))
      }
      mr.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    }).catch(() => setError('No se pudo acceder al microfono. Verifica los permisos.'))
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  async function handleTranscribe() {
    if (!file || !title.trim() || !businessId) return
    setLoading(true)
    setError('')
    setSuccess(false)
    setTranscription('')

    const fd = new FormData()
    fd.append('file', file)
    fd.append('business_id', businessId)
    fd.append('title', title.trim())

    try {
      const res = await fetch('/api/knowledge/upload-audio', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al transcribir'); return }
      setTranscription(data.extracted_text ?? '')
      setSuccess(true)
      setFile(null)
      setTitle('')
      if (fileRef.current) fileRef.current.value = ''
      onSaved()
    } catch {
      setError('Error de red. Intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F' }}>Selecciona un audio</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".mp3,.mp4,.m4a,.wav,.webm,audio/*" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Examinar</Button>
          {recording ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E02424', display: 'inline-block', animation: 'kDotPulse 1s ease-in-out infinite' }} />
              <span style={{ fontSize: '13px', color: '#5A6070' }}>Grabando... {seconds}s</span>
              <Button variant="danger" size="sm" onClick={stopRecording}>Detener</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={startRecording}>Grabar audio</Button>
          )}
          {file && !recording && <span style={{ fontSize: '13px', color: '#5A6070' }}>{file.name}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F' }}>Titulo del audio</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descripcion de mi negocio, Nuestra historia..." style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#0F0F0F', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <Button onClick={handleTranscribe} loading={loading} disabled={!file || !title.trim() || !businessId}>
        {loading ? 'Transcribiendo audio...' : 'Transcribir con IA'}
      </Button>
      {error && <p style={{ fontSize: '13px', color: '#E02424' }}>{error}</p>}
      {success && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Badge variant="success">Audio transcrito y guardado</Badge>
          {transcription && <textarea readOnly value={transcription} style={{ width: '100%', height: '100px', fontSize: '12px', color: '#5A6070', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px', resize: 'none', background: '#F9FAFB', boxSizing: 'border-box' }} />}
        </div>
      )}
    </div>
  )
}

// ── MediaTab ───────────────────────────────────────────────────────────

interface MediaFileItem {
  file: File
  title: string
  description: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  result?: { type: 'image' | 'video'; extractedText?: string; needsDescription?: boolean }
  error?: string
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

function MediaTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [items, setItems] = useState<MediaFileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function addFiles(files: FileList | null) {
    if (!files) return
    const newItems: MediaFileItem[] = Array.from(files).map((f) => ({
      file: f,
      title: f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
      description: '',
      status: 'pending',
    }))
    setItems((prev) => [...prev, ...newItems])
  }

  function updateItem(idx: number, patch: Partial<MediaFileItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleUploadAll() {
    if (!businessId) return
    const pending = items.filter((it) => it.status === 'pending')
    if (pending.length === 0) return

    setUploading(true)

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.status !== 'pending') continue

      updateItem(i, { status: 'uploading' })

      const fd = new FormData()
      fd.append('file', item.file)
      fd.append('business_id', businessId)
      fd.append('title', item.title.trim() || item.file.name)
      if (item.description.trim()) {
        fd.append('description', item.description.trim())
      }

      try {
        const res = await fetch('/api/knowledge/upload-media', { method: 'POST', body: fd })
        const data = await res.json()

        if (!res.ok) {
          updateItem(i, { status: 'error', error: data.error ?? 'Error al subir' })
        } else {
          updateItem(i, {
            status: 'done',
            result: {
              type: data.type,
              extractedText: data.extracted_text,
              needsDescription: data.needs_description,
            },
          })
          onSaved()
        }
      } catch {
        updateItem(i, { status: 'error', error: 'Error de red. Intentalo de nuevo.' })
      }
    }

    setUploading(false)
  }

  const hasPending = items.some((it) => it.status === 'pending')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        style={{
          height: 120,
          border: `2px dashed ${isDragging ? '#1A56DB' : '#E8E3DC'}`,
          borderRadius: 12,
          background: isDragging ? '#EEF3FE' : '#FAFAF8',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 120ms ease',
          gap: 4,
        }}
      >
        <p style={{ fontSize: 13, color: '#9E9688', margin: 0, textAlign: 'center' }}>
          Arrastra imagenes o videos aqui, o haz clic para seleccionar
        </p>
        <p style={{ fontSize: 11, color: '#B0B7C3', margin: 0, textAlign: 'center' }}>
          JPG, PNG, GIF, WEBP, MP4, MOV, AVI, WEBM — Max 10MB imagenes / 100MB videos
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
        style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
      />

      {/* File list */}
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #EAECF0',
                borderRadius: 8,
                padding: '10px 12px',
                background: item.status === 'done' ? '#F0FDF4' : item.status === 'error' ? '#FEF2F2' : '#FFFFFF',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {/* Thumbnail preview for images */}
                {isImageFile(item.file) && item.status !== 'done' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(item.file)}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0, border: '1px solid #EAECF0' }}
                  />
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* Status row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#0F0F0F' }}>
                      {item.file.name}
                    </span>
                    {item.status === 'pending' && (
                      <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#9EA3AE' }}>
                        Quitar
                      </button>
                    )}
                    {item.status === 'uploading' && (
                      <span style={{ fontSize: 11, color: '#1A56DB' }}>
                        {isImageFile(item.file) ? 'Analizando imagen con IA...' : 'Subiendo video...'}
                      </span>
                    )}
                    {item.status === 'done' && (
                      <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>Guardado</span>
                    )}
                    {item.status === 'error' && (
                      <span style={{ fontSize: 11, color: '#E02424' }}>{item.error}</span>
                    )}
                  </div>

                  {/* Editable title (only when pending) */}
                  {item.status === 'pending' && (
                    <input
                      value={item.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                      placeholder={isImageFile(item.file) ? 'Ej: Foto del local, Plato estrella, Carta del menu...' : 'Ej: Video de presentacion del negocio...'}
                      style={{
                        border: '1px solid #EAECF0',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 12,
                        color: '#0F0F0F',
                        outline: 'none',
                        width: '100%',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}

                  {/* Description for video (when pending) */}
                  {item.status === 'pending' && !isImageFile(item.file) && (
                    <textarea
                      value={item.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Describe el video brevemente para que la IA lo entienda"
                      rows={2}
                      style={{
                        border: '1px solid #EAECF0',
                        borderRadius: 6,
                        padding: '5px 8px',
                        fontSize: 12,
                        color: '#0F0F0F',
                        outline: 'none',
                        width: '100%',
                        resize: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                      }}
                    />
                  )}

                  {/* AI description result for images */}
                  {item.status === 'done' && item.result?.type === 'image' && item.result.extractedText && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 500 }}>
                        La IA ha entendido esto de tu imagen:
                      </span>
                      <textarea
                        readOnly
                        value={item.result.extractedText}
                        rows={3}
                        style={{
                          border: '1px solid #BBF7D0',
                          borderRadius: 6,
                          padding: '5px 8px',
                          fontSize: 11,
                          color: '#374151',
                          background: '#F0FDF4',
                          resize: 'none',
                          width: '100%',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}

                  {/* Video saved message */}
                  {item.status === 'done' && item.result?.type === 'video' && (
                    <p style={{ fontSize: 11, color: '#16A34A', margin: 0 }}>
                      Video guardado. La IA usara el titulo y descripcion que escribiste.
                    </p>
                  )}
                </div>
              </div>

              {/* Progress bar while uploading */}
              {item.status === 'uploading' && (
                <div style={{ marginTop: 8, height: 3, background: '#EAECF0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#1A56DB', width: '100%', animation: 'shimmerBar 1.5s infinite linear', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, #1A56DB 0%, #60a5fa 50%, #1A56DB 100%)' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes shimmerBar {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {hasPending && (
        <Button
          onClick={handleUploadAll}
          loading={uploading}
          disabled={!businessId || items.every((it) => it.status !== 'pending')}
        >
          {uploading ? 'Subiendo...' : `Subir y analizar (${items.filter((it) => it.status === 'pending').length})`}
        </Button>
      )}
    </div>
  )
}

// ── TextTab ────────────────────────────────────────────────────────────

function TextTab({ businessId, onSaved }: { businessId: string | null; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const MAX = 3000

  async function handleSave() {
    if (!title.trim() || !text.trim() || !businessId) return
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/knowledge/save-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId, title: title.trim(), text: text.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setSuccess(true)
      setTitle('')
      setText('')
      onSaved()
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Error de red. Intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F' }}>Titulo</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Informacion sobre el menu, Nuestros valores..."
          style={{ width: '100%', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#0F0F0F', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#0F0F0F' }}>Escribe directamente</label>
        <textarea
          value={text}
          onChange={(e) => { if (e.target.value.length <= MAX) setText(e.target.value) }}
          placeholder="Escribe cualquier informacion sobre tu negocio..."
          style={{ width: '100%', height: '140px', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#0F0F0F', resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '12px', color: '#9EA3AE' }}>{text.length} / {MAX}</span>
        </div>
      </div>
      <Button onClick={handleSave} loading={loading} disabled={!title.trim() || !text.trim() || !businessId}>
        Guardar
      </Button>
      {error && <p style={{ fontSize: '13px', color: '#E02424' }}>{error}</p>}
      {success && <Badge variant="success">Informacion guardada correctamente</Badge>}
    </div>
  )
}

// ── InterviewPanel ─────────────────────────────────────────────────────

function InterviewPanel({
  businessId,
  existingInterview,
  onInterviewComplete,
}: {
  businessId: string | null
  existingInterview: BusinessKnowledge | null
  onInterviewComplete: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'assistant', content: INITIAL_INTERVIEW_MESSAGE },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [showNewInterview, setShowNewInterview] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function resetInterview() {
    setMessages([{ id: 'init', role: 'assistant', content: INITIAL_INTERVIEW_MESSAGE }])
    setCompleted(false)
    setInput('')
    setShowNewInterview(false)
  }

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || !businessId) return

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: trimmed }
    const assistantId = `a_${Date.now() + 1}`
    const assistantMsg: ChatMessage = { id: assistantId, role: 'assistant', content: '' }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const apiMessages = [...messages, userMsg].map(({ role, content }) => ({ role, content }))
      const res = await fetch('/api/knowledge/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ messages: apiMessages, business_id: businessId }),
      })

      if (!res.ok || !res.body) throw new Error('Error en la respuesta')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        const markerIdx = accumulated.indexOf(INTERVIEW_COMPLETE_MARKER)
        const displayText = markerIdx >= 0 ? accumulated.slice(0, markerIdx) : accumulated

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: displayText } : m))
        )
      }

      if (accumulated.includes(INTERVIEW_COMPLETE_MARKER)) {
        setCompleted(true)
        onInterviewComplete()
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: 'Ocurrio un error. Por favor intenta de nuevo.' } : m
        )
      )
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, businessId, onInterviewComplete])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const canSend = input.trim().length > 0 && !isLoading && !!businessId && !completed

  return (
    <Card padding="sm" style={{ display: 'flex', flexDirection: 'column', height: '600px' }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F0F0F', margin: 0 }}>Asistente de entrevista</p>
        <p style={{ fontSize: '12px', color: '#5A6070', marginTop: '2px' }}>Respondeme y aprendere todo sobre tu negocio</p>
      </div>

      {existingInterview && !showNewInterview && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #EAECF0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Badge variant="success">
            Ya completaste la entrevista el {formatDate(existingInterview.created_at)}. Puedes hacer una nueva si ha cambiado algo en tu negocio.
          </Badge>
          <Button variant="secondary" size="sm" onClick={() => { setShowNewInterview(true); resetInterview() }}>
            Nueva entrevista
          </Button>
        </div>
      )}

      {completed && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #EAECF0', flexShrink: 0 }}>
          <Badge variant="success">Entrevista completada. La informacion se ha guardado automaticamente.</Badge>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                background: msg.role === 'user' ? '#1A56DB' : '#F9FAFB',
                color: msg.role === 'user' ? 'white' : '#0F0F0F',
                fontSize: '13px',
                lineHeight: '1.5',
                wordBreak: 'break-word',
              }}
            >
              {msg.content || (isLoading && msg.role === 'assistant' ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#9EA3AE', display: 'inline-block', animation: 'kDotPulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              ) : msg.content)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #EAECF0', flexShrink: 0, display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
          }}
          onKeyDown={handleKeyDown}
          placeholder={completed ? 'Entrevista completada' : 'Escribe tu respuesta...'}
          disabled={!canSend && !(!isLoading && input.trim().length > 0)}
          rows={1}
          style={{ flex: 1, resize: 'none', border: '1px solid #EAECF0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#0F0F0F', outline: 'none', fontFamily: 'inherit', lineHeight: '1.5', minHeight: '36px', maxHeight: '80px' }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!canSend}
          style={{ width: '36px', height: '36px', borderRadius: '50%', background: canSend ? '#1A56DB' : '#EAECF0', border: 'none', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 120ms ease' }}
        >
          <svg width="14" height="14" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 12V3M7.5 3L3 7.5M7.5 3L12 7.5" stroke={canSend ? 'white' : '#9EA3AE'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </Card>
  )
}
