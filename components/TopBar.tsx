'use client'

import { usePathname } from 'next/navigation'
import { NotificationBell } from '@/components/NotificationBell'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Inicio',
  '/dashboard/create': 'Crear contenido',
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
  // Match prefix
  const match = Object.keys(PAGE_TITLES)
    .filter((k) => k !== '/dashboard' && pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  return match ? PAGE_TITLES[match] : 'Dashboard'
}

interface TopBarProps {
  businessId: string
  userInitials: string
}

export function TopBar({ businessId, userInitials }: TopBarProps) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <header
      style={{
        height: 52,
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      {/* Page title */}
      <span style={{ fontSize: 16, fontWeight: 800, color: '#1A1A1A', letterSpacing: '-0.3px' }}>
        {pageTitle}
      </span>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Notification bell */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: '#F3F4F6',
            border: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NotificationBell businessId={businessId} compact />
        </div>

        {/* User avatar */}
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
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

