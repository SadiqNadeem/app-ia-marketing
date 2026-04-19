import { createClient } from '@/lib/supabase/server'
import { CouponQR } from '@/components/CouponQR'

interface PageProps {
  params: Promise<{ code: string }>
}

function formatDiscount(type: string, value: number): string {
  if (type === 'percentage') return `${value}% de descuento`
  return `${value} euros de descuento`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function PublicCouponPage({ params }: PageProps) {
  const { code } = await params
  const supabase = await createClient()

  // Fetch coupon (public RLS policy allows active coupons)
  const { data: coupon } = await supabase
    .from('coupons')
    .select('*, businesses(name, logo_url, primary_color)')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  // Not found
  if (!coupon) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F7F8FA',
        }}
      >
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>Cupon no encontrado</p>
          <p style={{ fontSize: 14, color: '#374151', marginTop: 8 }}>
            Verifica que el enlace o codigo es correcto.
          </p>
        </div>
      </div>
    )
  }

  const business = coupon.businesses as {
    name: string
    logo_url: string | null
    primary_color: string
  } | null

  const primaryColor = business?.primary_color ?? '#2563EB'
  const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
  const isUnavailable = !coupon.is_active || isExpired

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const couponUrl = `${appUrl}/coupon/${coupon.code}`

  const usesRemaining =
    coupon.max_uses !== null ? coupon.max_uses - coupon.used_count : null

  return (
    <div
      style={{
        minHeight: '100vh',
        background: primaryColor,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px 48px',
      }}
    >
      {/* Business header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {business?.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={business.logo_url}
            alt={business.name}
            style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', background: '#fff' }}
          />
        ) : (
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {business?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
        )}
        {business?.name && (
          <p style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: 0 }}>
            {business.name}
          </p>
        )}
      </div>

      {/* Main card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: '32px 28px',
          width: '100%',
          maxWidth: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {isUnavailable ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>
              Este cupon ya no esta disponible
            </p>
            <p style={{ fontSize: 14, color: '#374151', marginTop: 8 }}>
              {isExpired ? 'El cupon ha expirado.' : 'El cupon ha sido desactivado.'}
            </p>
          </div>
        ) : (
          <>
            {/* Title */}
            <p
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#111827',
                textAlign: 'center',
                margin: 0,
              }}
            >
              {coupon.title}
            </p>

            {/* Discount value */}
            <p
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: primaryColor,
                textAlign: 'center',
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {formatDiscount(coupon.discount_type, coupon.discount_value)}
            </p>

            {/* Description */}
            {coupon.description && (
              <p
                style={{
                  fontSize: 14,
                  color: '#374151',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                {coupon.description}
              </p>
            )}

            {/* Divider */}
            <div style={{ width: '100%', height: 1, background: '#E5E7EB' }} />

            {/* QR code */}
            <CouponQR url={couponUrl} size={250} />

            {/* Code */}
            <div
              style={{
                background: '#F7F8FA',
                borderRadius: 12,
                padding: '12px 24px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontSize: 24,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: '#111827',
                  margin: 0,
                }}
              >
                {coupon.code}
              </p>
            </div>

            {/* Meta info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'center' }}>
              {coupon.expires_at && (
                <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
                  Valido hasta {formatDate(coupon.expires_at)}
                </p>
              )}
              {usesRemaining !== null && (
                <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>
                  Usos restantes: {usesRemaining}
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer instruction */}
      {!isUnavailable && (
        <p
          style={{
            marginTop: 24,
            fontSize: 14,
            color: 'rgba(255,255,255,0.85)',
            textAlign: 'center',
            maxWidth: 320,
          }}
        >
          Muestra esta pantalla en el local para canjear tu descuento
        </p>
      )}
    </div>
  )
}

