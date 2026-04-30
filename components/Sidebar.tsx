'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Home, Pen, Video, Calendar, Bot, Tag, Clipboard, MessageSquare,
  Mail, Share2, Star, BarChart2, Search, Settings, Database, TrendingUp,
  LogOut, Menu, FileText, LayoutList, UserCircle,
} from 'lucide-react'
import type { Route } from 'next'
import type { Business, PlanType } from '@/types'

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>

interface NavItem {
  label: string
  href: string
  Icon: LucideIcon
  hidden?: boolean
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
      { label: 'Inicio', href: '/dashboard', Icon: Home },
      { label: 'Crear contenido', href: '/dashboard/create', Icon: Pen },
      { label: 'Publicaciones', href: '/dashboard/posts', Icon: LayoutList },
      { label: 'Borradores', href: '/dashboard/drafts', Icon: FileText },
      {
        label: 'Generar video',
        href: '/dashboard/video',
        Icon: Video,
        showWhen: (_cat, plan) => plan === 'business' || plan === 'agency',
      },
      { label: 'Calendario', href: '/dashboard/calendar', Icon: Calendar },
      { label: 'Asistente IA', href: '/dashboard/chat', Icon: Bot, hidden: true },
    ],
  },
  {
    group: 'Clientes',
    items: [
      { label: 'Cupones', href: '/dashboard/coupons', Icon: Tag },
      { label: 'Encuestas', href: '/dashboard/surveys', Icon: Clipboard },
      { label: 'Campanas WhatsApp', href: '/dashboard/campaigns', Icon: MessageSquare, hidden: true },
      { label: 'Email marketing', href: '/dashboard/emails', Icon: Mail, hidden: true },
    ],
  },
  {
    group: 'Presencia',
    items: [
      {
        label: 'Menu digital',
        href: '/dashboard/menu',
        Icon: Menu,
        hidden: true,
        showWhen: (cat) => MENU_DIGITAL_CATEGORIES.includes(cat),
      },
      {
        label: 'Catalogo',
        href: '/dashboard/menu',
        Icon: Menu,
        hidden: true,
        showWhen: (cat) => CATALOGO_CATEGORIES.includes(cat),
      },
      { label: 'Redes sociales', href: '/dashboard/connections', Icon: Share2 },
      { label: 'Reseñas Google', href: '/dashboard/reviews', Icon: Star },
    ],
  },
  {
    group: 'Datos',
    items: [
      { label: 'Analitica', href: '/dashboard/analytics', Icon: BarChart2 },
      {
        label: 'Competencia',
        href: '/dashboard/competitors',
        Icon: Search,
        showWhen: (_cat, plan) => plan === 'pro' || plan === 'business' || plan === 'agency',
      },
      {
        label: 'Anuncios',
        href: '/dashboard/ads',
        Icon: TrendingUp,
        showWhen: (_cat, plan) => plan === 'business' || plan === 'agency',
      },
      { label: 'Negocio IA', href: '/dashboard/knowledge', Icon: Database },
      { label: 'Ejemplos IA', href: '/dashboard/examples', Icon: Bot },
      { label: 'Configuracion', href: '/dashboard/settings', Icon: Settings },
    ],
  },
]

function buildNavGroups(category: string, plan: PlanType): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    group: g.group,
    items: g.items.filter((item) => {
      if (item.hidden) return false
      return item.showWhen ? item.showWhen(category, plan) : true
    }),
  })).filter((g) => g.items.length > 0)
}

const PLAN_LABEL: Record<PlanType, string> = {
  basic: 'Basic',
  pro: 'Pro',
  business: 'Business',
  agency: 'Agency',
}

const CHANNEL_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google Business',
  whatsapp: 'WhatsApp',
}

