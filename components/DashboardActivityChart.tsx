'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, TooltipProps,
} from 'recharts'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ChartDay {
  date: string
  label: string
  published: number
  scheduled: number
}

interface ConnectedNetwork {
  platform: string
  platform_username: string | null
}

interface Props {
  chartData: ChartDay[]
  totalThisMonth: number
  delta: number
  connectedNetworks: ConnectedNetwork[]
}

// ── Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0F0F0F',
      borderRadius: 8,
      padding: '9px 13px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    }}>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      {payload.map(p => (
        <p key={p.name} style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '2px 0' }}>
          {p.name === 'published' ? 'Publicados' : 'Programados'}: {p.value}
        </p>
      ))}
    </div>
  )
}

// ── Iconos SVG por plataforma ─────────────────────────────────────────
function IconInstagram() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad)" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" stroke="url(#ig-grad)" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="#C13584"/>
      <defs>
        <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F58529"/>
          <stop offset="50%" stopColor="#C13584"/>
          <stop offset="100%" stopColor="#833AB4"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

function IconFacebook() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#1877F2"/>
      <path d="M15.5 8H13.5C13.2 8 13 8.2 13 8.5V10H15.5L15.1 12.5H13V19H10.5V12.5H9V10H10.5V8.5C10.5 6.6 11.8 5.5 13.5 5.5H15.5V8Z" fill="#fff"/>
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#010101"/>
      <path d="M16 7.5C15.2 7.5 14.5 7 14 6.3V14.5C14 16.4 12.4 18 10.5 18C8.6 18 7 16.4 7 14.5C7 12.6 8.6 11 10.5 11C10.7 11 10.9 11 11.1 11.1V13.2C10.9 13.1 10.7 13 10.5 13C9.7 13 9 13.7 9 14.5C9 15.3 9.7 16 10.5 16C11.3 16 12 15.3 12 14.5V6H14C14.1 7.4 15.2 8.5 16.5 8.5V10.5C16.3 10.5 16.2 10.5 16 10.5V7.5Z" fill="white"/>
      <path d="M16 7.5C15.2 7.5 14.5 7 14 6.3V14.5C14 16.4 12.4 18 10.5 18C8.6 18 7 16.4 7 14.5C7 12.6 8.6 11 10.5 11C10.7 11 10.9 11 11.1 11.1V13.2C10.9 13.1 10.7 13 10.5 13C9.7 13 9 13.7 9 14.5C9 15.3 9.7 16 10.5 16C11.3 16 12 15.3 12 14.5V6H14C14.1 7.4 15.2 8.5 16.5 8.5V10.5" stroke="#69C9D0" strokeWidth="0.5"/>
    </svg>
  )
}

function IconGoogle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#fff" stroke="#E8E3DC" strokeWidth="1"/>
      <path d="M19 12.2c0-.6-.1-1.2-.2-1.7H12v3.2h4c-.2.9-.7 1.7-1.5 2.2v1.8h2.4C18.3 16.4 19 14.4 19 12.2z" fill="#4285F4"/>
      <path d="M12 19c2 0 3.7-.7 4.9-1.8l-2.4-1.8c-.7.4-1.5.7-2.5.7-1.9 0-3.5-1.3-4.1-3H5.4v1.9C6.6 17.6 9.1 19 12 19z" fill="#34A853"/>
      <path d="M7.9 13.1c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6V8H5.4C4.9 9.1 4.6 10.3 4.6 11.5s.3 2.4.8 3.5l2.5-1.9z" fill="#FBBC04"/>
      <path d="M12 7.6c1.1 0 2 .4 2.8 1.1l2.1-2.1C15.7 5.4 14 4.6 12 4.6c-2.9 0-5.4 1.6-6.6 3.9l2.5 1.9C8.5 8.9 10.1 7.6 12 7.6z" fill="#EA4335"/>
    </svg>
  )
}

