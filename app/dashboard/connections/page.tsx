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
  'whatsapp',
]

type ConnectablePlatformEntry = {
  key: SocialPlatform
  label: string
  description: string
  connectHref: string
  comingSoon?: false
}

type ComingSoonPlatformEntry = {
  key: Exclude<DisplayPlatform, SocialPlatform>
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
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Atencion al cliente y promociones directas.',
    connectHref: '/api/auth/meta/connect',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    description: 'Publica videos y crece con tu audiencia.',
    comingSoon: true,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    description: 'Construye tu marca profesional y B2B.',
    comingSoon: true,
  },
  {
    key: 'twitter',
    label: 'X (Twitter)',
    description: 'Comparte novedades en tiempo real.',
    comingSoon: true,
  },
]

// ── Error / success message map ───────────────────────────────────
const SUCCESS_MESSAGES: Record<string, string> = {
  meta: 'Instagram y Facebook conectados correctamente',
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

interface ConnectionsPageProps {
  searchParams: Promise<{ success?: string; error?: string }>
}

export default async function ConnectionsPage({ searchParams }: ConnectionsPageProps) {
  const { success, error } = await searchParams

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

  const [{ data: connections }, { allowed: canConnect }] = await Promise.all([
    supabase
      .from('social_connections')
      .select('platform, platform_username, is_active')
      .eq('business_id', business.id),
    checkCanConnectSocial(business.id),
  ])

  const connectedMap = new Map(
    (connections ?? []).map((c) => [c.platform as SocialPlatform, c])
  )

  const successMessage = success ? SUCCESS_MESSAGES[success] : null
  const errorMessage = error ? ERROR_MESSAGES[error] : null

  const connectedCount = Array.from(connectedMap.values()).filter((c) => c.is_active).length

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto w-full">
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
}: PlatformCardProps) {
  return (
    <div
      className={[
        'flex flex-col gap-3 p-4 bg-white rounded-xl shadow-sm border transition-colors',
        isConnected
          ? 'border-green-200 ring-1 ring-green-100'
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
          <Badge variant="success" className="shrink-0">Conectada</Badge>
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

      {/* Instagram analysis (only when connected) */}
      {isConnected && platformKey === 'instagram' && (
        <InstagramAnalysisSection businessId={businessId} />
      )}
    </div>
  )
}

interface ComingSoonCardProps {
  platformKey: Exclude<DisplayPlatform, SocialPlatform>
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
