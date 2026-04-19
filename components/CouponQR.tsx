'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

interface CouponQRProps {
  url: string
  size?: number
  downloadName?: string
}

export function CouponQR({ url, size = 200, downloadName }: CouponQRProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('')

  useEffect(() => {
    QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      color: { dark: '#111827', light: '#FFFFFF' },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('[CouponQR] Error generating QR:', err))
  }, [url, size])

  function handleDownload() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${downloadName ?? 'cupon'}-qr.png`
    link.click()
  }

  if (!qrDataUrl) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: '#F7F8FA',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 12, color: '#374151' }}>Generando QR...</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrDataUrl}
        alt="Codigo QR del cupon"
        width={size}
        height={size}
        style={{ borderRadius: 8, border: '1px solid #E5E7EB' }}
      />
      {downloadName !== undefined && (
        <button
          onClick={handleDownload}
          style={{
            fontSize: 12,
            color: '#2563EB',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Descargar QR como PNG
        </button>
      )}
    </div>
  )
}

