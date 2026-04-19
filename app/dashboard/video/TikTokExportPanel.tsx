'use client'

import { useState } from 'react'

interface TikTokExportPanelProps {
  videoUrl: string
  videoTitle: string
  /** Pre-filled from generated script. User can edit before exporting. */
  initialCaption?: string
}

type PanelState = 'idle' | 'exporting' | 'done'

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.28 6.28 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.81a8.27 8.27 0 0 0 4.84 1.54V6.89a4.85 4.85 0 0 1-1.07-.2z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

export function TikTokExportPanel({
  videoUrl,
  videoTitle,
  initialCaption = '',
}: TikTokExportPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('idle')
  const [caption, setCaption] = useState(initialCaption)
  const [hashtags, setHashtags] = useState('')
  const [captionCopied, setCaptionCopied] = useState(false)
  const [hashtagsCopied, setHashtagsCopied] = useState(false)
  const [clipboardFailed, setClipboardFailed] = useState(false)

  async function handleExport() {
    setPanelState('exporting')

    // 1 — trigger download
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `${videoTitle || 'video-tiktok'}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 2 — copy caption
    const textToCopy = [caption.trim(), hashtags.trim()].filter(Boolean).join('\n\n')
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy)
        setCaptionCopied(true)
      } catch {
        setClipboardFailed(true)
      }
    }

    setPanelState('done')
  }

  async function copyText(text: string, setter: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      setTimeout(() => setter(false), 2200)
    } catch {
      setClipboardFailed(true)
    }
  }

  // ── Idle / Exporting ──────────────────────────────────────────────────────

  if (panelState !== 'done') {
    return (
      <div className="flex flex-col gap-3 pt-4 border-t border-[#E5E7EB]">

        <div className="flex items-center gap-2">
          <TikTokIcon className="shrink-0" />
          <p className="text-sm font-semibold text-[#111827]">Exportar a TikTok</p>
        </div>

        {/* Caption */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
            Texto del video
          </label>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={4}
            placeholder="Escribe la descripcion para el video..."
            className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* Hashtags */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#374151] uppercase tracking-wide">
            Hashtags{' '}
            <span className="font-normal normal-case text-[#4B5563]">(opcional)</span>
          </label>
          <input
            type="text"
            value={hashtags}
            onChange={e => setHashtags(e.target.value)}
            placeholder="#restaurante #comida #foodie"
            className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={panelState === 'exporting'}
          className="w-full flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#1F2937] text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {panelState === 'exporting' ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Preparando...
            </>
          ) : (
            <>
              <TikTokIcon />
              Exportar a TikTok
            </>
          )}
        </button>

        <p className="text-xs text-[#4B5563] text-center">
          Descarga el video y copia el texto. La subida es manual en TikTok.
        </p>
      </div>
    )
  }

  // ── Done — step guide ─────────────────────────────────────────────────────

  const steps: { label: string; done: boolean }[] = [
    { label: 'Video descargado en tu dispositivo', done: true },
    { label: 'Abre TikTok en tu movil', done: false },
    { label: 'Toca "+" y selecciona el video descargado', done: false },
    {
      label: captionCopied
        ? 'Texto copiado — pégalo en la descripcion'
        : 'Pega el texto en la descripcion del video',
      done: captionCopied,
    },
  ]

  const fullText = [caption.trim(), hashtags.trim()].filter(Boolean).join('\n\n')

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-[#E5E7EB]">

      {/* Banner */}
      <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
        <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <p className="text-sm text-green-800">
          {clipboardFailed
            ? 'Video descargado. Copia el texto manualmente antes de abrir TikTok.'
            : captionCopied
              ? 'Video descargado y texto copiado al portapapeles.'
              : 'Video descargado correctamente.'}
        </p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={[
                'w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold',
                step.done
                  ? 'bg-green-500 text-white'
                  : 'bg-[#F3F4F6] text-[#4B5563]',
              ].join(' ')}
            >
              {step.done ? <CheckIcon /> : i + 1}
            </div>
            <span className={`text-sm ${step.done ? 'text-[#374151]' : 'text-[#374151]'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Text copy area */}
      {fullText && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#374151] uppercase tracking-wide">
              Texto para copiar
            </span>
            <button
              onClick={() => copyText(fullText, setCaptionCopied)}
              className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline"
            >
              <CopyIcon />
              {captionCopied ? 'Copiado' : 'Copiar todo'}
            </button>
          </div>
          <div className="bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-sm text-[#374151] leading-relaxed whitespace-pre-wrap select-all cursor-text">
            {fullText}
          </div>
        </div>
      )}

      {/* Hashtags copy (separate) */}
      {hashtags.trim() && (
        <button
          onClick={() => copyText(hashtags.trim(), setHashtagsCopied)}
          className="flex items-center justify-center gap-2 text-sm font-medium py-2 px-4 rounded-lg border border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          <CopyIcon />
          {hashtagsCopied ? 'Hashtags copiados' : 'Copiar hashtags'}
        </button>
      )}

      {/* Reset */}
      <button
        onClick={() => {
          setPanelState('idle')
          setCaptionCopied(false)
          setClipboardFailed(false)
        }}
        className="text-xs text-[#4B5563] hover:text-[#374151] text-center"
      >
        Volver a exportar
      </button>
    </div>
  )
}

