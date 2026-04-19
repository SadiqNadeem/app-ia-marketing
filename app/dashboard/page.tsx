import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DashboardMainContent } from '@/components/DashboardMainContent'
import { DashboardAIPanel } from '@/components/DashboardAIPanel'
import { DashboardActivityChart } from '@/components/DashboardActivityChart'
import { DashboardAnalyticsSection } from '@/components/DashboardAnalyticsSection'
import type { Post } from '@/types'

// ── Helpers ─────────────────────────────────────────────────────────
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google',
  whatsapp: 'WhatsApp',
}

// ── KPI item ─────────────────────────────────────────────────────────
function KPIItem({
  value, label, delta,
}: {
  value: number
  label: string
  delta?: number
}) {
  const isEmpty = value === 0
  return (
    <div style={{ minWidth: 80 }}>
      <p style={{
        fontSize: 9, fontWeight: 500, color: '#4B5563',
        textTransform: 'uppercase', letterSpacing: '0.09em',
        margin: '0 0 5px',
      }}>
        {label}
      </p>
      <p style={{
        fontSize: 28, fontWeight: 600,
        color: isEmpty ? '#D1D5DB' : '#111827',
        margin: 0, letterSpacing: '-1.5px', lineHeight: 1,
      }}>
        {isEmpty ? '—' : value}
      </p>
      {delta !== undefined && delta !== 0 && !isEmpty && (
        <span style={{
          display: 'inline-block', marginTop: 4,
          fontSize: 10, fontWeight: 700,
          color: delta > 0 ? '#10B981' : '#EF4444',
          background: delta > 0 ? '#D1FAE5' : '#FEE2E2',
          borderRadius: 4, padding: '1px 6px',
        }}>
          {delta > 0 ? `↑ +${delta}` : `↓ ${delta}`}
        </span>
      )}
    </div>
  )
}

// ── Redes activas KPI — lógica de color y subtexto propia ────────────
function NetworksKPIItem({ count, platforms }: { count: number; platforms: string[] }) {
  return (
    <div style={{ minWidth: 80 }}>
      <p style={{
        fontSize: 9, fontWeight: 500, color: '#4B5563',
        textTransform: 'uppercase', letterSpacing: '0.09em',
        margin: '0 0 5px',
      }}>
        Redes activas
      </p>
      <p style={{
        fontSize: 28, fontWeight: 600,
        color: count === 0 ? '#E02424' : '#0E9F6E',
        margin: 0, letterSpacing: '-1.5px', lineHeight: 1,
      }}>
        {count}
      </p>
      {count === 0 ? (
        <a href="/dashboard/connections" style={{
          display: 'inline-block', marginTop: 4,
          fontSize: 11, fontWeight: 600, color: '#1A56DB', textDecoration: 'none',
        }}>
          Conectar →
        </a>
      ) : (
        <p style={{ fontSize: 10, color: '#9E9688', margin: '4px 0 0', lineHeight: 1.3 }}>
          {platforms.map(p => PLATFORM_LABELS[p] ?? p).join(', ')}
        </p>
      )}
    </div>
  )
}

