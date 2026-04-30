import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Send, Share2, Users, Library, Sparkles, Plus } from 'lucide-react'
import { ConnectSocialsModal } from '@/components/dashboard/ConnectSocialsModal'
import type { Post } from '@/types'

// ── Helpers ─────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getGreeting(hour: number): string {
  if (hour < 12) return 'Buenos dias'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function getAISuggestion(day: number): string {
  if (day === 1) return 'Empieza la semana con fuerza. Publica el menu del dia o una novedad.'
  if (day >= 2 && day <= 4) return 'Buen momento para publicar contenido educativo o de valor.'
  if (day === 5) return 'Es viernes — ideal para una promocion de fin de semana.'
  if (day === 6) return 'Sabado de alta actividad. Publica algo especial para hoy.'
  return 'Domingo tranquilo. Prepara contenido para la semana.'
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `hace ${days}d`
}

// ── Stat card ────────────────────────────────────────────────────────
function StatCard({
  label, value, delta, icon, deltaLabel,
}: {
  label: string
  value: number | string
  delta?: number
  icon: ReactNode
  deltaLabel?: string
}) {
  const isEmpty = value === 0 || value === '0'
  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: 12,
        padding: '16px 16px',
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>{label}</p>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <p
        style={{
          fontSize: 24,
          fontWeight: 800,
          color: isEmpty ? '#D1D5DB' : '#111827',
          margin: '10px 0 0',
          letterSpacing: '-0.03em',
          lineHeight: 1,
        }}
      >
        {isEmpty ? '—' : value}
      </p>
      {delta !== undefined && delta !== 0 && !isEmpty ? (
        <p style={{ fontSize: 11, color: delta > 0 ? '#16A34A' : '#DC2626', marginTop: 4, fontWeight: 600 }}>
          {delta > 0 ? `+${delta}` : `${delta}`} vs. mes ant.
        </p>
      ) : deltaLabel ? (
        <p style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{deltaLabel}</p>
      ) : null}
    </div>
  )
}

// ── Platform icon ────────────────────────────────────────────────────
const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#010101',
  google: '#4285F4',
  whatsapp: '#25D366',
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  tiktok: 'TK',
  google: 'GO',
  whatsapp: 'WA',
}

function PlatformIcon({ platform }: { platform: string }) {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        background: '#F9FAFB',
        border: '1px solid #F3F4F6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: PLATFORM_COLORS[platform] ?? '#6B7280',
        }}
      >
        {PLATFORM_LABELS[platform] ?? platform.slice(0, 2).toUpperCase()}
      </span>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  published: { bg: '#DCFCE7', color: '#15803D', label: 'Publicado' },
  scheduled: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Programado' },
  draft:     { bg: '#F3F4F6', color: '#4B5563', label: 'Borrador' },
  failed:    { bg: '#FEE2E2', color: '#DC2626', label: 'Fallido' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: 100,
        padding: '3px 9px',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    { count: postsThisMonth },
    { count: postsLastMonth },
    { data: networksData },
    { count: customersCount },
    { count: savedCount },
    { data: recentPosts },
  ] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).gte('created_at', monthStart),
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .gte('created_at', lastMonthStart).lt('created_at', monthStart),
    supabase.from('social_connections').select('platform, platform_username')
      .eq('business_id', business.id).eq('is_active', true),
    supabase.from('customers').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id),
    supabase.from('posts').select('*', { count: 'exact', head: true })
      .eq('business_id', business.id).eq('status', 'draft'),
    supabase.from('posts').select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(6),
  ])

  const activeConnections = (networksData ?? []).length
  const posts = (recentPosts ?? []) as Post[]
  const postsDelta = (postsThisMonth ?? 0) - (postsLastMonth ?? 0)

  const hour = now.getHours()
  const greeting = getGreeting(hour)
  const aiMessage = getAISuggestion(now.getDay())

  const dateStr = capitalize(
    now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  )

  return (
    <div className="dashboard-page-padding" style={{ minHeight: '100%' }}>
      <ConnectSocialsModal show={activeConnections === 0} />

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="dashboard-page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1
            className="dashboard-greeting"
            style={{
              fontWeight: 800,
              color: '#111827',
              letterSpacing: '-0.03em',
              margin: 0,
            }}
          >
            {greeting}, {business.name}
          </h1>
          <p className="hidden md:block" style={{ fontSize: 14, color: '#6B7280', marginTop: 4, margin: '4px 0 0' }}>
            {dateStr}
          </p>
        </div>
        <Link
          href="/dashboard/create"
          className="dashboard-hero-btn dashboard-create-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            background: '#2563EB',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '9px 18px',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Crear contenido
        </Link>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────── */}
      <div
        className="stat-cards-grid"
        style={{ gap: 12, marginBottom: 20 }}
      >
        <StatCard
          label="Posts este mes"
          value={postsThisMonth ?? 0}
          delta={postsDelta}
          icon={<Send size={13} color="#2563EB" />}
        />
        <StatCard
          label="Redes conectadas"
          value={activeConnections}
          deltaLabel={activeConnections === 0 ? 'Sin conexiones' : 'Canales activos'}
          icon={<Share2 size={13} color="#2563EB" />}
        />
        <StatCard
          label="Clientes"
          value={customersCount ?? 0}
          deltaLabel="Total acumulado"
          icon={<Users size={13} color="#2563EB" />}
        />
        <StatCard
          label="Contenido guardado"
          value={savedCount ?? 0}
          deltaLabel="Borradores"
          icon={<Library size={13} color="#2563EB" />}
        />
      </div>

      {/* ── AI suggestion banner ─────────────────────────────────────── */}
      <div
        className="ai-banner"
        style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: '#DBEAFE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={17} color="#2563EB" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#1E40AF',
                margin: '0 0 2px',
              }}
            >
              Sugerencia de la IA
            </p>
            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
              {aiMessage}{' '}
              <Link
                href="/dashboard/create"
                style={{
                  color: '#2563EB',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Generar post →
              </Link>
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/create"
          className="dashboard-hero-btn ai-banner-btn"
          style={{
            display: 'block',
            background: '#2563EB',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          Usar idea
        </Link>
      </div>

      {/* ── Recent posts ────────────────────────────────────────────── */}
      <div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.01em',
            margin: '0 0 12px',
          }}
        >
          Publicaciones recientes
        </p>

        {posts.length === 0 ? (
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              padding: '36px 24px',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 16px' }}>
              Aun no has creado ninguna publicacion
            </p>
            <Link
              href="/dashboard/create"
              className="dashboard-hero-btn"
              style={{
                display: 'inline-block',
                background: '#2563EB',
                color: '#FFFFFF',
                borderRadius: 8,
                padding: '9px 20px',
                fontWeight: 600,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              Crear primera publicacion
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map((post) => {
              const platform = post.platforms?.[0] ?? 'instagram'
              const title = post.title || post.content_text?.split('\n')[0] || 'Sin titulo'
              const preview = post.content_text ?? ''

              return (
                <div
                  key={post.id}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}
                >
                  <PlatformIcon platform={platform} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#111827',
                        margin: '0 0 2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {title}
                    </p>
                    <p
                      className="hidden md:block"
                      style={{
                        fontSize: 13,
                        color: '#6B7280',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {preview}
                    </p>
                  </div>

                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 4,
                    }}
                  >
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                      {relativeTime(post.created_at)}
                    </p>
                    <StatusBadge status={post.status} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
