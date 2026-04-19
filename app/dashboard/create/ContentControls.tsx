'use client'

import type { ReactElement } from 'react'
import { Button } from '@/components/ui/Button'
import type { SocialPlatform, PromotionType } from '@/types'

export type ContentType = 'post' | 'story' | 'promotion' | 'hashtags'
export type VisualStyle = 'moderno' | 'divertido' | 'elegante' | 'urgente'

// ── Platform SVG icons ────────────────────────────────────────────

function IgIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="0.8" fill={color} stroke="none" />
    </svg>
  )
}

function FbIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function TkIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.75a4.85 4.85 0 01-1-.06z" />
    </svg>
  )
}

function WaIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

const PLATFORM_ICONS: Record<SocialPlatform, (color: string) => ReactElement> = {
  instagram: (c) => <IgIcon color={c} />,
  facebook:  (c) => <FbIcon color={c} />,
  tiktok:    (c) => <TkIcon color={c} />,
  whatsapp:  (c) => <WaIcon color={c} />,
  google:    (c) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ),
}

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Historia' },
  { value: 'promotion', label: 'Promocion' },
  { value: 'hashtags', label: 'Hashtags' },
]

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const VISUAL_STYLES: { value: VisualStyle; label: string }[] = [
  { value: 'moderno', label: 'Moderno' },
  { value: 'divertido', label: 'Divertido' },
  { value: 'elegante', label: 'Elegante' },
  { value: 'urgente', label: 'Urgente' },
]

const PROMOTION_TYPES: { value: PromotionType; label: string }[] = [
  { value: 'oferta_2x1', label: 'Oferta 2x1' },
  { value: 'menu_dia', label: 'Menu del dia' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'sorteo', label: 'Sorteo' },
  { value: 'evento', label: 'Evento' },
  { value: 'nuevo_producto', label: 'Nuevo producto' },
  { value: 'black_friday', label: 'Black Friday' },
  { value: 'navidad', label: 'Navidad' },
  { value: 'san_valentin', label: 'San Valentin' },
  { value: 'halloween', label: 'Halloween' },
  { value: 'apertura', label: 'Gran apertura' },
  { value: 'aniversario', label: 'Aniversario' },
]

interface ContentControlsProps {
  contentType: ContentType
  platform: SocialPlatform
  visualStyle: VisualStyle
  promotionType: PromotionType
  customInstructions: string
  loading: boolean
  onContentTypeChange: (v: ContentType) => void
  onPlatformChange: (v: SocialPlatform) => void
  onVisualStyleChange: (v: VisualStyle) => void
  onPromotionTypeChange: (v: PromotionType) => void
  onInstructionsChange: (v: string) => void
  onGenerate: () => void
}

const label = {
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#9EA3AE',
  marginBottom: 8,
}

export function ContentControls({
  contentType,
  platform,
  visualStyle,
  promotionType,
  customInstructions,
  loading,
  onContentTypeChange,
  onPlatformChange,
  onVisualStyleChange,
  onPromotionTypeChange,
  onInstructionsChange,
  onGenerate,
}: ContentControlsProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #EAECF0',
      }}
    >
      {/* Scrollable content */}
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
            Crear contenido
          </p>
          <p style={{ fontSize: 12, color: '#5A6070', marginTop: 3 }}>
            IA adaptada a tu negocio
          </p>
        </div>

        {/* Tipo */}
        <div>
          <p style={label}>Tipo</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => onContentTypeChange(ct.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: contentType === ct.value ? '#1A56DB' : '#EAECF0',
                  backgroundColor: contentType === ct.value ? '#EEF3FE' : '#F4F5F7',
                  color: contentType === ct.value ? '#1A56DB' : '#5A6070',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plataforma */}
        <div>
          <p style={label}>Plataforma</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => onPlatformChange(p.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: platform === p.value ? 500 : 400,
                  border: '1px solid',
                  borderColor: platform === p.value ? '#1A56DB' : 'transparent',
                  backgroundColor: platform === p.value ? '#EEF3FE' : 'transparent',
                  color: platform === p.value ? '#1A56DB' : '#5A6070',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    marginRight: 9,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    opacity: platform === p.value ? 1 : 0.45,
                    transition: 'opacity 120ms ease',
                  }}
                >
                  {PLATFORM_ICONS[p.value]?.(platform === p.value ? '#1A56DB' : '#5A6070')}
                </span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Estilo visual */}
        <div>
          <p style={label}>Estilo visual</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {VISUAL_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => onVisualStyleChange(s.value)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  border: '1px solid',
                  borderColor: visualStyle === s.value ? '#1A56DB' : '#EAECF0',
                  backgroundColor: visualStyle === s.value ? '#EEF3FE' : '#F4F5F7',
                  color: visualStyle === s.value ? '#1A56DB' : '#5A6070',
                  cursor: 'pointer',
                  transition: 'all 120ms ease',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de promocion — solo si promotion */}
        {contentType === 'promotion' && (
          <div>
            <p style={label}>Tipo de promocion</p>
            <select
              value={promotionType}
              onChange={(e) => onPromotionTypeChange(e.target.value as PromotionType)}
              style={{
                width: '100%',
                borderRadius: 8,
                border: '1px solid #EAECF0',
                padding: '8px 10px',
                fontSize: 13,
                color: '#111827',
                backgroundColor: '#FFFFFF',
                outline: 'none',
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              {PROMOTION_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Contexto adicional */}
        <div>
          <p style={label}>
            Contexto{' '}
            <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#9EA3AE' }}>
              (opcional)
            </span>
          </p>
          <textarea
            value={customInstructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder="Ej: oferta valida solo este fin de semana, mencionar reserva"
            rows={4}
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid #EAECF0',
              padding: '8px 10px',
              fontSize: 12,
              color: '#111827',
              backgroundColor: '#FFFFFF',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.55,
              boxSizing: 'border-box',
              transition: 'border-color 120ms ease',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#1A56DB' }}
            onBlur={(e) => { e.target.style.borderColor = '#EAECF0' }}
          />
        </div>
      </div>

      {/* Generate — fixed bottom */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #EAECF0' }}>
        <Button onClick={onGenerate} loading={loading} size="lg" className="w-full">
          {loading ? 'Generando...' : 'Generar con IA'}
        </Button>
      </div>
    </div>
  )
}

