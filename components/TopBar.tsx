'use client'

import { usePathname } from 'next/navigation'
import { NotificationBell } from '@/components/NotificationBell'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/dashboard/create': 'Contenido',
  '/dashboard/video': 'Generar video',
  '/dashboard/calendar': 'Calendario',
  '/dashboard/chat': 'Asistente IA',
  '/dashboard/coupons': 'Cupones',
  '/dashboard/surveys': 'Encuestas',
  '/dashboard/campaigns': 'Campanas WhatsApp',
  '/dashboard/emails': 'Email marketing',
  '/dashboard/landing': 'Mi pagina web',
  '/dashboard/menu': 'Menu digital',
  '/dashboard/connections': 'Redes sociales',
  '/dashboard/reviews': 'Resenas Google',
  '/dashboard/analytics': 'Analitica',
  '/dashboard/competitors': 'Competencia',
  '/dashboard/ads': 'Anuncios',
  '/dashboard/knowledge': 'Negocio IA',
  '/dashboard/settings': 'Configuracion',
  '/dashboard/posts': 'Publicaciones',
  '/dashboard/library': 'Biblioteca',
  '/dashboard/notifications': 'Notificaciones',
  '/dashboard/pricing': 'Planes',
}

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/dashboard' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  return match ? PAGE_TITLES[match] : 'Dashboard'
}

interface TopBarProps {
  businessId: string
  userInitials: string
  businessName?: string
  onMenuClick?: () => void
}

export function TopBar({ businessId, userInitials, onMenuClick }: TopBarProps) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <header
      style={{
        height: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px 0 12px',
        flexShrink: 0,
      }}
    >
      {/* Mobile: hamburger + Publify logo | Desktop: page title */}
      <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#111827',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: '#2563EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          P
        </div>
        <span
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#111827',
            letterSpacing: '-0.03em',
          }}
        >
          Publify
        </span>
      </div>

      <span
        className="hidden md:block"
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: '#111827',
          letterSpacing: '-0.01em',
        }}
      >
        {pageTitle}
      </span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <NotificationBell businessId={businessId} compact />
        </div>

        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#111827',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {userInitials}
        </div>
      </div>
    </header>
  )
}
