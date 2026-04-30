import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{ business?: string; email?: string; token?: string }>
}

function verifyToken(businessId: string, email: string, token: string): boolean {
  const salt = process.env.RESEND_WEBHOOK_SECRET ?? 'unsubscribe-salt'
  const expected = crypto
    .createHmac('sha256', salt)
    .update(`${businessId}:${email}`)
    .digest('hex')
  return expected === token
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const params = await searchParams
  const { business: businessId, email, token } = params

  const admin = createAdminClient()

  // Validate required params
  if (!businessId || !email || !token) {
    return (
      <PageLayout>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
          Enlace no valido
        </h1>
        <p style={{ color: '#374151', margin: 0 }}>
          El enlace de baja no es correcto o ha caducado.
        </p>
      </PageLayout>
    )
  }

  // Verify token
  if (!verifyToken(businessId, decodeURIComponent(email), token)) {
    return (
      <PageLayout>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>
          Enlace no valido
        </h1>
        <p style={{ color: '#374151', margin: 0 }}>
          No se pudo verificar tu solicitud de baja.
        </p>
      </PageLayout>
    )
  }

  const decodedEmail = decodeURIComponent(email)

  // Fetch business name and landing info
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, slug, landing_enabled')
    .eq('id', businessId)
    .single()

  const businessName = business?.name ?? 'este negocio'

  // Insert unsubscribe record (ignore if already exists)
  await admin
    .from('email_unsubscribes')
    .upsert(
      { business_id: businessId, email: decodedEmail },
      { onConflict: 'business_id,email', ignoreDuplicates: true }
    )

  const landingLink =
    business?.landing_enabled && business?.slug
      ? `/negocio/${business.slug}`
      : null

  return (
    <PageLayout>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: '#D1FAE5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: '0 0 12px', textAlign: 'center' }}>
        Te has dado de baja correctamente
      </h1>
      <p style={{ color: '#374151', margin: '0 0 28px', textAlign: 'center', lineHeight: 1.6 }}>
        Ya no recibiras emails de {businessName}.
      </p>

      {landingLink && (
        <div style={{ textAlign: 'center' }}>
          <Link
            href={landingLink as never}
            style={{
              display: 'inline-block',
              background: '#F3F4F6',
              color: '#374151',
              textDecoration: 'none',
              padding: '10px 24px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Volver a la pagina del negocio
          </Link>
        </div>
      )}
    </PageLayout>
  )
}

function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F8FA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #E5E7EB',
        padding: '40px 32px',
        maxWidth: 480,
        width: '100%',
      }}>
        {children}
      </div>
    </div>
  )
}

