import type { PlatformPreviewProps } from '../preview-types'
import { PreviewAvatar } from './PreviewAvatar'

export function WhatsAppPreview({
  data,
  contentType,
  businessName,
  logoUrl,
  primaryColor,
}: PlatformPreviewProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 540,
        borderRadius: 14,
        border: '1px solid #D1FAE5',
        overflow: 'hidden',
        backgroundColor: '#E8F5E9',
      }}
    >
      <div
        style={{
          backgroundColor: '#128C7E',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#FFFFFF',
        }}
      >
        <PreviewAvatar
          businessName={businessName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
        />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{businessName}</p>
          <p style={{ fontSize: 11, opacity: 0.9 }}>en linea</p>
        </div>
      </div>

      <div
        style={{
          padding: '16px 12px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          backgroundImage: 'radial-gradient(rgba(18, 140, 126, 0.08) 1px, transparent 1px)',
          backgroundSize: '14px 14px',
        }}
      >
        <div
          style={{
            alignSelf: 'flex-start',
            maxWidth: '90%',
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
            padding: '10px 12px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.07)',
            borderLeft: `3px solid ${primaryColor}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: '#0F172A', lineHeight: 1.5 }}>
            {contentType === 'hashtags' ? data.hashtags.join(' ') : data.text}
          </p>
          {contentType !== 'hashtags' && data.hashtags.length > 0 && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#2563EB', lineHeight: 1.45 }}>
              {data.hashtags.join(' ')}
            </p>
          )}
          <p style={{ margin: '6px 0 0', fontSize: 10, color: '#64748B', textAlign: 'right' }}>
            22:17
          </p>
        </div>

        <button
          style={{
            alignSelf: 'stretch',
            border: 'none',
            borderRadius: 999,
            padding: '10px 14px',
            backgroundColor: '#25D366',
            color: '#073B2E',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Reservar por WhatsApp
        </button>
      </div>
    </div>
  )
}
