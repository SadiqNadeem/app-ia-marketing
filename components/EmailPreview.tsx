'use client'

import { Check } from 'lucide-react'

interface EmailPreviewProps {
  businessName: string
  businessColor?: string
  subject?: string
  headline?: string
  body?: string
  ctaText?: string
  footerText?: string
}

function Skeleton({ w, h }: { w: string; h: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        background: '#F3F4F6',
        borderRadius: '4px',
        marginBottom: '6px',
      }}
    />
  )
}

export function EmailPreview({
  businessName,
  businessColor = '#2563EB',
  subject,
  headline,
  body,
  ctaText,
  footerText,
}: EmailPreviewProps) {
  const displayName = businessName.trim() || 'Mi Negocio'
  const hasContent = !!(headline?.trim() || body?.trim())
  const isEmpty = !subject?.trim() && !headline?.trim() && !body?.trim() && !ctaText?.trim() && !footerText?.trim()

  if (isEmpty) {
    return (
      <div
        style={{
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: '12px',
          padding: '40px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Mail icon placeholder */}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>

        <p style={{ fontSize: '14px', fontWeight: 500, color: '#9EA3AE', textAlign: 'center', margin: 0 }}>
          Aqui aparecera la vista previa
        </p>
        <p style={{ fontSize: '13px', color: '#D1D5DB', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          Genera un email con IA o empieza a escribir en el editor
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', width: '100%', maxWidth: '280px' }}>
          {[
            'Compatible con Gmail, Outlook y Apple Mail',
            'Se envia desde tu nombre de negocio',
            'Incluye enlace de baja automatico (obligatorio por ley)',
          ].map(text => (
            <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Check size={13} color="#22C55E" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span style={{ fontSize: '12px', color: '#9CA3AF', lineHeight: 1.4 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '520px',
        background: '#F1F3F4',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid #E5E7EB',
      }}
    >
      {/* Title bar */}
      <div
        style={{
          background: '#FFFFFF',
          padding: '10px 16px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {['#FF5F57', '#FFBD2E', '#28C840'].map(color => (
            <div key={color} style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
          ))}
        </div>
        <span
          style={{
            fontSize: '12px',
            color: subject?.trim() ? '#6B7280' : '#9CA3AF',
            fontStyle: subject?.trim() ? 'normal' : 'italic',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {subject?.trim() || 'Sin asunto'}
        </span>
      </div>

      {/* Email scroll area */}
      <div
        style={{
          background: '#F1F3F4',
          padding: '16px',
          maxHeight: '460px',
          overflowY: 'auto',
        }}
      >
        {/* Email card */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {/* Email header */}
          <div
            style={{
              background: businessColor,
              padding: '24px 28px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.02em', margin: 0 }}>
              {displayName}
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '4px', marginBottom: 0 }}>
              Boletin informativo
            </p>
          </div>

          {/* Email body */}
          <div style={{ padding: '28px' }}>
            {hasContent ? (
              <>
                {headline?.trim() && (
                  <p
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: '#111827',
                      letterSpacing: '-0.03em',
                      marginTop: 0,
                      marginBottom: '16px',
                      lineHeight: 1.2,
                    }}
                  >
                    {headline}
                  </p>
                )}
                {body?.trim() && (
                  <div
                    style={{
                      fontSize: '14px',
                      color: '#374151',
                      lineHeight: 1.7,
                      marginBottom: '20px',
                    }}
                    dangerouslySetInnerHTML={{ __html: body }}
                  />
                )}
              </>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <Skeleton w="75%" h="20px" />
                <Skeleton w="100%" h="12px" />
                <Skeleton w="100%" h="12px" />
                <Skeleton w="60%" h="12px" />
              </div>
            )}

            {ctaText?.trim() && (
              <div style={{ textAlign: 'center', margin: '8px 0 24px' }}>
                <span
                  style={{
                    background: businessColor,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 28px',
                    fontSize: '14px',
                    fontWeight: 600,
                    display: 'inline-block',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {ctaText}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid #F3F4F6',
              padding: '16px 28px',
              textAlign: 'center',
            }}
          >
            {footerText?.trim() && (
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 6px' }}>
                {footerText}
              </p>
            )}
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '0 0 6px' }}>
              <span style={{ textDecoration: 'underline' }}>Darse de baja</span>
            </p>
            <p style={{ fontSize: '11px', color: '#D1D5DB', margin: 0 }}>
              Enviado por {displayName} via Publify
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
