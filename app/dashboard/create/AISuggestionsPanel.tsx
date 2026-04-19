'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import type { PreviewData } from './preview-types'

interface Variant extends PreviewData {
  cta: string
  imagePrompt?: string
}

interface AISuggestionsPanelProps {
  variants: Variant[]
  selectedIdx: number
  editedTexts: string[]
  editedHashtags: string[][]
  editedCtas: string[]
  editedImages: (string | null)[]
  editedImagePrompts: string[]
  manuallyEdited: boolean[]
  loading: boolean
  improving: boolean
  businessId: string
  onSelectVariant: (idx: number) => void
  onTextChange: (idx: number, value: string) => void
  onHashtagsChange: (idx: number, value: string[]) => void
  onCtaChange: (idx: number, value: string) => void
  onImageChange: (idx: number, url: string | null) => void
  onImagePromptChange: (idx: number, value: string) => void
  onRegenerate: () => void
  onImprove: (instruction?: string) => void
  onDuplicate: () => void
  onSaveTemplate: () => void
}

const QUICK_ACTIONS: { label: string; instruction: string }[] = [
  { label: 'Hazlo mas urgente',     instruction: 'Reescribe el texto con mas urgencia y sensacion de escasez o tiempo limitado' },
  { label: 'CTA mas claro',         instruction: 'Reescribe el texto anadiendo una llamada a la accion clara y directa al final' },
  { label: 'Version mas corta',     instruction: 'Reescribe el texto de forma mucho mas concisa, maximo 3 frases' },
  { label: 'Tono mas cercano',      instruction: 'Reescribe el texto con un tono mas cercano, amigable y conversacional' },
]

const CAPTION_MIN = 20
const CAPTION_MAX = 300
const HASHTAGS_MAX = 10

const label = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#9EA3AE',
  marginBottom: 6,
}

// Parse a space-separated hashtag string into an array (keeps # prefix, removes empties)
function parseHashtags(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map((t) => {
      const clean = t.startsWith('#') ? t : t ? `#${t}` : ''
      return clean
    })
    .filter(Boolean)
}

