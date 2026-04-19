'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Route } from 'next'
import type { Business, PlanType } from '@/types'

// ── SVG Icon components (stroke-only, 14x14, stroke-width 2) ─────────────────

function IconHome() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}
function IconPen() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}
function IconVideo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  )
}
function IconBot() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <line x1="12" y1="7" x2="12" y2="11"/>
      <line x1="8" y1="15" x2="8" y2="15"/>
      <line x1="16" y1="15" x2="16" y2="15"/>
    </svg>
  )
}
function IconTag() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
}
function IconClipboard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1" ry="1"/>
    </svg>
  )
}
function IconMessage() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}
function IconGlobe() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}
function IconMenu() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}
function IconShare() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  )
}
function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )
}
function IconBarChart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}
function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
}
function IconDatabase() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  )
}
function IconTrendingUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

// ── Nav structure ─────────────────────────────────────────────────────────────

type NavIcon = () => JSX.Element

interface NavItem {
  label: string
  href: string
  Icon: NavIcon
  showWhen?: (category: string, plan: PlanType) => boolean
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const MENU_DIGITAL_CATEGORIES = ['restaurante', 'hotel', 'academia']
const CATALOGO_CATEGORIES = ['tienda']

const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Contenido',
    items: [
      { label: 'Inicio', href: '/dashboard', Icon: IconHome },
      { label: 'Crear contenido', href: '/dashboard/create', Icon: IconPen },
      {
        label: 'Generar video',
        href: '/dashboard/video',
        Icon: IconVideo,
        showWhen: (_cat, plan) => plan === 'business' || plan === 'agency',
      },
      { label: 'Calendario', href: '/dashboard/calendar', Icon: IconCalendar },
      { label: 'Asistente IA', href: '/dashboard/chat', Icon: IconBot },
    ],
  },
  {
    group: 'Clientes',
    items: [
      { label: 'Cupones', href: '/dashboard/coupons', Icon: IconTag },
      { label: 'Encuestas', href: '/dashboard/surveys', Icon: IconClipboard },
      { label: 'Campanas WhatsApp', href: '/dashboard/campaigns', Icon: IconMessage },
      { label: 'Email marketing', href: '/dashboard/emails', Icon: IconMail },
    ],
  },
  {
    group: 'Presencia',
    items: [
      // 'Mi pagina web' desactivada temporalmente del sidebar (2026-04-12)
      {
        label: 'Menu digital',
        href: '/dashboard/menu',
        Icon: IconMenu,
        showWhen: (cat) => MENU_DIGITAL_CATEGORIES.includes(cat),
      },
      {
        label: 'Catalogo',
        href: '/dashboard/menu',
        Icon: IconMenu,
        showWhen: (cat) => CATALOGO_CATEGORIES.includes(cat),
      },
      { label: 'Redes sociales', href: '/dashboard/connections', Icon: IconShare },
      { label: 'Resenas Google', href: '/dashboard/reviews', Icon: IconStar },
    ],
  },
  {
    group: 'Datos',
    items: [
      { label: 'Analitica', href: '/dashboard/analytics', Icon: IconBarChart },
      {
        label: 'Competencia',
        href: '/dashboard/competitors',
        Icon: IconSearch,
        showWhen: (_cat, plan) => plan === 'pro' || plan === 'business' || plan === 'agency',
      },
      {
        label: 'Anuncios',
        href: '/dashboard/ads',
        Icon: IconTrendingUp,
        showWhen: (_cat, plan) => plan === 'business' || plan === 'agency',
      },
      { label: 'Negocio IA', href: '/dashboard/knowledge', Icon: IconDatabase },
      { label: 'Ejemplos IA', href: '/dashboard/ai-knowledge', Icon: IconBot },
      { label: 'Configuracion', href: '/dashboard/settings', Icon: IconSettings },
    ],
  },
]

function buildNavGroups(category: string, plan: PlanType): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    group: g.group,
    items: g.items.filter((item) =>
      item.showWhen ? item.showWhen(category, plan) : true
    ),
  })).filter((g) => g.items.length > 0)
}

const PLAN_LABEL: Record<PlanType, string> = {
  basic: 'Basic',
  pro: 'Pro',
  business: 'Business',
  agency: 'Agency',
}

interface SidebarProps {
  business: Business
}

export function Sidebar({ business }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const groups = buildNavGroups(business.category, business.plan)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = business.name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  return (
    <aside
      style={{
        width: 210,
        minWidth: 210,
        background: '#FFFFFF',
        borderRight: '1px solid #EAECF0',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '18px 18px 18px',
          borderBottom: '1px solid #EAECF0',
          marginBottom: 10,
        }}
      >
        <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
          Publify
        </p>
        <p style={{ fontSize: 11, color: '#9EA3AE', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {business.name}
        </p>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {groups.map((group) => (
          <div key={group.group}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#B0B7C3',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                padding: '10px 18px 4px',
              }}
            >
              {group.group}
            </p>
            {group.items.map(({ label, href, Icon }) => {
              const isActive =
                href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(href)

              return (
                <Link
                  key={href + label}
                  href={href as Route}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: '9px 18px',
                    fontSize: 13,
                    color: isActive ? '#1A56DB' : '#5A6070',
                    fontWeight: isActive ? 600 : 400,
                    borderLeft: `2px solid ${isActive ? '#1A56DB' : 'transparent'}`,
                    background: isActive ? '#EEF3FE' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 120ms ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.color = '#111827'
                      ;(e.currentTarget as HTMLAnchorElement).style.background = '#F4F5F7'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.color = '#5A6070'
                      ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                    }
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.5, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Icon />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer — business chip */}
      <div
        style={{
          marginTop: 'auto',
          padding: '14px 18px',
          borderTop: '1px solid #EAECF0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: '#1A56DB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {business.name}
          </p>
          <p style={{ fontSize: 11, color: '#9EA3AE' }}>
            {PLAN_LABEL[business.plan]}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          title="Cerrar sesion"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: '#9EA3AE',
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}