function ChannelLogo({ platform }: { platform: string }) {
  if (platform === 'instagram') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <defs>
          <radialGradient id="ig-grad-sidebar" cx="30%" cy="107%" r="150%">
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect width="24" height="24" rx="6" fill="url(#ig-grad-sidebar)" />
        <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="white" strokeWidth="1.5" />
        <circle cx="16.5" cy="7.5" r="1" fill="white" />
      </svg>
    )
  }
  if (platform === 'facebook') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <rect width="24" height="24" rx="6" fill="#1877F2" />
        <path d="M13.5 8.5h2V6h-2C11.6 6 10 7.6 10 9.5V11H8v2.5h2V20h2.5v-6.5H15l.5-2.5h-3V9.5c0-.6.4-1 1-1z" fill="white" />
      </svg>
    )
  }
  if (platform === 'tiktok') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <rect width="24" height="24" rx="6" fill="#212121" />
        <path d="M15.6 5.6c.4 1.1 1.2 2 2.4 2.3v2.1c-.8 0-1.6-.2-2.4-.7v5c0 2.4-2 4.4-4.4 4.4s-4.4-2-4.4-4.4 2-4.4 4.4-4.4c.2 0 .4 0 .6.1v2.2c-.2-.1-.4-.1-.6-.1-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2V5.6h2.2z" fill="white" />
      </svg>
    )
  }
  if (platform === 'google') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <rect width="24" height="24" rx="6" fill="white" />
        <path d="M12 10.4h6c.1.5.2 1 .2 1.6 0 3.5-2.4 6-6.2 6-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.7 0 3.1.6 4.2 1.6l-1.7 1.7c-.7-.6-1.5-1-2.5-1-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c1.9 0 3.2-1.1 3.5-2.6H12v-2.3z" fill="#4285F4" />
        <path d="M6 12c0-.7.1-1.4.3-2.1L4.1 8.4C3.4 9.5 3 10.7 3 12s.4 2.5 1.1 3.6l2.2-1.5C6.1 13.4 6 12.7 6 12z" fill="#34A853" />
        <path d="M12 19.3c1.7 0 3.2-.6 4.3-1.5l-2-1.6c-.7.5-1.5.7-2.3.7-1.8 0-3.3-1.1-3.8-2.8l-2.2 1.7c1.1 2.1 3.3 3.5 6 3.5z" fill="#FBBC05" />
        <path d="M20 12c0-.7-.1-1.4-.2-2h-7.8v2.4h4.5c-.2.9-.7 1.7-1.5 2.2l2 1.6c1.4-1.3 2-3.1 2-4.2z" fill="#EA4335" />
      </svg>
    )
  }
  if (platform === 'whatsapp') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <rect width="24" height="24" rx="6" fill="#25D366" />
        <path d="M12 4.5A7.5 7.5 0 0 0 5.3 16l-1 3.5 3.6-1A7.5 7.5 0 1 0 12 4.5zm0 13.5a6 6 0 0 1-3.1-.9l-.2-.1-2.1.6.6-2.1-.2-.2A6 6 0 1 1 12 18zm3.3-4.5c-.2-.1-1-.5-1.2-.5-.2-.1-.3-.1-.4.1s-.5.6-.6.8c-.1.1-.2.1-.4 0-.2-.1-.8-.3-1.5-1-.6-.5-1-1.1-1.1-1.3 0-.2 0-.3.1-.4l.3-.3.2-.3v-.3L10 9.6c-.1-.3-.3-.3-.4-.3h-.4c-.1 0-.3 0-.5.2-.2.2-.7.7-.7 1.6s.7 1.9.8 2c.1.1 1.4 2.2 3.5 3 .5.2.9.3 1.2.4.5.1 1 .1 1.3.1.4-.1 1.2-.5 1.4-1s.2-.9.1-1c0-.1-.2-.2-.4-.3z" fill="white" />
      </svg>
    )
  }
  return (
    <span style={{ width: 16, height: 16, borderRadius: 3, background: '#6B7280', flexShrink: 0, display: 'inline-block' }} />
  )
}

interface SidebarProps {
  business: Business
  connectedNetworks?: Array<{ platform: string; platform_username: string | null }>
  onNavigate?: () => void
}

export function Sidebar({ business, connectedNetworks = [], onNavigate }: SidebarProps) {
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

  const appInitial = 'P'

  return (
    <aside
      style={{
        width: 224,
        background: '#111827',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 40,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '22px 20px 18px',
          borderBottom: '1px solid #1F2937',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 7,
            background: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {appInitial}
        </div>
        <p
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            margin: 0,
          }}
        >
          Publify
        </p>
      </div>

      {/* Navigation */}
      <nav
        className="sidebar-nav"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 10px 8px',
        }}
      >
        {groups.map((group) => (
          <div key={group.group}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginTop: 16,
                marginBottom: 8,
                padding: '0 12px',
                margin: '16px 0 8px',
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
                  onClick={onNavigate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 8,
                    width: '100%',
                    fontSize: 14,
                    color: isActive ? '#FFFFFF' : '#9CA3AF',
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? '#2563EB' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 150ms cubic-bezier(0.4,0,0.2,1)',
                    cursor: 'pointer',
                    marginBottom: 1,
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = '#1F2937'
                      el.style.color = '#FFFFFF'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      const el = e.currentTarget as HTMLAnchorElement
                      el.style.background = 'transparent'
                      el.style.color = '#9CA3AF'
                    }
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <Icon size={17} />
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        ))}

        {/* Channels section */}
        {connectedNetworks.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: '16px 0 8px',
                padding: '0 12px',
              }}
            >
              Canales
            </p>
            {connectedNetworks.map((net) => (
              <div
                key={net.platform}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  borderRadius: 8,
                }}
              >
                <ChannelLogo platform={net.platform} />
                <span
                  style={{
                    fontSize: 13,
                    color: '#9CA3AF',
                    fontWeight: 500,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {CHANNEL_LABELS[net.platform] ?? net.platform}
                </span>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#16A34A',
                    flexShrink: 0,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid #1F2937',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: '#2563EB',
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
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#FFFFFF',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            {business.name}
          </p>
          <p style={{ fontSize: 11, color: '#4B5563', margin: 0 }}>
            {PLAN_LABEL[business.plan]}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
            <Link
              href={'/dashboard/account' as Route}
              onClick={onNavigate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6B7280', textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9CA3AF' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#6B7280' }}
            >
              <UserCircle size={12} /> Mi cuenta
            </Link>
            <button
              onClick={handleSignOut}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280' }}
            >
              <LogOut size={12} /> Cerrar sesion
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
