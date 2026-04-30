'use client'

import Link from 'next/link'

const QUICK_ACTIONS = [
  {
    label: 'Nuevo post',
    href: '/dashboard/create',
    iconBg: '#EEF3FE',
    iconColor: '#1A56DB',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
  },
  {
    label: 'Crear video',
    href: '/dashboard/video',
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    label: 'Generar flyer',
    href: '/dashboard/create?type=flyer',
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  {
    label: 'Asistente IA',
    href: '/dashboard/chat',
    iconBg: '#F5F3FF',
    iconColor: '#7C3AED',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
]

const PROMO_PILLS: { label: string; type: string; color: string }[] = [
  { label: 'Oferta 2x1',   type: 'oferta_2x1',  color: '#1A56DB' },
  { label: 'Menu del dia', type: 'menu_dia',     color: '#059669' },
  { label: 'Happy Hour',   type: 'happy_hour',   color: '#D97706' },
  { label: 'Sorteo',       type: 'sorteo',       color: '#E02424' },
  { label: 'Evento',       type: 'evento',       color: '#7E3AF2' },
  { label: 'Black Friday', type: 'black_friday', color: '#1A1A1A' },
  { label: 'Navidad',      type: 'navidad',      color: '#0694A2' },
  { label: 'San Valentin', type: 'san_valentin', color: '#DB2777' },
  { label: 'Halloween',    type: 'halloween',    color: '#F97316' },
  { label: 'Apertura',     type: 'apertura',     color: '#059669' },
  { label: 'Aniversario',  type: 'aniversario',  color: '#D97706' },
]

export function DashboardQuickActions() {
  return (
    <>
      {/* Quick actions */}
      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 12, marginTop: 0 }}>
        Acciones rapidas
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
          marginBottom: 24,
        }}
      >
        {QUICK_ACTIONS.map(({ label, href, iconBg, iconColor, icon }) => (
          <Link
            key={label}
            href={href as never}
            className="group block bg-white border border-[#E8E3DC] rounded-[12px] text-center no-underline"
            style={{
              padding: '20px 14px 16px',
              cursor: 'pointer',
              transition: 'border-color 150ms, transform 150ms',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#1A56DB'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#E8E3DC'
              ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: iconBg,
                color: iconColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
              }}
            >
              {icon}
            </div>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#3A3F4B', margin: 0 }}>
              {label}
            </p>
          </Link>
        ))}
      </div>

      {/* Promo pills */}
      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 12, marginTop: 0 }}>
        Crear promocion
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {PROMO_PILLS.map(({ label, type, color }) => (
          <Link
            key={type}
            href={`/dashboard/create?promotion_type=${type}`}
            className="no-underline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: '#fff',
              border: '1px solid #E8E3DC',
              borderRadius: 999,
              padding: '7px 14px',
              fontSize: 12,
              fontWeight: 500,
              color: '#3A3F4B',
              cursor: 'pointer',
              transition: 'border-color 150ms, color 150ms',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = color
              el.style.color = color
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.borderColor = '#E8E3DC'
              el.style.color = '#3A3F4B'
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            {label}
          </Link>
        ))}
      </div>
    </>
  )
}
