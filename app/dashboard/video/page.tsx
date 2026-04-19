'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TikTokExportPanel } from './TikTokExportPanel'
import type { Route } from 'next'

// ── Types ─────────────────────────────────────────────────────────────────────

type VideoStyle = 'dinamico' | 'elegante' | 'minimalista' | 'energico'
type VideoPlatform = 'instagram' | 'tiktok' | 'youtube'
type VideoStatus = 'draft' | 'generating_script' | 'generating_voiceover' | 'generating_video' | 'completed' | 'failed'

interface VideoProject {
  id: string
  title: string
  status: VideoStatus
  style: VideoStyle
  platform: VideoPlatform
  duration_seconds: number
  video_url: string | null
  thumbnail_url: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface StatusResponse {
  id: string
  status: VideoStatus
  script: string | null
  voiceover_url: string | null
  video_url: string | null
  error_message: string | null
  updated_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { value: VideoStyle; label: string }[] = [
  { value: 'dinamico',    label: 'Dinamico' },
  { value: 'elegante',    label: 'Elegante' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'energico',    label: 'Energico' },
]

const PLATFORM_OPTIONS: { value: VideoPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram Reels' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'youtube',   label: 'YouTube Shorts' },
]

const GENERATION_STEPS: { key: VideoStatus; label: string }[] = [
  { key: 'generating_script',    label: 'Escribiendo el guion...' },
  { key: 'generating_voiceover', label: 'Generando la voz en off...' },
  { key: 'generating_video',     label: 'Creando el video con IA...' },
  { key: 'completed',            label: 'Completado' },
]

const STATUS_BADGE: Record<string, { variant: 'neutral' | 'info' | 'success' | 'error'; label: string }> = {
  draft:                { variant: 'neutral', label: 'Borrador' },
  generating_script:    { variant: 'info',    label: 'Generando' },
  generating_voiceover: { variant: 'info',    label: 'Generando' },
  generating_video:     { variant: 'info',    label: 'Generando' },
  completed:            { variant: 'success', label: 'Completado' },
  failed:               { variant: 'error',   label: 'Fallido' },
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB = 5

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function stepIndex(status: VideoStatus): number {
  return GENERATION_STEPS.findIndex(s => s.key === status)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VideoPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [businessId, setBusinessId] = useState('')
  const [plan, setPlan] = useState<string>('basic')
  const [loading, setLoading] = useState(true)

  // ── Form ───────────────────────────────────────────────────────────────────
  const [title, setTitle] = useState('')
  const [uploadedImages, setUploadedImages] = useState<{ url: string; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [style, setStyle] = useState<VideoStyle>('dinamico')
  const [platform, setPlatform] = useState<VideoPlatform>('instagram')
  const [duration, setDuration] = useState<15 | 30>(15)
  const [customText, setCustomText] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // ── Generating state ───────────────────────────────────────────────────────
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [generatingStatus, setGeneratingStatus] = useState<VideoStatus | null>(null)
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null)
  const [generatedVoiceoverUrl, setGeneratedVoiceoverUrl] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // ── Videos list ────────────────────────────────────────────────────────────
  const [videos, setVideos] = useState<VideoProject[]>([])
  const [modalVideo, setModalVideo] = useState<VideoProject | null>(null)

  // ── Boot ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: biz } = await supabase
        .from('businesses')
        .select('id, plan')
        .eq('owner_id', user.id)
        .single()

      if (!biz) { router.push('/onboarding'); return }

      setBusinessId(biz.id)
      setPlan(biz.plan)
      setLoading(false)

      if (biz.plan === 'basic' || biz.plan === 'pro') return
      fetchVideos(biz.id)
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchVideos = useCallback(async (bid: string) => {
    const res = await fetch(`/api/video/list?business_id=${bid}`)
    if (res.ok) {
      const data = await res.json()
      setVideos(data)
    }
  }, [])

  // ── Polling ────────────────────────────────────────────────────────────────

  const startPolling = useCallback((projectId: string, bid: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/video/status?project_id=${projectId}&business_id=${bid}`)
        if (!res.ok) return
        const data: StatusResponse = await res.json()

        setGeneratingStatus(data.status)

        if (data.script) {
          try {
            const parsed = JSON.parse(data.script)
            setGeneratedScript(
              `Apertura: ${parsed.opening_text}\n\nVoz en off: ${parsed.voiceover_script}\n\nCierre: ${parsed.closing_text}`
            )
          } catch {
            setGeneratedScript(data.script)
          }
        }

        if (data.video_url) setGeneratedVideoUrl(data.video_url)
        if (data.voiceover_url) setGeneratedVoiceoverUrl(data.voiceover_url)

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          if (data.error_message) setGenerationError(data.error_message)
          fetchVideos(bid)
        }
      } catch (err) {
        console.error('[video/polling] error:', err)
      }
    }, 5000)
  }, [fetchVideos])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // ── Image upload ───────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const remaining = 10 - uploadedImages.length
    const toUpload = files.slice(0, remaining)

    setUploadError('')
    setUploading(true)

    const results: { url: string; name: string }[] = []

    for (const file of toUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setUploadError('Solo se permiten JPG, PNG o WebP')
        continue
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setUploadError(`La imagen "${file.name}" supera ${MAX_SIZE_MB}MB`)
        continue
      }

      const form = new FormData()
      form.append('file', file)
      form.append('business_id', businessId)

      // Reuse existing upload endpoint
      const res = await fetch('/api/menu/upload-item-image', { method: 'POST', body: form })
      if (res.ok) {
        const data = await res.json()
        results.push({ url: data.image_url, name: file.name })
      } else {
        setUploadError(`Error al subir "${file.name}"`)
      }
    }

    setUploadedImages(prev => [...prev, ...results])
    setUploading(false)
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeImage(index: number) {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  // ── Create project ─────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!businessId || uploadedImages.length < 3 || !title) return
    setCreating(true)
    setCreateError('')
    setGenerationError(null)
    setGeneratingStatus(null)
    setGeneratedScript(null)
    setGeneratedVideoUrl(null)
    setGeneratedVoiceoverUrl(null)

    try {
      const res = await fetch('/api/video/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          title,
          image_urls: uploadedImages.map(i => i.url),
          style,
          platform,
          duration_seconds: duration,
          custom_text: customText || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Error al crear'); return }

      setActiveProjectId(data.project_id)
      setGeneratingStatus('generating_script')
      startPolling(data.project_id, businessId)
    } catch {
      setCreateError('Error de conexion')
    } finally {
      setCreating(false)
    }
  }

  function handleRetry() {
    setActiveProjectId(null)
    setGeneratingStatus(null)
    setGenerationError(null)
    setGeneratedScript(null)
    setGeneratedVideoUrl(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[#374151]">Cargando...</p>
      </div>
    )
  }

  // Plan gate
  if (plan === 'basic' || plan === 'pro') {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title="Generador de video"
          subtitle="Crea Reels y TikToks automaticamente con IA"
        />
        <Card>
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[#111827] mb-1">
                El generador de video esta disponible en el plan Business o superior
              </p>
              <p className="text-sm text-[#374151]">
                Genera Reels y TikToks automaticamente con IA, voz en off y guion personalizado.
              </p>
            </div>
            <Link href={'/pricing' as Route}>
              <Button>Ver planes</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const isGenerating = generatingStatus !== null && generatingStatus !== 'completed' && generatingStatus !== 'failed'
  const currentStepIdx = generatingStatus ? stepIndex(generatingStatus) : -1

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <PageHeader
        title="Generador de video"
        subtitle="Crea Reels y TikToks automaticamente con IA"
      />

      <div className="flex gap-6 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ flex: '0 0 55%' }}>

          {/* Generating state */}
          {generatingStatus && (
            <Card>
              <h2 className="text-base font-semibold text-[#111827] mb-5">Generando tu video</h2>

              {/* Progress steps */}
              <div className="flex flex-col gap-3 mb-6">
                {GENERATION_STEPS.map((step, idx) => {
                  const done = currentStepIdx > idx || generatingStatus === 'completed'
                  const active = idx === currentStepIdx && generatingStatus !== 'completed' && generatingStatus !== 'failed'
                  return (
                    <div key={step.key} className="flex items-center gap-3">
                      <div
                        className={[
                          'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-medium',
                          done
                            ? 'bg-[#059669] text-white'
                            : active
                              ? 'bg-[#2563EB] text-white'
                              : 'bg-[#F3F4F6] text-[#4B5563]',
                        ].join(' ')}
                      >
                        {done ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={[
                          'text-sm',
                          active ? 'text-[#111827] font-medium' : done ? 'text-[#374151]' : 'text-[#4B5563]',
                        ].join(' ')}>
                          {step.label}
                        </span>
                        {active && (
                          <div className="flex gap-0.5">
                            {[0, 1, 2].map(i => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 bg-[#2563EB] rounded-full"
                                style={{ animation: `pulse 1.2s ${i * 0.2}s infinite` }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[#F3F4F6] rounded-full h-2 mb-4">
                <div
                  className="bg-[#2563EB] h-2 rounded-full transition-all duration-500"
                  style={{
                    width: generatingStatus === 'completed'
                      ? '100%'
                      : `${Math.max(5, (currentStepIdx / (GENERATION_STEPS.length - 1)) * 100)}%`,
                  }}
                />
              </div>

              {isGenerating && (
                <p className="text-xs text-[#4B5563] text-center">
                  La generacion del video puede tardar entre 1 y 3 minutos
                </p>
              )}

              {/* Error */}
              {generatingStatus === 'failed' && (
                <div className="flex flex-col gap-3 mt-2">
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-700">{generationError ?? 'Error al generar el video'}</p>
                  </div>
                  <Button variant="secondary" onClick={handleRetry}>Intentar de nuevo</Button>
                </div>
              )}

              {/* Completed */}
              {generatingStatus === 'completed' && generatedVideoUrl && (
                <div className="flex flex-col gap-4 mt-2">
                  <video
                    src={generatedVideoUrl}
                    controls
                    className="w-full rounded-lg bg-black"
                    style={{ maxHeight: 480 }}
                  />

                  <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" onClick={handleRetry}>
                      Crear otro video
                    </Button>
                  </div>

                  <p className="text-xs text-[#4B5563]">
                    El video se ha guardado automaticamente en tu biblioteca.
                  </p>

                  {/* TikTok export — caption pre-filled from generated script */}
                  <TikTokExportPanel
                    videoUrl={generatedVideoUrl}
                    videoTitle={title}
                    initialCaption={generatedScript ?? ''}
                  />
                </div>
              )}
            </Card>
          )}

          {/* Form — shown when not generating */}
          {!generatingStatus && (
            <Card>
              <h2 className="text-base font-semibold text-[#111827] mb-5">Nuevo video</h2>

              <div className="flex flex-col gap-4">

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Titulo del video</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: Nuevo menu de verano"
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                {/* Image upload */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-[#374151]">Fotos</label>
                    <span className="text-xs text-[#4B5563]">{uploadedImages.length} de 10</span>
                  </div>

                  {/* Drop zone */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || uploadedImages.length >= 10}
                    className={[
                      'w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors',
                      uploadedImages.length >= 10
                        ? 'border-[#E5E7EB] cursor-not-allowed opacity-50'
                        : 'border-[#D1D5DB] hover:border-[#2563EB] hover:bg-[#EFF6FF] cursor-pointer',
                    ].join(' ')}
                  >
                    {uploading ? (
                      <p className="text-sm text-[#374151]">Subiendo...</p>
                    ) : (
                      <>
                        <svg className="w-6 h-6 text-[#4B5563] mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                        <p className="text-sm text-[#374151]">
                          {uploadedImages.length === 0
                            ? 'Sube entre 3 y 10 fotos'
                            : 'Anadir mas fotos'}
                        </p>
                        <p className="text-xs text-[#4B5563] mt-1">JPG, PNG o WebP — max {MAX_SIZE_MB}MB cada una</p>
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {uploadError && (
                    <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                  )}

                  {/* Image grid */}
                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 mt-3">
                      {uploadedImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Style */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Estilo</label>
                  <select
                    value={style}
                    onChange={e => setStyle(e.target.value as VideoStyle)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    {STYLE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {/* Platform + Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Plataforma</label>
                    <select
                      value={platform}
                      onChange={e => setPlatform(e.target.value as VideoPlatform)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      {PLATFORM_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Duracion</label>
                    <select
                      value={duration}
                      onChange={e => setDuration(Number(e.target.value) as 15 | 30)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      <option value={15}>15 segundos</option>
                      <option value={30}>30 segundos</option>
                    </select>
                  </div>
                </div>

                {/* Custom text */}
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">
                    Mensaje principal <span className="text-[#4B5563] font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder="Ej: Nuevo menu de verano disponible esta semana"
                    rows={2}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                {createError && (
                  <p className="text-sm text-red-600">{createError}</p>
                )}

                <Button
                  onClick={handleCreate}
                  disabled={creating || uploadedImages.length < 3 || !title}
                >
                  {creating ? 'Iniciando...' : 'Generar video con IA'}
                </Button>

                {uploadedImages.length < 3 && uploadedImages.length > 0 && (
                  <p className="text-xs text-[#4B5563] text-center">
                    Necesitas al menos {3 - uploadedImages.length} foto{3 - uploadedImages.length !== 1 ? 's' : ''} mas
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN — Mis videos ────────────────────────────────────── */}
        <div className="flex flex-col gap-3" style={{ flex: '0 0 43%' }}>
          <p className="text-sm font-medium text-[#374151]">Mis videos</p>

          {videos.length === 0 && (
            <Card padding="sm">
              <p className="text-sm text-[#4B5563] text-center py-4">
                Aun no has generado ningun video.
              </p>
            </Card>
          )}

          {videos.map(video => {
            const badge = STATUS_BADGE[video.status] ?? STATUS_BADGE.draft
            const isGeneratingThisOne =
              video.id === activeProjectId &&
              video.status !== 'completed' &&
              video.status !== 'failed'

            return (
              <Card key={video.id} padding="sm">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-[#F3F4F6] shrink-0 overflow-hidden flex items-center justify-center">
                    {video.video_url ? (
                      <video
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111827] truncate">{video.title}</p>
                    <p className="text-xs text-[#4B5563]">{formatDate(video.created_at)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {isGeneratingThisOne && (
                        <span className="text-xs text-[#374151]">actualizando...</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {video.status === 'completed' && video.video_url && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => setModalVideo(video)}
                        className="text-xs text-[#2563EB] hover:underline"
                      >
                        Ver
                      </button>
                      <a
                        href={video.video_url}
                        download={`${video.title}.mp4`}
                        className="text-xs text-[#374151] hover:text-[#111827]"
                      >
                        Descargar
                      </a>
                    </div>
                  )}
                </div>

                {video.status === 'failed' && video.error_message && (
                  <p className="text-xs text-red-600 mt-2 truncate">{video.error_message}</p>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* ── Video modal ──────────────────────────────────────────────────────── */}
      {modalVideo && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setModalVideo(null)}
        >
          <div
            className="bg-white rounded-xl p-4 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-[#111827] truncate">{modalVideo.title}</p>
              <button
                onClick={() => setModalVideo(null)}
                className="text-[#4B5563] hover:text-[#374151] ml-2 shrink-0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <video
              src={modalVideo.video_url!}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
              style={{ maxHeight: 360 }}
            />
            <TikTokExportPanel
              videoUrl={modalVideo.video_url!}
              videoTitle={modalVideo.title}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}


