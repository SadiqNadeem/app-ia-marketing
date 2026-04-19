import type { PlatformPreviewProps } from '../preview-types'
import { PreviewAvatar } from './PreviewAvatar'

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

export function InstagramPreview({
  data,
  contentType,
  businessName,
  logoUrl,
  primaryColor,
}: PlatformPreviewProps) {
  const rgb = hexToRgb(primaryColor)
  const colorBase = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '26, 86, 219'
  const imageBackground = `linear-gradient(160deg, rgba(${colorBase}, 0.18) 0%, rgba(${colorBase}, 0.07) 100%)`

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        borderRadius: 10,
        border: '1px solid #EAECF0',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderBottom: '1px solid #EAECF0',
        }}
      >
        <PreviewAvatar
          businessName={businessName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
        />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
            {businessName}
          </p>
          <p style={{ fontSize: 11, color: '#9EA3AE' }}>Ahora</p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="5" cy="12" r="1.5" fill="#9EA3AE" />
          <circle cx="12" cy="12" r="1.5" fill="#9EA3AE" />
          <circle cx="19" cy="12" r="1.5" fill="#9EA3AE" />
        </svg>
      </div>

      <div
        style={{
          aspectRatio: '1 / 1',
          maxHeight: 400,
          width: '100%',
          background: imageBackground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: data.imageUrl ? 0 : '24px 20px',
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 30px,
                  rgba(${colorBase}, 0.04) 30px,
                  rgba(${colorBase}, 0.04) 31px
                )`,
              }}
            />
            <p
              style={{
                position: 'relative',
                fontSize: contentType === 'hashtags' ? 12 : 15,
                fontWeight: contentType === 'promotion' ? 600 : 500,
                color: '#111827',
                textAlign: 'center',
                lineHeight: 1.55,
                letterSpacing: '-0.1px',
              }}
            >
              {contentType === 'hashtags' ? data.hashtags.join(' ') : data.text}
            </p>
          </>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 12px 8px',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
        <div style={{ flex: 1 }} />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      {contentType !== 'hashtags' && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ fontSize: 12, color: '#111827', lineHeight: 1.55 }}>
            <span style={{ fontWeight: 600 }}>{businessName} </span>
            {data.text}
          </p>
          {data.hashtags.length > 0 && (
            <p
              style={{
                fontSize: 12,
                color: '#1A56DB',
                marginTop: 4,
                lineHeight: 1.55,
              }}
            >
              {data.hashtags.join(' ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

