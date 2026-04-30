import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { checkCanConnectSocial } from '@/lib/plans'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { DisconnectButton } from './DisconnectButton'
import { ConnectButton } from './ConnectButton'
import { InstagramAnalysisSection } from './InstagramAnalysisSection'
import { PlatformIcon } from './PlatformIcon'
import type { SocialPlatform } from '@/types'
import type { DisplayPlatform } from './PlatformIcon'

// ── Platform display config ───────────────────────────────────────
const SOCIAL_PLATFORM_KEYS: SocialPlatform[] = [
  'instagram',
  'facebook',
  'tiktok',
  'google',
]

type ConnectablePlatformEntry = {
  key: SocialPlatform
  label: string
  description: string
  connectHref: string
  comingSoon?: false
}

type ComingSoonPlatformEntry = {
  key: DisplayPlatform
  label: string
  description: string
  comingSoon: true
}

type PlatformEntry = ConnectablePlatformEntry | ComingSoonPlatformEntry

const PLATFORMS: PlatformEntry[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'Publica posts, historias y reels directamente.',
    connectHref: '/api/auth/meta/connect',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    description: 'Publica en tu pagina y llega a tu audiencia.',
    connectHref: '/api/auth/meta/connect',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    description: 'Publica videos cortos y llega a nuevos clientes.',
    connectHref: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/connect`,
  },
  {
    key: 'google',
    label: 'Google Business',
    description: 'Comparte novedades en tu ficha de Google Maps.',
    connectHref: '/api/auth/google/connect',
  },
]

// ── Error / success message map ───────────────────────────────────
const SUCCESS_MESSAGES: Record<string, string> = {
  meta: 'Instagram y Facebook conectados correctamente',
  facebook: 'Facebook conectado correctamente',
  tiktok: 'TikTok conectado correctamente',
  google: 'Google Business conectado correctamente',
}

const ERROR_MESSAGES: Record<string, string> = {
  meta_not_configured:
    'La app no esta configurada para conectar con Meta. Contacta al administrador para activar la integracion.',
  meta_denied: 'Conexion cancelada',
  meta_token: 'Error al obtener el token. Intentalo de nuevo.',
  no_instagram_business:
    'La pagina de Facebook no tiene una cuenta de Instagram Business asociada. Asegurate de tener un perfil de Instagram Business vinculado a tu pagina.',
  meta_unknown: 'Error inesperado al conectar con Meta. Intentalo de nuevo.',
  tiktok_denied: 'Conexion con TikTok cancelada',
  tiktok_expired: 'La sesion ha expirado. Intentalo de nuevo.',
  google_denied: 'Conexion con Google cancelada',
}

const WARNING_MESSAGES: Record<string, string> = {
  google_unverified:
    'Tu ficha de Google Business no esta verificada. Google requiere verificacion para publicar novedades. Verifica tu negocio en business.google.com y vuelve a intentarlo.',
  instagram_personal:
    'Tu cuenta de Instagram es personal. Para publicar automaticamente necesitas convertirla a cuenta Profesional (Business o Creator) desde la app de Instagram: Configuracion → Tipo de cuenta y herramientas → Cambiar a cuenta profesional. Una vez convertida, vuelve a conectar.',
}

interface ConnectionsPageProps {
  searchParams: Promise<{ success?: string; error?: string; warning?: string }>
}

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const { success, error, warning } = await searchParams

  console.log('[connections/page] searchParams — success:', success, '| error:', error, '| warning:', warning)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const [{ data: connections, error: connError }, { allowed: canConnect }] = await Promise.all([
    supabase
      .from('social_connections')
      .select('*')
      .eq('business_id', business.id),
    checkCanConnectSocial(business.id),
  ])

  if (connError) {
    console.error('[connections/page] query error:', connError)
  }
  console.log('[connections/page] raw rows:', JSON.stringify(connections))

  const connectedMap = new Map(
    (connections ?? []).map((c) => [c.platform as SocialPlatform, c])
  )

  const successMessage = success ? SUCCESS_MESSAGES[success] : null
  const errorMessage = error ? ERROR_MESSAGES[error] : null
  const warningMessage = warning && warning !== 'facebook_no_pages'
    ? (WARNING_MESSAGES[warning] ?? null)
    : null
  const facebookNoPages = warning === 'facebook_no_pages'

  const connectedCount = Array.from(connectedMap.values()).filter((c) => c.is_active).length

  return (
    <div className="flex flex-col gap-5 md:gap-8 p-4 md:p-6 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Redes sociales"
        subtitle="Conecta tus cuentas para publicar directamente desde la app"
      />

      {/* Stats bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border border-brand-border rounded-xl shadow-sm">
        <span className="text-sm text-brand-text-secondary">
          {connectedCount === 0
            ? 'Ninguna cuenta conectada todavia'
            : `${connectedCount} cuenta${connectedCount > 1 ? 's' : ''} conectada${connectedCount > 1 ? 's' : ''}`}
        </span>
        {connectedCount > 0 && (
          <span className="w-2 h-2 rounded-full bg-green-500 ml-1" />
        )}
      </div>

      {/* Feedback banners */}
      {successMessage && (
        <Badge variant="success" className="w-full justify-center py-3 rounded-xl text-sm">
          {successMessage}
        </Badge>
      )}
      {errorMessage && (
        <Badge variant="error" className="w-full justify-center py-3 rounded-xl text-sm">
          {errorMessage}
        </Badge>
      )}
      {warningMessage && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: '#FFFBEB', border: '1px solid #FCD34D', fontSize: 13, color: '#92400E', lineHeight: 1.6 }}>
          {warningMessage}
        </div>
      )}

      {/* Platform grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {PLATFORMS.map((platform) => {
          if (platform.comingSoon) {
            return (
              <ComingSoonCard
                key={platform.key}
                platformKey={platform.key}
                label={platform.label}
                description={platform.description}
              />
            )
          }

          const conn = connectedMap.get(platform.key)
          const isConnected = !!conn && conn.is_active
          const isProfessional = conn && 'is_professional' in conn
            ? (conn as { is_professional: boolean | null }).is_professional
            : null
          const hasVerifiedLocation = conn && 'has_verified_location' in conn
            ? (conn as { has_verified_location: boolean | null }).has_verified_location
            : null
          const isValid = conn && 'is_valid' in conn
            ? (conn as { is_valid: boolean | null }).is_valid
            : null

          return (
            <PlatformCard
              key={platform.key}
              platformKey={platform.key}
              label={platform.label}
              description={platform.description}
              connectHref={platform.connectHref}
              isConnected={isConnected}
              username={conn?.platform_username ?? null}
              canConnect={canConnect}
              businessId={business.id}
              isProfessional={isProfessional}
              noPagesBanner={platform.key === 'facebook' && facebookNoPages}
              hasVerifiedLocation={hasVerifiedLocation}
              isValid={isValid}
            />
          )
        })}
      </div>

      <p className="text-xs text-brand-text-secondary text-center">
        Al conectar una cuenta autorizas a la app a publicar contenido en tu nombre.
        Puedes desconectar en cualquier momento.
      </p>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

interface PlatformCardProps {
  platformKey: SocialPlatform
  label: string
  description: string
  connectHref: string
  isConnected: boolean
  username: string | null
  canConnect: boolean
  businessId: string
  isProfessional?: boolean | null
  noPagesBanner?: boolean | null
  hasVerifiedLocation?: boolean | null
  isValid?: boolean | null
}

function PlatformCard({
  platformKey,
  label,
  description,
  connectHref,
  isConnected,
  username,
  canConnect,
  businessId,
  isProfessional,
  noPagesBanner,
  hasVerifiedLocation,
  isValid,
}: PlatformCardProps) {
  const showPersonalWarning =
    platformKey === 'instagram' && isConnected && isProfessional === false
  const showGoogleUnverified =
    platformKey === 'google' && isConnected && hasVerifiedLocation === false
  const showExpiredBanner = isConnected && isValid === false

  return (
    <div
      className={[
        'flex flex-col gap-3 p-4 bg-white rounded-xl shadow-sm border transition-colors',
        showExpiredBanner
          ? 'border-red-300 ring-1 ring-red-100'
          : noPagesBanner || showGoogleUnverified
          ? 'border-yellow-300 ring-1 ring-yellow-100'
          : isConnected
            ? showPersonalWarning
              ? 'border-yellow-300 ring-1 ring-yellow-100'
              : 'border-green-200 ring-1 ring-green-100'
            : 'border-brand-border',
      ].join(' ')}
    >
      {/* Top row: icon + info + badge */}
      <div className="flex items-center gap-3">
        <PlatformIcon platform={platformKey} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text-primary">{label}</p>
          <p className="text-xs text-brand-text-secondary leading-snug">{description}</p>
        </div>
        {isConnected ? (
          <Badge variant={showExpiredBanner ? 'error' : showPersonalWarning || showGoogleUnverified ? 'warning' : 'success'} className="shrink-0">
            {showExpiredBanner ? 'Caducada' : showPersonalWarning ? 'Personal' : showGoogleUnverified ? 'No verificada' : 'Conectada'}
          </Badge>
        ) : (
          <Badge variant="neutral" className="shrink-0">No conectada</Badge>
        )}
      </div>

      {/* Bottom row: action */}
      <div className="border-t border-brand-border pt-3">
        {isConnected ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-brand-text-secondary truncate">
              @{username}
            </span>
            <DisconnectButton platform={platformKey} />
          </div>
        ) : (
          <ConnectButton connectHref={connectHref} canConnect={canConnect} />
        )}
      </div>

      {/* Facebook no pages warning */}
      {noPagesBanner && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          fontSize: 13,
          color: '#92400E',
          lineHeight: 1.6,
        }}>
          No tienes ninguna pagina de Facebook. La API de Facebook solo permite publicar en Paginas, no en perfiles personales. Crea una Pagina en facebook.com/pages/create y vuelve a conectar.
        </div>
      )}

      {/* Personal account warning */}
      {showPersonalWarning && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          fontSize: 13,
          color: '#92400E',
          lineHeight: 1.6,
        }}>
          Tu cuenta de Instagram es personal. Para publicar automaticamente necesitas convertirla a cuenta Profesional (Business o Creator) desde la app de Instagram: Configuracion → Tipo de cuenta y herramientas → Cambiar a cuenta profesional. Una vez convertida, vuelve a conectar.
        </div>
      )}

      {/* Expired token reconnect banner */}
      {showExpiredBanner && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FCA5A5',
          fontSize: 13, color: '#991B1B', marginTop: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <span>La conexion ha caducado. Vuelve a conectar tu cuenta.</span>
          <a
            href={connectHref}
            style={{
              padding: '6px 12px', borderRadius: 6,
              background: '#DC2626', border: 'none',
              color: 'white', fontSize: 12, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            Reconectar
          </a>
        </div>
      )}

      {/* Google Business unverified warning */}
      {showGoogleUnverified && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          background: '#FFFBEB',
          border: '1px solid #FCD34D',
          fontSize: 13,
          color: '#92400E',
          lineHeight: 1.6,
        }}>
          Tu ficha de Google Business no esta verificada. Google requiere verificacion para publicar novedades. Verifica tu negocio en business.google.com y vuelve a intentarlo.
        </div>
      )}

      {/* Instagram analysis (only when connected and professional) */}
      {isConnected && platformKey === 'instagram' && isProfessional !== false && (
        <InstagramAnalysisSection businessId={businessId} />
      )}
    </div>
  )
}

interface ComingSoonCardProps {
  platformKey: DisplayPlatform
  label: string
  description: string
}

function ComingSoonCard({ platformKey, label, description }: ComingSoonCardProps) {
  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl shadow-sm border border-brand-border opacity-70">
      <div className="flex items-center gap-3">
        <PlatformIcon platform={platformKey} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-brand-text-primary">{label}</p>
          <p className="text-xs text-brand-text-secondary leading-snug">{description}</p>
        </div>
        <Badge variant="info" className="shrink-0">Proximamente</Badge>
      </div>
      <div className="border-t border-brand-border pt-3">
        <button
          disabled
          className="w-full text-sm font-medium py-1.5 px-4 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed"
        >
          Conectar
        </button>
      </div>
    </div>
  )
}
