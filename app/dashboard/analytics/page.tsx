'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d'

interface PlatformStat {
  platform: string
  total_likes: number
  total_comments: number
  total_shares: number
  total_reach: number
  total_impressions: number
  avg_engagement: number
  posts_count: number
}

interface DailyPoint {
  day: string
  reach: number
  impressions: number
  engagement: number
}

interface TopPost {
  id: string
  content_text: string
  image_url: string | null
  published_at: string | null
  likes: number
  comments: number
  reach: number
  engagement_rate: number
  platform: string
}

interface BestHour {
  hour: number
  avg_engagement: number
}

interface Totals {
  total_reach: number
  total_impressions: number
  avg_engagement: number
  posts_count: number
}

interface Summary {
  by_platform: PlatformStat[]
  daily_evolution: DailyPoint[]
  top_posts: TopPost[]
  best_hours: BestHour[]
  totals: Totals
  has_data: boolean
}

interface Insight {
  title: string
  description: string
  priority: 'alta' | 'media' | 'baja'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const PRIORITY_VARIANT: Record<string, 'error' | 'warning' | 'success'> = {
  alta: 'error',
  media: 'warning',
  baja: 'success',
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: '#2563EB',
  facebook: '#1E3A8A',
  tiktok: '#111827',
}

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Ultimos 7 dias',
  '30d': 'Ultimos 30 dias',
  '90d': 'Ultimos 90 dias',
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card padding="md">
      <p className="text-xs text-[#374151] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#111827] leading-none">{value}</p>
      {sub && <p className="text-xs text-[#4B5563] mt-1">{sub}</p>}
    </Card>
  )
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function HourHeatmap({ bestHours }: { bestHours: BestHour[] }) {
  const maxEng = Math.max(...bestHours.map(h => h.avg_engagement), 0.01)
  const map: Record<number, number> = {}
  for (const h of bestHours) map[h.hour] = h.avg_engagement

  const topHour = bestHours[0]?.hour ?? null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: 24 }, (_, i) => {
          const eng = map[i] ?? 0
          const opacity = eng > 0 ? 0.15 + (eng / maxEng) * 0.85 : 0.05
          return (
            <div
              key={i}
              title={`${i}:00 — Engagement medio: ${eng.toFixed(2)}%`}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: `rgba(37,99,235,${opacity})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
              }}
            >
              <span style={{ fontSize: '10px', color: opacity > 0.5 ? '#fff' : '#374151', fontWeight: 500 }}>
                {i}
              </span>
            </div>
          )
        })}
      </div>
      {topHour !== null && (
        <p className="text-xs text-[#374151]">
          Mejor hora: <span className="font-semibold text-[#111827]">{topHour}:00</span>
        </p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [businessId, setBusinessId] = useState('')
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')

  // ── Boot ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!biz) { router.push('/onboarding'); return }

      setBusinessId(biz.id)
      setLoading(false)
      fetchSummary(biz.id, '30d')
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchSummary = useCallback(async (bid: string, p: Period) => {
    setSummaryLoading(true)
    setInsights([])
    const res = await fetch(`/api/analytics/summary?business_id=${bid}&period=${p}`)
    if (res.ok) {
      const data = await res.json() as Summary
      setSummary(data)
    }
    setSummaryLoading(false)
  }, [])

  function handlePeriodChange(p: Period) {
    setPeriod(p)
    if (businessId) fetchSummary(businessId, p)
  }

  async function handleAnalyze() {
    if (!summary) return
    setInsightsLoading(true)
    setInsightsError('')
    const res = await fetch('/api/analytics/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: businessId, summary }),
    })
    const data = await res.json()
    setInsightsLoading(false)
    if (!res.ok) {
      setInsightsError(data.error ?? 'Error al generar recomendaciones')
      return
    }
    setInsights((data.insights ?? []) as Insight[])
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm text-[#374151]">Cargando...</span>
      </div>
    )
  }

  // ── Chart data ────────────────────────────────────────────────────────────────

  const hasData = summary?.has_data === true

  const EMPTY_CHART = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => ({
    name: d, Alcance: 0, Impresiones: 0,
  }))

  const chartData = hasData && (summary?.daily_evolution ?? []).length > 0
    ? summary!.daily_evolution.map(d => ({
        name: fmtDay(d.day),
        Alcance: d.reach,
        Impresiones: d.impressions,
      }))
    : EMPTY_CHART

  const barData = (summary?.by_platform ?? []).map(p => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    Engagement: parseFloat(p.avg_engagement.toFixed(2)),
    fill: PLATFORM_COLORS[p.platform] ?? '#374151',
  }))

  const totals = summary?.totals ?? {
    total_reach: 0,
    total_impressions: 0,
    avg_engagement: 0,
    posts_count: 0,
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6 max-w-6xl mx-auto w-full">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Analitica"
          subtitle="Rendimiento de tus publicaciones en redes sociales"
        />
        <select
          value={period}
          onChange={e => handlePeriodChange(e.target.value as Period)}
          className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] shrink-0"
        >
          {(Object.entries(PERIOD_LABELS) as [Period, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* ── FILA 1: KPIs — siempre visibles ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Impresiones"
          value={summaryLoading ? '—' : fmtNum(totals.total_impressions)}
        />
        <KpiCard
          label="Alcance"
          value={summaryLoading ? '—' : fmtNum(totals.total_reach)}
        />
        <KpiCard
          label="Interacciones"
          value={summaryLoading ? '—' : fmtNum(totals.posts_count)}
        />
        <KpiCard
          label="Engagement"
          value={summaryLoading ? '—' : `${totals.avg_engagement}%`}
        />
      </div>

      {/* ── FILA 2: Gráfica — siempre visible, overlay si sin datos ─────── */}
      <Card>
        <p className="text-sm font-semibold text-[#111827] mb-4">Evolucion del alcance</p>
        <div className="relative">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4B5563' }} />
              <YAxis tick={{ fontSize: 11, fill: '#4B5563' }} />
              {hasData && (
                <Tooltip
                  contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}
                />
              )}
              {hasData && (
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
              )}
              <Line
                type="monotone"
                dataKey="Alcance"
                stroke={hasData ? '#2563EB' : '#E5E7EB'}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Impresiones"
                stroke={hasData ? '#4B5563' : '#F3F4F6'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>

          {/* Empty state overlay dentro de la gráfica */}
          {!summaryLoading && !hasData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 backdrop-blur-[1px] rounded-lg">
              <p className="text-sm font-medium text-[#111827]">
                Publica contenido para empezar a ver datos
              </p>
              <p className="text-xs text-[#374151]">
                Los datos apareceran aqui en las proximas 24 h tras publicar
              </p>
              <Button size="sm" onClick={() => router.push('/dashboard/create')}>
                Crear contenido
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ── FILA 3: BarChart + Heatmap ──────────────────────────────────── */}
      {!summaryLoading && hasData && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <p className="text-sm font-semibold text-[#111827] mb-4">Rendimiento por plataforma</p>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#4B5563' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#4B5563' }} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}
                    formatter={(v: unknown) => [`${v as number}%`, 'Engagement']}
                  />
                  <Bar dataKey="Engagement" radius={[4, 4, 0, 0]}>
                    {barData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[#374151] text-center py-8">Sin datos</p>
            )}
          </Card>

          <Card>
            <p className="text-sm font-semibold text-[#111827] mb-4">Mejor hora para publicar</p>
            {summary.best_hours.length > 0 ? (
              <HourHeatmap bestHours={summary.best_hours} />
            ) : (
              <p className="text-sm text-[#374151] text-center py-8">Sin datos suficientes</p>
            )}
          </Card>
        </div>
      )}

      {/* ── FILA 4: Top posts ───────────────────────────────────────────── */}
      {!summaryLoading && hasData && summary && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-[#111827]">Tus mejores publicaciones</p>
          {summary.top_posts.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-sm text-[#374151]">Sin publicaciones con metricas</p>
            </Card>
          ) : (
            summary.top_posts.map((post, idx) => (
              <Card
                key={post.id}
                padding="sm"
                className="flex items-center gap-4"
                style={idx === 0 ? { borderLeft: '3px solid #2563EB' } : {}}
              >
                {post.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.image_url}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center bg-[#F3F4F6]">
                    <span className="text-xs text-[#4B5563]">Sin imagen</span>
                  </div>
                )}

                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <p className="text-sm text-[#111827] line-clamp-2 leading-snug">
                    {post.content_text.slice(0, 80)}{post.content_text.length > 80 ? '...' : ''}
                  </p>
                  <div className="flex items-center gap-3">
                    <Badge variant="neutral">{post.platform}</Badge>
                    <span className="text-xs text-[#374151]">{post.likes} likes</span>
                    <span className="text-xs text-[#374151]">{post.comments} comentarios</span>
                    <span className="text-xs text-[#374151]">{fmtNum(post.reach)} alcance</span>
                    <span className="text-xs font-semibold text-[#2563EB]">{post.engagement_rate}% eng.</span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── FILA 5: Recomendaciones ─────────────────────────────────────── */}
      {!summaryLoading && hasData && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[#111827]">Recomendaciones</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAnalyze}
              disabled={insightsLoading}
            >
              {insightsLoading ? 'Analizando tus datos...' : 'Analizar con IA'}
            </Button>
          </div>

          {insightsError && (
            <p className="text-sm text-[#EF4444]">{insightsError}</p>
          )}

          {insights.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {insights.map((ins, idx) => (
                <Card key={idx} padding="md" className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', lineHeight: 1.4 }}>
                      {ins.title}
                    </p>
                    <Badge variant={PRIORITY_VARIANT[ins.priority] ?? 'neutral'}>
                      {ins.priority}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>
                    {ins.description}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {!insightsLoading && insights.length === 0 && !insightsError && (
            <Card className="text-center py-8">
              <p className="text-sm text-[#374151]">
                Haz clic en "Analizar con IA" para obtener recomendaciones personalizadas.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}


