'use client'

import type { ReactElement } from 'react'
import { useState } from 'react'
import type { SocialPlatform, PromotionType } from '@/types'

export type ContentType = 'post' | 'story' | 'promotion' | 'hashtags'
export type VisualStyle = 'moderno' | 'divertido' | 'elegante' | 'urgente'

// ── Colors ────────────────────────────────────────────────────────
const C = {
  border:    '#EAECF0',
  primary:   '#1A56DB',
  primaryLt: '#EEF3FE',
  t1:        '#111827',
  t3:        '#5A6070',
  t4:        '#9EA3AE',
}

// ── Platform SVG icons ────────────────────────────────────────────
function IgIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="0.8" fill={color} stroke="none" />
    </svg>
  )
}

function FbIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

function TkIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.75a4.85 4.85 0 01-1-.06z" />
    </svg>
  )
}

function WaIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────
const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'post',      label: 'Post' },
  { value: 'story',     label: 'Historia' },
  { value: 'promotion', label: 'Promocion' },
  { value: 'hashtags',  label: 'Hashtags' },
]

const PLATFORM_META: Record<
  SocialPlatform,
  { label: string; Icon: (p: { size?: number; color: string }) => ReactElement; color: string; bg: string }
> = {
  instagram: { label: 'Instagram', Icon: IgIcon, color: '#E1306C', bg: '#FFF0F6' },
  facebook:  { label: 'Facebook',  Icon: FbIcon, color: '#1877F2', bg: '#EFF6FF' },
  tiktok:    { label: 'TikTok',    Icon: TkIcon, color: '#111827', bg: '#F3F4F6' },
  whatsapp:  { label: 'WhatsApp',  Icon: WaIcon, color: '#25D366', bg: '#ECFDF5' },
  google:    { label: 'Google',    Icon: ({ size = 15, color }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  ), color: '#4285F4', bg: '#EFF6FF' },
}

const PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'whatsapp']

const VISUAL_STYLES: { value: VisualStyle; label: string; icon: string }[] = [
  { value: 'moderno',   label: 'Moderno',   icon: '⚡' },
  { value: 'divertido', label: 'Divertido', icon: '🎉' },
  { value: 'elegante',  label: 'Elegante',  icon: '🥂' },
  { value: 'urgente',   label: 'Urgente',   icon: '🔥' },
]

const PROMOTION_TYPES: { value: PromotionType; label: string }[] = [
  { value: 'oferta_2x1',    label: 'Oferta 2x1' },
  { value: 'menu_dia',      label: 'Menu del dia' },
  { value: 'happy_hour',    label: 'Happy Hour' },
  { value: 'sorteo',        label: 'Sorteo' },
  { value: 'evento',        label: 'Evento' },
  { value: 'nuevo_producto',label: 'Nuevo producto' },
  { value: 'black_friday',  label: 'Black Friday' },
  { value: 'navidad',       label: 'Navidad' },
  { value: 'san_valentin',  label: 'San Valentin' },
  { value: 'halloween',     label: 'Halloween' },
  { value: 'apertura',      label: 'Gran apertura' },
  { value: 'aniversario',   label: 'Aniversario' },
]

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: C.t4,
}