// ── ESTADO A — Sin redes conectadas ───────────────────────────────────
function NoConnectionsEmpty() {
  const router = useRouter()

  const NETWORKS = [
    { name: 'Instagram',       Icon: IconInstagram },
    { name: 'Facebook',        Icon: IconFacebook  },
    { name: 'TikTok',          Icon: IconTikTok    },
    { name: 'Google Business', Icon: IconGoogle    },
  ]

  return (
    <div style={{
      background: '#F8F7F4',
      border: '1px solid #E8E3DC',
      borderRadius: 12,
      padding: '32px 24px',
      textAlign: 'center',
    }}>
      {/* Titulo */}
      <p style={{
        fontSize: 15, fontWeight: 600, color: '#1A1A1A',
        margin: '0 0 8px', letterSpacing: '-0.2px',
      }}>
        Conecta tus redes sociales
      </p>

      {/* Subtexto */}
      <p style={{
        fontSize: 13, color: '#7A7060',
        maxWidth: 420, margin: '0 auto 24px',
        lineHeight: 1.6,
      }}>
        Conecta Instagram, Facebook, TikTok o Google Business
        para publicar directamente desde la app y ver tu actividad aqui.
      </p>

      {/* Cards de redes con icono */}
      <div style={{
        display: 'flex', gap: 10,
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: 28,
      }}>
        {NETWORKS.map(({ name, Icon }) => (
          <div key={name} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#fff',
            border: '1px solid #E8E3DC',
            borderRadius: 10,
            padding: '10px 16px',
          }}>
            <Icon />
            <span style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#1A1A1A',
              whiteSpace: 'nowrap',
            }}>
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Boton principal */}
      <button
        onClick={() => router.push('/dashboard/connections')}
        style={{
          background: '#1A56DB',
          color: '#fff',
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          border: 'none',
          transition: 'opacity 120ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Conectar redes sociales
      </button>
    </div>
  )
}

// ── ESTADO B — Redes conectadas, sin actividad ────────────────────────
function ChartEmpty() {
  return (
    <div style={{
      height: 148,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      background: '#F8F7F4',
      borderRadius: 10,
      border: '1px solid #E8E3DC',
    }}>
      <p style={{ fontSize: 13, color: '#7A7060', margin: 0, textAlign: 'center' }}>
        Publica tu primer post para ver la actividad aqui
      </p>
      <Link
        href="/dashboard/create"
        style={{
          display: 'inline-block',
          background: '#1A56DB',
          color: '#fff',
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'opacity 120ms ease',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Crear primer post
      </Link>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────
export function DashboardActivityChart({ chartData, totalThisMonth, delta, connectedNetworks }: Props) {
  const hasConnections = connectedNetworks.length > 0
  const hasData = chartData.some(d => d.published > 0 || d.scheduled > 0)

  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 22px',
        borderBottom: '1px solid #EAECF0',
      }}>
        <div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#9EA3AE',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'block', marginBottom: 2,
          }}>
            Actividad de publicacion
          </span>
          <span style={{ fontSize: 11, color: '#9EA3AE' }}>Ultimos 14 dias</span>
        </div>

        {/* Legend + KPI solo si hay redes */}
        {hasConnections && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {[
                { color: '#1A56DB', label: 'Publicados' },
                { color: '#F59E0B', label: 'Programados' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 18, height: 2, background: color, display: 'inline-block', borderRadius: 1 }} />
                  <span style={{ fontSize: 11, color: '#9EA3AE' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#0F0F0F', letterSpacing: '-1px', lineHeight: 1 }}>
                  {totalThisMonth}
                </span>
                {delta !== 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: delta > 0 ? '#0E9F6E' : '#E02424',
                    background: delta > 0 ? '#DEF7EC' : '#FDE8E8',
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    {delta > 0 ? `↑ +${delta}` : `↓ ${delta}`}
                  </span>
                )}
              </div>
              <Link
                href="/dashboard/analytics"
                style={{ fontSize: 11, color: '#1A56DB', fontWeight: 600, textDecoration: 'none' }}
              >
                Ver analitica
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Contenido: estado A / B / C */}
      <div style={{ padding: '16px 22px 20px' }}>
        {!hasConnections ? (
          // ESTADO A
          <NoConnectionsEmpty />
        ) : hasData ? (
          // ESTADO C — grafica normal
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="gradPub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1A56DB" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#1A56DB" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSch" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#EAECF0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9EA3AE' }}
                tickLine={false} axisLine={false} interval={1}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9EA3AE' }}
                tickLine={false} axisLine={false} allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#EAECF0', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="published" name="published"
                stroke="#1A56DB" strokeWidth={2} fill="url(#gradPub)"
                dot={false} activeDot={{ r: 4, fill: '#1A56DB', strokeWidth: 0 }}
              />
              <Area type="monotone" dataKey="scheduled" name="scheduled"
                stroke="#F59E0B" strokeWidth={2} fill="url(#gradSch)"
                dot={false} activeDot={{ r: 4, fill: '#F59E0B', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          // ESTADO B — redes conectadas, sin actividad
          <ChartEmpty />
        )}
      </div>
    </div>
  )
}
