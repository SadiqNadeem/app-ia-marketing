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

export function FacebookPreview({
  data,
  contentType,
  businessName,
  logoUrl,
  primaryColor,
}: PlatformPreviewProps) {
  const rgb = hexToRgb(primaryColor)
  const colorBase = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '26, 86, 219'

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 740,
        borderRadius: 10,
        border: '1px solid #DCE1E8',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #EEF2F7' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PreviewAvatar
            businessName={businessName}
            logoUrl={logoUrl}
            primaryColor={primaryColor}
          />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>
              {businessName}
            </p>
            <p style={{ fontSize: 11, color: '#64748B' }}>Publico - Patrocinado</p>
          </div>
        </div>
        {contentType !== 'hashtags' && (
          <p style={{ marginTop: 10, fontSize: 13, color: '#0F172A', lineHeight: 1.5 }}>
            {data.text}
          </p>
        )}
      </div>

      <div
        style={{
          aspectRatio: '4 / 3',
          background: `linear-gradient(180deg, rgba(${colorBase}, 0.2) 0%, rgba(${colorBase}, 0.06) 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          color: '#0F172A',
        }}
      >
        <p
          style={{
            fontSize: contentType === 'hashtags' ? 12 : 19,
            fontWeight: 700,
            lineHeight: 1.35,
          }}
        >
          {contentType === 'hashtags' ? data.hashtags.join(' ') : data.text}
        </p>
      </div>

      <div style={{ padding: '10px 12px', borderTop: '1px solid #EEF2F7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', color: '#64748B', fontSize: 12, fontWeight: 600 }}>
          <span>Me gusta</span>
          <span>Comentar</span>
          <span>Compartir</span>
        </div>
        {data.hashtags.length > 0 && (
          <p style={{ marginTop: 10, fontSize: 12, color: '#2563EB', lineHeight: 1.5 }}>
            {data.hashtags.join(' ')}
          </p>
        )}
      </div>
    </div>
  )
}