export function AISuggestionsPanel({
  variants,
  selectedIdx,
  editedTexts,
  editedHashtags,
  editedCtas,
  editedImages,
  editedImagePrompts,
  manuallyEdited,
  loading,
  improving,
  businessId,
  onSelectVariant,
  onTextChange,
  onHashtagsChange,
  onCtaChange,
  onImageChange,
  onImagePromptChange,
  onRegenerate,
  onImprove,
  onDuplicate,
  onSaveTemplate,
}: AISuggestionsPanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeVariant   = variants[selectedIdx]
  const activeText      = editedTexts[selectedIdx]      ?? activeVariant?.text      ?? ''
  const activeHashtags  = editedHashtags[selectedIdx]   ?? activeVariant?.hashtags  ?? []
  const activeCta       = editedCtas[selectedIdx]       ?? activeVariant?.cta       ?? ''
  const activeImage     = editedImages[selectedIdx] !== undefined
    ? editedImages[selectedIdx]
    : activeVariant?.imageUrl ?? null
  const activeImagePrompt = editedImagePrompts[selectedIdx] ?? activeVariant?.imagePrompt ?? ''
  const isManuallyEdited  = manuallyEdited[selectedIdx]  ?? false

  const hasVariants = variants.length > 0

  // Caption validation
  const captionLen       = activeText.length
  const captionTooShort  = captionLen > 0 && captionLen < CAPTION_MIN
  const captionTooLong   = captionLen > CAPTION_MAX
  const captionInvalid   = captionTooShort || captionTooLong

  // Hashtag validation
  const hashtagCount    = activeHashtags.length
  const tooManyHashtags = hashtagCount > HASHTAGS_MAX

  // Local state
  const [copied, setCopied]               = useState(false)
  const [showPromptEditor, setShowPromptEditor] = useState(false)
  const [regenerating, setRegenerating]   = useState(false)
  const [imageError, setImageError]       = useState<string | null>(null)

  function handleCopyAll() {
    if (!activeVariant) return
    const tags = activeHashtags.join(' ')
    const full = tags ? `${activeText}\n\n${tags}` : activeText
    navigator.clipboard.writeText(full).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so the same file can be re-selected
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      onImageChange(selectedIdx, dataUrl)
      setImageError(null)
    }
    reader.readAsDataURL(file)
  }

  async function handleRegenerateImage() {
    if (!activeImagePrompt.trim()) return
    setRegenerating(true)
    setImageError(null)
    try {
      const res = await fetch('/api/generate/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, prompt: activeImagePrompt }),
      })
      const data = await res.json()
      if (!res.ok) {
        setImageError(data.error ?? 'Error al regenerar imagen')
      } else {
        onImageChange(selectedIdx, data.image_url)
        setShowPromptEditor(false)
      }
    } catch {
      setImageError('Error al regenerar imagen. Intentalo de nuevo.')
    }
    setRegenerating(false)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #EAECF0',
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Scrollable area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Header */}
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', letterSpacing: '-0.2px' }}>
            Variantes
          </p>
          <p style={{ fontSize: 12, color: '#5A6070', marginTop: 3 }}>
            {variants.length === 0 ? 'Genera para ver opciones' : 'Selecciona y edita'}
          </p>
        </div>

        {/* Variant cards */}
        <div>
          <p style={label}>Opciones generadas</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {variants.length === 0
              ? [1, 2, 3].map((n) => (
                  <div
                    key={n}
                    style={{
                      borderRadius: 10,
                      border: '1px dashed #EAECF0',
                      padding: '12px',
                      minHeight: 72,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      justifyContent: 'center',
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '40%' }} />
                        <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '90%' }} />
                        <div style={{ height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#F3F4F6 25%,#E5E7EB 50%,#F3F4F6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite', width: '70%' }} />
                        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
                      </>
                    ) : (
                      <span style={{ fontSize: 11, color: '#9EA3AE', textAlign: 'center' }}>Variante {n}</span>
                    )}
                  </div>
                ))
              : variants.map((v, idx) => {
                  const isSelected = selectedIdx === idx
                  const isEdited   = manuallyEdited[idx] ?? false
                  return (
                    <button
                      key={idx}
                      onClick={() => onSelectVariant(idx)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        borderRadius: 10,
                        border: '1px solid',
                        borderColor: isSelected ? '#1A56DB' : '#EAECF0',
                        backgroundColor: isSelected ? '#EEF3FE' : '#FFFFFF',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        fontFamily: 'inherit',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: isSelected ? '#1A56DB' : '#9EA3AE',
                          }}
                        >
                          Variante {idx + 1}
                        </span>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          {isEdited && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 999,
                                backgroundColor: '#FEF3C7',
                                color: '#92400E',
                                border: '1px solid #FDE68A',
                              }}
                            >
                              Editado
                            </span>
                          )}
                          {isSelected && (
                            <span style={{ fontSize: 10, color: '#1A56DB', fontWeight: 500 }}>
                              Activa
                            </span>
                          )}
                        </div>
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          color: '#111827',
                          lineHeight: 1.55,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {editedTexts[idx] ?? v.text}
                      </p>
                    </button>
                  )
                })}
          </div>
        </div>

        {/* ── Full editor (only when a variant is selected) ── */}
        {hasVariants && activeVariant && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Manual edit badge */}
            {isManuallyEdited && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 8,
                  backgroundColor: '#FFFBEB',
                  border: '1px solid #FDE68A',
                }}
              >
                <span style={{ fontSize: 13 }}>✏️</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: '#92400E' }}>
                  Editado manualmente
                </span>
              </div>
            )}

            {/* Caption */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={label}>Caption</p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: captionInvalid ? '#E02424' : captionLen >= CAPTION_MAX * 0.85 ? '#D97706' : '#9EA3AE',
                  }}
                >
                  {captionLen}/{CAPTION_MAX}
                </span>
              </div>
              <textarea
                value={activeText}
                onChange={(e) => onTextChange(selectedIdx, e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: `1px solid ${captionInvalid ? '#FECACA' : '#EAECF0'}`,
                  padding: '8px 10px',
                  fontSize: 12,
                  color: '#111827',
                  backgroundColor: captionInvalid ? '#FFF5F5' : '#FFFFFF',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.55,
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms ease',
                }}
                onFocus={(e) => {
                  if (!captionInvalid) e.target.style.borderColor = '#1A56DB'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = captionInvalid ? '#FECACA' : '#EAECF0'
                }}
              />
              {captionTooShort && (
                <p style={{ fontSize: 11, color: '#E02424', marginTop: 4 }}>
                  Minimo {CAPTION_MIN} caracteres
                </p>
              )}
              {captionTooLong && (
                <p style={{ fontSize: 11, color: '#E02424', marginTop: 4 }}>
                  Maximo {CAPTION_MAX} caracteres
                </p>
              )}
            </div>

            {/* Hashtags */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={label}>Hashtags</p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: tooManyHashtags ? '#E02424' : '#9EA3AE',
                  }}
                >
                  {hashtagCount}/{HASHTAGS_MAX}
                </span>
              </div>
              <input
                type="text"
                value={activeHashtags.join(' ')}
                onChange={(e) => {
                  const parsed = parseHashtags(e.target.value)
                  onHashtagsChange(selectedIdx, parsed)
                }}
                placeholder="#hashtag1 #hashtag2"
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: `1px solid ${tooManyHashtags ? '#FECACA' : '#EAECF0'}`,
                  padding: '7px 10px',
                  fontSize: 12,
                  color: '#111827',
                  backgroundColor: tooManyHashtags ? '#FFF5F5' : '#FFFFFF',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms ease',
                }}
                onFocus={(e) => {
                  if (!tooManyHashtags) e.target.style.borderColor = '#1A56DB'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = tooManyHashtags ? '#FECACA' : '#EAECF0'
                }}
              />
              {tooManyHashtags && (
                <p style={{ fontSize: 11, color: '#E02424', marginTop: 4 }}>
                  Maximo {HASHTAGS_MAX} hashtags
                </p>
              )}
            </div>

            {/* CTA */}
            <div>
              <p style={label}>CTA</p>
              <input
                type="text"
                value={activeCta}
                onChange={(e) => onCtaChange(selectedIdx, e.target.value)}
                placeholder="Ej: Reserva ahora, Ver menu, Llamar..."
                style={{
                  width: '100%',
                  borderRadius: 8,
                  border: '1px solid #EAECF0',
                  padding: '7px 10px',
                  fontSize: 12,
                  color: '#111827',
                  backgroundColor: '#FFFFFF',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'border-color 120ms ease',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#1A56DB' }}
                onBlur={(e) => { e.target.style.borderColor = '#EAECF0' }}
              />
            </div>

            {/* Image */}
            <div>
              <p style={{ ...label, marginBottom: 8 }}>Imagen</p>

              {/* Thumbnail row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {activeImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activeImage}
                    alt="Preview"
                    style={{
                      width: 64,
                      height: 64,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #EAECF0',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 8,
                      border: '1px dashed #EAECF0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 18, opacity: 0.3 }}>🖼</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  {/* Upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 7,
                      border: '1px solid #EAECF0',
                      fontSize: 11,
                      fontWeight: 500,
                      color: '#374151',
                      backgroundColor: '#F9FAFB',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    ↑ Subir imagen
                  </button>

                  {/* Regenerate with AI */}
                  <button
                    onClick={() => {
                      if (activeImagePrompt.trim()) {
                        handleRegenerateImage()
                      } else {
                        setShowPromptEditor(true)
                      }
                    }}
                    disabled={regenerating}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 7,
                      border: '1px solid #E0E7FF',
                      fontSize: 11,
                      fontWeight: 500,
                      color: regenerating ? '#9EA3AE' : '#1A56DB',
                      backgroundColor: regenerating ? '#F3F4F6' : '#EEF3FE',
                      cursor: regenerating ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                    }}
                  >
                    {regenerating ? '⏳ Generando...' : '✦ Regenerar imagen'}
                  </button>
                </div>
              </div>

              {/* Prompt editor toggle */}
              <button
                onClick={() => setShowPromptEditor((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  padding: '2px 0',
                  fontSize: 11,
                  fontWeight: 500,
                  color: '#1A56DB',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 9 }}>{showPromptEditor ? '▼' : '▶'}</span>
                Editar prompt de imagen
              </button>

              {showPromptEditor && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <textarea
                    value={activeImagePrompt}
                    onChange={(e) => onImagePromptChange(selectedIdx, e.target.value)}
                    rows={3}
                    placeholder="Describe la imagen que quieres generar..."
                    style={{
                      width: '100%',
                      borderRadius: 8,
                      border: '1px solid #EAECF0',
                      padding: '7px 10px',
                      fontSize: 11,
                      color: '#111827',
                      backgroundColor: '#FFFFFF',
                      outline: 'none',
                      resize: 'none',
                      fontFamily: 'inherit',
                      lineHeight: 1.5,
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = '#1A56DB' }}
                    onBlur={(e) => { e.target.style.borderColor = '#EAECF0' }}
                  />
                  <button
                    onClick={handleRegenerateImage}
                    disabled={regenerating || !activeImagePrompt.trim()}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 8,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#FFFFFF',
                      backgroundColor:
                        regenerating || !activeImagePrompt.trim() ? '#9EA3AE' : '#1A56DB',
                      cursor:
                        regenerating || !activeImagePrompt.trim() ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      transition: 'background-color 120ms ease',
                    }}
                  >
                    {regenerating ? 'Generando...' : 'Aplicar prompt'}
                  </button>
                </div>
              )}

              {imageError && (
                <p style={{ fontSize: 11, color: '#E02424', marginTop: 4 }}>{imageError}</p>
              )}
            </div>

            {/* Copy all */}
            <button
              onClick={handleCopyAll}
              style={{
                padding: '7px',
                borderRadius: 8,
                border: `1px solid ${copied ? '#A7F3D0' : '#EAECF0'}`,
                fontSize: 12,
                fontWeight: 500,
                color: copied ? '#059669' : '#5A6070',
                backgroundColor: copied ? '#ECFDF5' : '#F4F5F7',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 120ms ease',
              }}
            >
              {copied ? 'Copiado!' : 'Copiar caption + hashtags'}
            </button>
          </div>
        )}

        {/* Quick actions */}
        <div>
          <p style={label}>Sugerencias IA</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {QUICK_ACTIONS.map(({ label: actionLabel, instruction }) => (
              <button
                key={actionLabel}
                onClick={() => onImprove(instruction)}
                disabled={!hasVariants || improving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  color: !hasVariants ? '#9EA3AE' : '#1A56DB',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: !hasVariants || improving ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background-color 120ms ease',
                  opacity: !hasVariants ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (hasVariants && !improving) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#EEF3FE'
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                }}
              >
                <span style={{ fontSize: 10, opacity: 0.6 }}>↗</span>
                {actionLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions — fixed bottom */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid #EAECF0',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Primary actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            onClick={onRegenerate}
            loading={loading}
            disabled={improving}
            size="sm"
            style={{ flex: 1, fontSize: 12 }}
          >
            Regenerar
          </Button>
          <Button
            variant="secondary"
            onClick={onImprove}
            loading={improving}
            disabled={loading || variants.length === 0}
            size="sm"
            style={{ flex: 1, fontSize: 12 }}
          >
            Mejorar texto
          </Button>
        </div>

        {/* Secondary actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[
            { label: 'Duplicar',   action: onDuplicate,   disabled: variants.length === 0 },
            { label: 'Plantilla',  action: onSaveTemplate, disabled: variants.length === 0 },
            { label: 'Programar',  action: () => router.push('/dashboard/calendar'), disabled: false },
          ].map(({ label: lbl, action, disabled }) => (
            <button
              key={lbl}
              onClick={action}
              disabled={disabled}
              style={{
                padding: '7px 4px',
                borderRadius: 8,
                border: '1px solid #EAECF0',
                fontSize: 11,
                fontWeight: 500,
                color: disabled ? '#9EA3AE' : '#5A6070',
                backgroundColor: '#FFFFFF',
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 120ms ease',
                opacity: disabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!disabled) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#F4F5F7'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FFFFFF'
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
