'use client'

import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface RedeemResult {
  success: boolean
  message?: string
  error?: string
  coupon?: {
    title: string
    discount_type: string
    discount_value: number
    code: string
  }
}

interface CouponScannerProps {
  businessId: string
}

function formatDiscount(type: string, value: number): string {
  if (type === 'percentage') return `${value}% de descuento`
  return `${value} euros de descuento`
}

export function CouponScanner({ businessId }: CouponScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const scannerInstanceRef = useRef<unknown>(null)
  const [result, setResult] = useState<RedeemResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(false)

  function extractCodeFromUrl(text: string): string {
    try {
      const url = new URL(text)
      const parts = url.pathname.split('/')
      const couponIndex = parts.indexOf('coupon')
      if (couponIndex !== -1 && parts[couponIndex + 1]) {
        return parts[couponIndex + 1].toUpperCase()
      }
    } catch {
      // Not a URL, treat as raw code
    }
    return text.toUpperCase().trim()
  }

  async function handleScan(decodedText: string) {
    if (loading) return
    setLoading(true)

    // Stop scanner while processing
    stopScanner()

    const code = extractCodeFromUrl(decodedText)

    try {
      const res = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ code, business_id: businessId }),
      })
      const json: RedeemResult = await res.json()
      setResult(json)
    } catch {
      setResult({ success: false, error: 'Error de conexion. Intentalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  function stopScanner() {
    const instance = scannerInstanceRef.current as {
      stop?: () => Promise<void>
      clear?: () => void
    } | null
    if (instance) {
      instance.stop?.().catch(() => {})
      instance.clear?.()
      scannerInstanceRef.current = null
    }
    setScanning(false)
  }

  async function startScanner() {
    setResult(null)
    setScanning(true)

    // Dynamic import to avoid SSR issues
    const { Html5QrcodeScanner, Html5QrcodeScanType } = await import('html5-qrcode')

    if (!scannerRef.current) return

    const scanner = new Html5QrcodeScanner(
      'coupon-qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false
    )

    scannerInstanceRef.current = scanner

    scanner.render(
      (decodedText) => {
        handleScan(decodedText)
      },
      () => {
        // Ignore scan errors (frame decode attempts)
      }
    )
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleReset() {
    setResult(null)
    startScanner()
  }

  return (
    <Card padding="md" className="flex flex-col gap-4">
      <p className="text-sm font-medium text-[#111827]">Escanear cupon</p>

      {/* Result overlay */}
      {result && (
        <div
          className={[
            'rounded-xl p-5 flex flex-col gap-3',
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200',
          ].join(' ')}
        >
          {result.success ? (
            <>
              <p className="text-sm font-semibold text-green-800">Cupon canjeado correctamente</p>
              {result.coupon && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-green-700 font-medium">{result.coupon.title}</p>
                  <p className="text-base font-bold text-green-800">
                    {formatDiscount(result.coupon.discount_type, result.coupon.discount_value)}
                  </p>
                  <p className="text-xs text-green-600 font-mono">{result.coupon.code}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm font-semibold text-red-700">{result.error ?? 'Error desconocido'}</p>
          )}
          <Button size="sm" variant="secondary" onClick={handleReset}>
            Escanear otro
          </Button>
        </div>
      )}

      {/* Scanner area */}
      {!result && (
        <>
          {!scanning ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-sm text-[#374151] text-center">
                Pide al cliente que muestre el QR de su cupon y escanéalo con la camara
              </p>
              <Button onClick={startScanner} loading={loading}>
                Iniciar camara
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div
                ref={scannerRef}
                id="coupon-qr-reader"
                style={{ width: '100%', maxWidth: 320 }}
              />
              <p className="text-xs text-[#374151]">Apunta la camara al QR del cliente</p>
              <button
                onClick={stopScanner}
                className="text-xs text-[#374151] hover:text-[#111827] transition-colors"
              >
                Detener camara
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

