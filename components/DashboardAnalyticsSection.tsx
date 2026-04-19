'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  TooltipProps,
} from 'recharts'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface DayMetric {
  date: string        // ISO YYYY-MM-DD
  label: string       // "lun 7" etc.
  shortLabel: string  // "L 7" (for 30d view)
  views: number
  engagement: number  // absolute interactions
  clicks: number
  isWeekend: boolean
  hasPromo: boolean
}

interface ContentTypeStat {
  type: string
  label: string
  count: number
  color: string
}

interface KPIStat {
  label: string
  value: string | number
  sub: string
  trend: number      // positive = good
  accentColor: string
}

type Range = '7d' | '30d'

// ─────────────────────────────────────────────────────────────────────────────
// Mock data generator
// Realistic pattern: weekends spike, promos spike even more, gradual growth
// ─────────────────────────────────────────────────────────────────────────────
function buildDays(count: number): DayMetric[] {
  const today = new Date()
  const days: DayMetric[] = []

  // Growth curve: older days are ~30% lower
  const growthFactor = (index: number) => 0.7 + 0.3 * (index / count)

  // Promo days scattered naturally
  const promoDays = new Set([3, 10, 17, 24, 28].filter(d => d < count))

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)

    const dayOfWeek = d.getDay() // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
    const isFriday  = dayOfWeek === 5
    const idx       = count - 1 - i
    const hasPromo  = promoDays.has(idx)

    // Base views: weekday 100-200, weekend 400-700, promo 2x
    const base       = isWeekend ? 480 : isFriday ? 280 : 130
    const promoBoost = hasPromo ? 1.8 : 1
    const noise      = 0.85 + Math.random() * 0.3
    const views      = Math.round(base * growthFactor(idx) * promoBoost * noise)

    // Engagement rate: 3-8% on normal days, up to 14% on promo
    const engRate    = hasPromo ? 0.11 + Math.random() * 0.03
                     : isWeekend ? 0.07 + Math.random() * 0.02
                     : 0.03 + Math.random() * 0.03
    const engagement = Math.round(views * engRate)
    const clicks     = Math.round(engagement * (0.3 + Math.random() * 0.2))

    const dayNames = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']
    const dayInitials = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
    const dateStr = d.toISOString().slice(0, 10)

    days.push({
      date: dateStr,
      label: `${dayNames[dayOfWeek]} ${d.getDate()}`,
      shortLabel: `${dayInitials[dayOfWeek]}${d.getDate()}`,
      views,
      engagement,
      clicks,
      isWeekend,
      hasPromo,
    })
  }
  return days
}

const ALL_30 = buildDays(30)
const ALL_7  = ALL_30.slice(-7)

// Content type breakdown — static but realistic
const CONTENT_TYPES: ContentTypeStat[] = [
  { type: 'promo',    label: 'Promocion',  count: 14, color: '#1A56DB' },
  { type: 'post',     label: 'Post',       count: 22, color: '#0E9F6E' },
  { type: 'video',    label: 'Video',      count: 8,  color: '#D97706' },
  { type: 'story',    label: 'Story',      count: 11, color: '#7E3AF2' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────
function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) }
function pct(n: number, d: number): string {
  if (d === 0) return '0%'
  return (n / d * 100).toFixed(1) + '%'
}
function fmtK(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltips — no default recharts grey box
// ─────────────────────────────────────────────────────────────────────────────
function LineTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1A1A1A',
      borderRadius: 8,
      padding: '9px 13px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 5px' }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '2px 0' }}>
          {p.name === 'views' ? 'Vistas' : 'Interacciones'}: {fmtK(p.value as number)}
        </p>
      ))}
    </div>
  )
}

function BarTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const total = sum(CONTENT_TYPES.map(c => c.count))
  const val = payload[0]?.value as number
  return (
    <div style={{
      background: '#1A1A1A',
      borderRadius: 8,
      padding: '9px 13px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
    }}>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 5px' }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>
        {val} posts · {pct(val, total)} del total
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI stat card
// ─────────────────────────────────────────────────────────────────────────────
function KPIStatCard({ label, value, sub, trend, accentColor }: KPIStat) {
  const trendUp = trend > 0
  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      padding: '20px 22px',
      borderTop: `3px solid ${accentColor}`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <p style={{ fontSize: 11, color: '#9E9688', fontWeight: 500, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </p>
      <p style={{ fontSize: 32, fontWeight: 700, color: '#1A1A1A', letterSpacing: '-1.5px', lineHeight: 1, margin: '0 0 6px' }}>
        {value}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: trendUp ? '#0E9F6E' : '#E02424',
          background: trendUp ? '#D1FAE5' : '#FEE2E2',
          borderRadius: 5,
          padding: '2px 7px',
        }}>
          {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
        <span style={{ fontSize: 11, color: '#9E9688' }}>{sub}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Insight chip
// ─────────────────────────────────────────────────────────────────────────────
function InsightChip({ text }: { text: string }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      background: '#EEF3FE',
      borderRadius: 999,
      padding: '5px 12px',
      fontSize: 12,
      fontWeight: 500,
      color: '#1A56DB',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {text}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function DashboardAnalyticsSection() {
  const [range, setRange] = useState<Range>('7d')

  const days = range === '7d' ? ALL_7 : ALL_30

  // ── Derived KPIs ────────────────────────────────────────────────
  const kpis = useMemo((): KPIStat[] => {
    const totalViews      = sum(days.map(d => d.views))
    const totalEngagement = sum(days.map(d => d.engagement))
    const totalClicks     = sum(days.map(d => d.clicks))

    // Compare first half vs second half for trend
    const half = Math.floor(days.length / 2)
    const firstViews  = sum(days.slice(0, half).map(d => d.views))
    const secondViews = sum(days.slice(half).map(d => d.views))
    const viewsTrend  = firstViews === 0 ? 0 : Math.round((secondViews - firstViews) / firstViews * 100)

    const firstEng   = sum(days.slice(0, half).map(d => d.engagement))
    const secondEng  = sum(days.slice(half).map(d => d.engagement))
    const engTrend   = firstEng === 0 ? 0 : Math.round((secondEng - firstEng) / firstEng * 100)

    const engRate    = totalViews === 0 ? 0 : (totalEngagement / totalViews * 100)

    return [
      {
        label:       'Alcance total',
        value:       fmtK(totalViews),
        sub:         range === '7d' ? 'ultimos 7 dias' : 'ultimos 30 dias',
        trend:       viewsTrend,
        accentColor: '#1A56DB',
      },
      {
        label:       'Engagement',
        value:       engRate.toFixed(1) + '%',
        sub:         'interacciones / vistas',
        trend:       engTrend,
        accentColor: '#0E9F6E',
      },
      {
        label:       'Clicks totales',
        value:       fmtK(totalClicks),
        sub:         'en enlaces y perfil',
        trend:       Math.round(engTrend * 0.7),
        accentColor: '#D97706',
      },
      {
        label:       'Mejor dia',
        value:       days.reduce((a, b) => b.views > a.views ? b : a).label,
        sub:         `${fmtK(days.reduce((a, b) => b.views > a.views ? b : a).views)} vistas`,
        trend:       12,
        accentColor: '#7E3AF2',
      },
    ]
  }, [days, range])

  // ── Insights ────────────────────────────────────────────────────
  const promoViews  = sum(days.filter(d => d.hasPromo).map(d => d.views))
  const normalViews = sum(days.filter(d => !d.hasPromo).map(d => d.views))
  const promoDays   = days.filter(d => d.hasPromo).length
  const normalDays  = days.filter(d => !d.hasPromo).length
  const promoAvg    = promoDays  > 0 ? promoViews  / promoDays  : 0
  const normalAvg   = normalDays > 0 ? normalViews / normalDays : 0
  const promoMulti  = normalAvg  > 0 ? (promoAvg / normalAvg).toFixed(1) : '2.0'
  const bestDay     = days.reduce((a, b) => b.views > a.views ? b : a)

  const insights = [
    `Las promociones generan ${promoMulti}x mas alcance`,
    `Mejor dia de la semana: ${bestDay.label}`,
    range === '7d'
      ? 'Los sabados tienen el mayor engagement'
      : 'El crecimiento esta semana fue de +12%',
  ]

  // ── Chart data (thinned for 30d — every other point) ────────────
  const lineData = range === '30d'
    ? days.filter((_, i) => i % 2 === 0)
    : days

  const labelKey: keyof DayMetric = range === '7d' ? 'label' : 'shortLabel'

  return (
    <section style={{ marginTop: 14 }}>

      {/* ── Section header ────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: '0 0 2px', letterSpacing: '-0.2px' }}>
            Rendimiento
          </p>
          <p style={{ fontSize: 12, color: '#9E9688', margin: 0 }}>
            Actividad de tus publicaciones en redes sociales
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Insights */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {insights.slice(0, 2).map(text => (
              <InsightChip key={text} text={text} />
            ))}
          </div>

          {/* Range selector */}
          <div style={{
            display: 'flex',
            background: '#fff',
            border: '1px solid #E8E3DC',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {(['7d', '30d'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: range === r ? '#fff' : '#9E9688',
                  background: range === r ? '#1A56DB' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 120ms, color 120ms',
                }}
              >
                {r === '7d' ? '7 dias' : '30 dias'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 12,
      }}>
        {kpis.map(kpi => <KPIStatCard key={kpi.label} {...kpi} />)}
      </div>

      {/* ── Charts row ────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '3fr 2fr',
        gap: 12,
      }}>

        {/* Line chart — views + engagement */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px' }}>
                Vistas e interacciones
              </p>
              <p style={{ fontSize: 11, color: '#9E9688', margin: 0 }}>
                Rendimiento diario de publicaciones
              </p>
            </div>
            <div style={{ display: 'flex', gap: 14 }}>
              {[
                { color: '#1A56DB', label: 'Vistas' },
                { color: '#0E9F6E', label: 'Interacciones' },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 20, height: 2, background: color, display: 'inline-block', borderRadius: 1 }} />
                  <span style={{ fontSize: 11, color: '#9E9688' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#1A56DB" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#1A56DB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#F0EDE8" vertical={false} />
              <XAxis
                dataKey={labelKey}
                tick={{ fontSize: 10, fill: '#9E9688' }}
                tickLine={false}
                axisLine={false}
                interval={range === '30d' ? 2 : 0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9E9688' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmtK}
                width={36}
              />
              <Tooltip content={<LineTooltip />} cursor={{ stroke: '#E8E3DC', strokeWidth: 1.5 }} />
              <Line
                type="monotone"
                dataKey="views"
                name="views"
                stroke="#1A56DB"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#1A56DB', strokeWidth: 0 }}
              />
              <Line
                type="monotone"
                dataKey="engagement"
                name="engagement"
                stroke="#0E9F6E"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#0E9F6E', strokeWidth: 0 }}
                strokeDasharray="5 4"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart — content by type */}
        <div style={{
          background: '#fff',
          borderRadius: 14,
          padding: '20px 24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <div style={{ marginBottom: 18 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px' }}>
              Posts por tipo
            </p>
            <p style={{ fontSize: 11, color: '#9E9688', margin: 0 }}>
              Distribucion de contenido publicado
            </p>
          </div>

          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={CONTENT_TYPES}
              margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
              barSize={32}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="#F0EDE8" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#9E9688' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9E9688' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="count" name="count" radius={[5, 5, 0, 0]}>
                {CONTENT_TYPES.map(entry => (
                  <Cell key={entry.type} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Mini legend with percentages */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '6px 12px',
            marginTop: 12,
          }}>
            {CONTENT_TYPES.map(ct => {
              const total = sum(CONTENT_TYPES.map(c => c.count))
              return (
                <div key={ct.type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: ct.color, flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 11, color: '#5A6070', flex: 1 }}>{ct.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>
                    {pct(ct.count, total)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