// ── Vertical divider ─────────────────────────────────────────────────
function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: '#E5E7EB', flexShrink: 0 }} />
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
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

  const [
    { count: postsThisMonth },
    { count: postsLastMonth },
    { data: networksData },
    { count: customersCount },
    { count: scheduledCount },
    { data: recentPosts },
    { data: trendData },
    { data: chartRaw },
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
      .eq('business_id', business.id).eq('status', 'scheduled'),
    supabase.from('posts').select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase.from('trends').select('suggestions')
      .eq('business_id', business.id).gte('week_start', weekAgo).limit(1),
    supabase.from('posts').select('created_at, status')
      .eq('business_id', business.id)
      .gte('created_at', twoWeeksAgo)
      .order('created_at', { ascending: true }),
  ])

  const connectedNetworks = (networksData ?? []) as Array<{ platform: string; platform_username: string | null }>
  const activeConnections = connectedNetworks.length

  const posts = (recentPosts ?? []) as Post[]
  const postsDelta = (postsThisMonth ?? 0) - (postsLastMonth ?? 0)

  // ── Build chart data (14 days) ──────────────────────────────────
  const dailyMap: Record<string, { published: number; scheduled: number }> = {}
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = { published: 0, scheduled: 0 }
  }
  for (const p of chartRaw ?? []) {
    const key = new Date(p.created_at).toISOString().slice(0, 10)
    if (key in dailyMap) {
      if (p.status === 'published') dailyMap[key].published++
      else if (p.status === 'scheduled') dailyMap[key].scheduled++
    }
  }
  const chartData = Object.entries(dailyMap).map(([date, c]) => ({
    date,
    published: c.published,
    scheduled: c.scheduled,
    label: new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short',
    }),
  }))

  const trendsList = (trendData?.[0]?.suggestions ?? []) as Array<{
    id: string; title: string; reason: string; platform: string; used?: boolean
  }>

  // ── Date string ─────────────────────────────────────────────────
  const dateStr = capitalize(
    now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  )

  return (
    <div style={{ padding: '24px 28px', minHeight: '100%' }}>

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderRadius: 14,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'stretch',
        gap: 24,
        marginBottom: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}>
        {/* Business identity */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{
            fontSize: 9, fontWeight: 500, color: '#4B5563',
            textTransform: 'uppercase', letterSpacing: '0.09em',
            margin: '0 0 5px',
          }}>
            {dateStr}
          </p>
          <p style={{
            fontSize: 20, fontWeight: 600, color: '#111827',
            margin: 0, letterSpacing: '-0.5px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {business.name}
          </p>
        </div>

        <Divider />

        <KPIItem
          value={postsThisMonth ?? 0}
          label="Posts este mes"
          delta={postsDelta}
        />
        <Divider />
        <KPIItem
          value={customersCount ?? 0}
          label="Clientes"
        />
        <Divider />
        <NetworksKPIItem
          count={activeConnections}
          platforms={connectedNetworks.map(n => n.platform)}
        />
        <Divider />
        <KPIItem
          value={scheduledCount ?? 0}
          label="Programados"
        />

        <Divider />

        {/* CTA */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Link
            href="/dashboard/create"
            className="dashboard-hero-btn"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: '#1A1A1A', color: '#fff',
              borderRadius: 9, padding: '10px 18px',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
              letterSpacing: '-0.1px',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Crear contenido
          </Link>
        </div>
      </div>

      {/* ── Main 2-column grid ────────────────────────────────────── */}
      {/* UX: izquierda = contenido (la "cancha de juego"), derecha = acciones de IA.
           65/35 da protagonismo al contenido sin sacrificar el panel de IA. */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 12,
        marginBottom: 12,
        alignItems: 'start',
      }}>
        {/* Left: calendar + queue */}
        <DashboardMainContent posts={posts} />

        {/* Right: AI panel */}
        <DashboardAIPanel
          businessId={business.id}
          trendsList={trendsList}
          activeConnections={activeConnections ?? 0}
          customersCount={customersCount ?? 0}
          scheduledCount={scheduledCount ?? 0}
        />
      </div>

      {/* ── Activity chart ────────────────────────────────────────── */}
      {/* UX: la gráfica va abajo porque es contexto histórico, no acción inmediata.
           El usuario primero actúa (arriba), luego revisa tendencias (aquí). */}
      <DashboardActivityChart
        chartData={chartData}
        totalThisMonth={postsThisMonth ?? 0}
        delta={postsDelta}
        connectedNetworks={connectedNetworks}
      />

      {/* ── Analytics section ────────────────────────────────────── */}
      <DashboardAnalyticsSection />
    </div>
  )
}

