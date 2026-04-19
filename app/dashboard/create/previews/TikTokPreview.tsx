import type { PlatformPreviewProps } from '../preview-types'
import { PreviewAvatar } from './PreviewAvatar'

export function TikTokPreview({
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
        maxWidth: 520,
        borderRadius: 16,
        border: '1px solid #1F2937',
        backgroundColor: '#0B0B0C',
        color: '#FFFFFF',
        overflow: 'hidden',
        boxShadow: '0 16px 30px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div
        style={{
          position: 'relative',
          aspectRatio: '9 / 16',
          background: `linear-gradient(145deg, ${primaryColor}40 0%, #111827 45%, #0B0B0C 100%)`,
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PreviewAvatar
            businessName={businessName}
            logoUrl={logoUrl}
            primaryColor={primaryColor}
            size={30}
          />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{businessName}</p>
            <p style={{ fontSize: 11, color: '#D1D5DB' }}>Siguiendo</p>
          </div>
        </div>

        <p
          style={{
            margin: 0,
            textAlign: 'left',
            fontSize: contentType === 'hashtags' ? 12 : 22,
            lineHeight: 1.3,
            fontWeight: 700,
            textShadow: '0 2px 16px rgba(0, 0, 0, 0.45)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {contentType === 'hashtags' ? data.hashtags.join(' ') : data.text}
        </p>

        <div
          style={{
            position: 'absolute',
            right: 12,
            bottom: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: 600,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, letterSpacing: '0.04em' }}>LIKE</div>
            <span>3.2k</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, letterSpacing: '0.04em' }}>CHAT</div>
            <span>216</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, letterSpacing: '0.04em' }}>SEND</div>
            <span>84</span>
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 12px 14px' }}>
        <p style={{ fontSize: 12, color: '#E5E7EB', lineHeight: 1.45 }}>
          @{businessName.toLowerCase().replace(/\s+/g, '')}
        </p>
        <p style={{ marginTop: 4, fontSize: 12, color: '#F9FAFB', lineHeight: 1.55 }}>
          {data.text}
        </p>
        {data.hashtags.length > 0 && (
          <p style={{ marginTop: 4, fontSize: 11, color: '#93C5FD' }}>
            {data.hashtags.join(' ')}
          </p>
        )}
      </div>
    </div>
  )
}