// ── Component ─────────────────────────────────────────────────────
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
  const [ctxOpen, setCtxOpen] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#FFFFFF',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 16px 14px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.t1, letterSpacing: '-0.2px' }}>
            Crear contenido
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              background: C.primaryLt,
              color: C.primary,
              padding: '2px 7px',
              borderRadius: 100,
              border: '1px solid #C7D9FB',
            }}
          >
            IA
          </span>
        </div>
        <p style={{ fontSize: 11, color: C.t4 }}>Adaptado a tu negocio automaticamente</p>
      </div>

      {/* Scrollable */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Tipo — horizontal tab bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabel}>Tipo</span>
          <div
            style={{
              display: 'flex',
              background: '#F3F4F6',
              borderRadius: 9,
              padding: 3,
              gap: 2,
            }}
          >
            {CONTENT_TYPES.map((ct) => (
              <button
                key={ct.value}
                onClick={() => onContentTypeChange(ct.value)}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: contentType === ct.value ? 600 : 400,
                  background: contentType === ct.value ? '#FFFFFF' : 'transparent',
                  color: contentType === ct.value ? C.t1 : C.t3,
                  boxShadow: contentType === ct.value ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 120ms ease',
                  fontFamily: 'inherit',
                }}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plataforma — 2x2 icon cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabel}>Plataforma</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {PLATFORMS.map((key) => {
              const meta = PLATFORM_META[key]
              const isActive = platform === key
              const { Icon } = meta
              return (
                <button
                  key={key}
                  onClick={() => onPlatformChange(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 11px',
                    borderRadius: 9,
                    border: `1.5px solid ${isActive ? meta.color : C.border}`,
                    background: isActive ? meta.bg : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    fontFamily: 'inherit',
                  }}
                >
                  <Icon size={16} color={isActive ? meta.color : C.t4} />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? meta.color : C.t3,
                    }}
                  >
                    {meta.label}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: meta.color,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Estilo visual — 2x2 grid with emoji */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={sectionLabel}>Estilo visual</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {VISUAL_STYLES.map((s) => {
              const isActive = visualStyle === s.value
              return (
                <button
                  key={s.value}
                  onClick={() => onVisualStyleChange(s.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${isActive ? C.primary : C.border}`,
                    background: isActive ? C.primaryLt : '#FAFAFA',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? C.primary : C.t3,
                    fontFamily: 'inherit',
                  }}
                >
                  <span>{s.icon}</span>
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tipo de promocion — solo si promotion */}
        {contentType === 'promotion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={sectionLabel}>Tipo de promocion</span>
            <select
              value={promotionType}
              onChange={(e) => onPromotionTypeChange(e.target.value as PromotionType)}
              style={{
                width: '100%',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                padding: '8px 10px',
                fontSize: 12,
                color: C.t1,
                background: '#FFFFFF',
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

        {/* Contexto adicional — collapsible */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setCtxOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit',
            }}
          >
            <span style={sectionLabel}>Contexto adicional</span>
            <span
              style={{
                fontSize: 10,
                color: C.t4,
                display: 'inline-block',
                transform: ctxOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms',
              }}
            >
              ▾
            </span>
          </button>
          {ctxOpen ? (
            <textarea
              value={customInstructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder="Ej: oferta valida solo este fin de semana, mencionar reserva..."
              rows={3}
              style={{
                width: '100%',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                padding: '8px 10px',
                fontSize: 12,
                color: C.t1,
                background: '#FFFFFF',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.55,
                boxSizing: 'border-box',
                transition: 'border-color 120ms',
              }}
              onFocus={(e) => { e.target.style.borderColor = C.primary }}
              onBlur={(e) => { e.target.style.borderColor = C.border }}
            />
          ) : (
            <button
              onClick={() => setCtxOpen(true)}
              style={{
                padding: '7px 10px',
                borderRadius: 8,
                border: `1px dashed ${C.border}`,
                background: 'transparent',
                color: C.t4,
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              + Anadir contexto opcional...
            </button>
          )}
        </div>
      </div>

      {/* Generate CTA */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
        <button
          onClick={onGenerate}
          disabled={loading}
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 9,
            border: 'none',
            background: loading
              ? '#9EB8F4'
              : 'linear-gradient(135deg, #1A56DB 0%, #2563EB 100%)',
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: loading ? 'none' : '0 2px 8px rgba(26,86,219,0.35)',
            transition: 'all 150ms ease',
            letterSpacing: '-0.1px',
            fontFamily: 'inherit',
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Generando...
            </>
          ) : (
            <>Generar con IA</>
          )}
        </button>
      </div>
    </div>
  )
}
