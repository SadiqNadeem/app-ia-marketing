import type { PlatformPreviewProps } from '../preview-types'

export function FlyerPreview({
  data,
  contentType,
  businessName,
  primaryColor,
}: PlatformPreviewProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 760,
        borderRadius: 14,
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        boxShadow: '0 14px 26px rgba(15, 23, 42, 0.12)',
        backgroundColor: '#FFFFFF',
      }}
    >
      <div
        style={{
          background: `linear-gradient(160deg, ${primaryColor} 0%, #0F172A 80%)`,
          padding: '18px 20px 16px',
          color: '#FFFFFF',
        }}
      >
        <p style={{ margin: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Oferta Especial
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, lineHeight: 1.15 }}>
          {businessName}
        </p>
      </div>

      <div style={{ padding: '18px 20px 20px' }}>
        <p
          style={{
            margin: 0,
            fontSize: contentType === 'hashtags' ? 13 : 20,
            fontWeight: 800,
            color: '#111827',
            lineHeight: 1.25,
            textAlign: 'center',
          }}
        >
          {contentType === 'hashtags' ? data.hashtags.join(' ') : data.text}
        </p>

        {contentType !== 'hashtags' && (
          <div
            style={{
              marginTop: 14,
              borderRadius: 10,
              padding: '10px 12px',
              backgroundColor: '#FEF3C7',
              color: '#92400E',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Valido solo hoy
          </div>
        )}

        {data.hashtags.length > 0 && (
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 12,
              color: '#2563EB',
              lineHeight: 1.45,
              textAlign: 'center',
            }}
          >
            {data.hashtags.join(' ')}
          </p>
        )}
      </div>
    </div>
  )
}
