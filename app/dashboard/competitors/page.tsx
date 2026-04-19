'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Route } from 'next'

// ── Types ─────────────────────────────────────────────────────────────────────

type ReportStatus = 'analyzing' | 'completed' | 'failed'

interface RawData {
  avg_engagement?: number
  avg_likes?: number
  avg_comments?: number
  posting_frequency?: number
  content_types?: Record<string, number>
  top_posts?: Array<{ caption: string; likesCount: number; commentsCount: number }>
  biography?: string
  followersCount?: number
  content_strategy?: string
  posting_recommendation?: string
  key_differentiators?: string[]
}

interface Opportunity {
  title: string
  description: string
  action: string
}

interface KeyFinding {
  type: 'strength' | 'weakness'
  text: string
}

interface CompetitorReport {
  id: string
  competitor_handle: string
  competitor_name: string | null
  competitor_followers: number | null
  competitor_posts_analyzed: number
  status: ReportStatus
  raw_data: RawData
  report_text: string | null
  key_findings: KeyFinding[]
  opportunities: Opportunity[]
  error_message: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatFollowers(n: number | null) {
  if (!n) return '–'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

const STATUS_BADGE: Record<ReportStatus, { variant: 'neutral' | 'info' | 'success' | 'error'; label: string }> = {
  analyzing: { variant: 'info',    label: 'Analizando' },
  completed:  { variant: 'success', label: 'Completado' },
  failed:     { variant: 'error',   label: 'Fallido' },
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CompetitorsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [businessId, setBusinessId] = useState('')
  const [plan, setPlan] = useState<string>('basic')
  const [loading, setLoading] = useState(true)

  // Form
  const [handle, setHandle] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')

  // Polling state
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [activeHandle, setActiveHandle] = useState<string | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Reports
  const [reports, setReports] = useState<CompetitorReport[]>([])
  const [selectedReport, setSelectedReport] = useState<CompetitorReport | null>(null)

  // ── Boot ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: biz } = await supabase
        .from('businesses')
        .select('id, plan')
        .eq('owner_id', user.id)
        .single()

      if (!biz) { router.push('/onboarding'); return }

      setBusinessId(biz.id)
      setPlan(biz.plan)
      setLoading(false)

      if (biz.plan === 'basic') return
      fetchReports(biz.id)
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchReports = useCallback(async (bid: string) => {
    const res = await fetch(`/api/competitors/list?business_id=${bid}`)
    if (res.ok) {
      const data = await res.json()
      setReports(data)
    }
  }, [])

  // ── Polling ────────────────────────────────────────────────────────────────

  const startPolling = useCallback((reportId: string, bid: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/competitors/status?report_id=${reportId}&business_id=${bid}`)
        if (!res.ok) return
        const data: CompetitorReport = await res.json()

        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(pollingRef.current!)
          pollingRef.current = null
          setActiveReportId(null)
          setActiveHandle(null)
          await fetchReports(bid)
          if (data.status === 'completed') {
            setSelectedReport(data)
          }
        }
      } catch (err) {
        console.error('[competitors/polling] error:', err)
      }
    }, 5000)
  }, [fetchReports])

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // ── Analyze ────────────────────────────────────────────────────────────────

  async function handleAnalyze() {
    if (!handle.trim() || !businessId) return
    setAnalyzing(true)
    setAnalyzeError('')
    setSelectedReport(null)

    try {
      const res = await fetch('/api/competitors/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId, competitor_handle: handle }),
      })

      const data = await res.json()
      if (!res.ok) { setAnalyzeError(data.error ?? 'Error al iniciar el analisis'); return }

      const cleanHandle = handle.trim().replace(/^@/, '')
      setActiveReportId(data.report_id)
      setActiveHandle(cleanHandle)
      setHandle('')
      startPolling(data.report_id, businessId)
      fetchReports(businessId)
    } catch {
      setAnalyzeError('Error de conexion')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[#374151]">Cargando...</p>
      </div>
    )
  }

  // Plan gate
  if (plan === 'basic') {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader
          title="Analisis de competencia"
          subtitle="Descubre oportunidades comparando tu negocio con la competencia"
        />
        <Card>
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[#111827] mb-1">
                El analisis de competencia esta disponible en el plan Pro o superior
              </p>
              <p className="text-sm text-[#374151]">
                Analiza el Instagram de tus competidores y descubre oportunidades de diferenciacion con IA.
              </p>
            </div>
            <Link href={'/pricing' as Route}>
              <Button>Ver planes</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const isAnalyzing = activeReportId !== null

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <PageHeader
        title="Analisis de competencia"
        subtitle="Descubre oportunidades comparando tu negocio con la competencia"
      />

      <div className="flex gap-6 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ flex: '0 0 38%' }}>

          {/* Analyze form */}
          <Card>
            <h2 className="text-base font-semibold text-[#111827] mb-4">Analizar competidor</h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Usuario de Instagram del competidor
                </label>
                <input
                  type="text"
                  value={handle}
                  onChange={e => setHandle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAnalyze() }}
                  placeholder="Ej: restaurante_competidor (sin @)"
                  disabled={isAnalyzing || analyzing}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                />
                <p className="text-xs text-[#374151] mt-1">Solo perfiles publicos de Instagram</p>
              </div>

              {analyzeError && (
                <p className="text-sm text-red-600">{analyzeError}</p>
              )}

              <Button
                onClick={handleAnalyze}
                disabled={analyzing || isAnalyzing || !handle.trim()}
              >
                {analyzing ? 'Iniciando...' : 'Analizar'}
              </Button>

              <p className="text-xs text-[#4B5563] text-center">
                El analisis puede tardar entre 1 y 3 minutos
              </p>
            </div>
          </Card>

          {/* Analyzing state */}
          {isAnalyzing && (
            <Card>
              <p className="text-sm font-medium text-[#111827] mb-1">
                Analizando @{activeHandle}...
              </p>
              <p className="text-xs text-[#374151] mb-3">
                Obteniendo sus ultimos 30 posts y calculando metricas...
              </p>
              {/* Indeterminate progress bar */}
              <div className="w-full bg-[#F3F4F6] rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] rounded-full"
                  style={{
                    width: '40%',
                    animation: 'slide 1.8s ease-in-out infinite',
                  }}
                />
              </div>
            </Card>
          )}

          {/* History */}
          {reports.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[#374151]">Historial de analisis</p>
              {reports.map(report => {
                const badge = STATUS_BADGE[report.status]
                const isSelected = selectedReport?.id === report.id
                return (
                  <button
                    key={report.id}
                    onClick={() => {
                      if (report.status === 'completed') setSelectedReport(report)
                    }}
                    className={[
                      'w-full text-left rounded-xl border p-3 transition-colors',
                      report.status === 'completed' ? 'cursor-pointer' : 'cursor-default',
                      isSelected
                        ? 'border-[#2563EB] bg-[#EFF6FF]'
                        : 'border-[#E5E7EB] bg-white hover:bg-[#F7F8FA]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-[#111827] truncate">
                        @{report.competitor_handle}
                      </span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#4B5563]">{formatDate(report.created_at)}</span>
                      {report.status === 'completed' && report.raw_data?.avg_engagement !== undefined && (
                        <span className="text-xs text-[#374151]">
                          Eng. {report.raw_data.avg_engagement}%
                        </span>
                      )}
                    </div>
                    {report.status === 'failed' && report.error_message && (
                      <p className="text-xs text-red-600 mt-1 truncate">{report.error_message}</p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN — Report ────────────────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ flex: '1 1 0' }}>
          {!selectedReport ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p className="text-sm text-[#4B5563]">Selecciona o analiza un competidor</p>
              </div>
            </Card>
          ) : (
            <ReportView report={selectedReport} />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes slide {
          0% { transform: translateX(-150%); }
          50% { transform: translateX(250%); }
          100% { transform: translateX(-150%); }
        }
      `}</style>
    </div>
  )
}

// ── Report view ───────────────────────────────────────────────────────────────

function ReportView({ report }: { report: CompetitorReport }) {
  const router = useRouter()
  const raw = report.raw_data ?? {}
  const strengths = report.key_findings?.filter(f => f.type === 'strength') ?? []
  const weaknesses = report.key_findings?.filter(f => f.type === 'weakness') ?? []

  function handleApply() {
    const context = encodeURIComponent(
      `Aplica estas recomendaciones de diferenciacion frente a @${report.competitor_handle}: ${raw.key_differentiators?.join('. ') ?? ''}`
    )
    router.push(`/dashboard/create?context=${context}` as Route)
  }

  return (
    <>
      {/* Header */}
      <Card>
        <div className="flex flex-col gap-1">
          <p className="text-[20px] font-semibold text-[#111827] leading-tight">
            {report.competitor_name ?? `@${report.competitor_handle}`}
          </p>
          <p className="text-[14px] text-[#374151]">@{report.competitor_handle}</p>
          {report.competitor_followers !== null && (
            <p className="text-[14px] text-[#374151]">
              {formatFollowers(report.competitor_followers)} seguidores
            </p>
          )}
          <p className="text-xs text-[#4B5563] mt-1">Analizado el {formatDate(report.created_at)}</p>
        </div>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm">
          <p className="text-xs text-[#374151] mb-1">Engagement medio</p>
          <p className="text-xl font-semibold text-[#111827]">
            {raw.avg_engagement !== undefined ? `${raw.avg_engagement}%` : '–'}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[#374151] mb-1">Frecuencia</p>
          <p className="text-xl font-semibold text-[#111827]">
            {raw.posting_frequency !== undefined ? `${raw.posting_frequency}/sem` : '–'}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-[#374151] mb-1">Posts analizados</p>
          <p className="text-xl font-semibold text-[#111827]">
            {report.competitor_posts_analyzed ?? 0}
          </p>
        </Card>
      </div>

      {/* Executive summary */}
      {report.report_text && (
        <Card>
          <p className="text-xs font-medium text-[#374151] uppercase tracking-wide mb-2">Resumen ejecutivo</p>
          <div className="bg-[#F7F8FA] rounded-lg p-4">
            <p className="text-[14px] text-[#374151] leading-relaxed">{report.report_text}</p>
          </div>
        </Card>
      )}

      {/* Strengths & Weaknesses */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {strengths.length > 0 && (
            <Card>
              <p className="text-sm font-medium text-[#111827] mb-3">Puntos fuertes</p>
              <ul className="flex flex-col gap-2">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-[13px] text-[#374151]">{s.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {weaknesses.length > 0 && (
            <Card>
              <p className="text-sm font-medium text-[#111827] mb-3">Puntos debiles</p>
              <ul className="flex flex-col gap-2">
                {weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span className="text-[13px] text-[#374151]">{w.text}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* Opportunities */}
      {report.opportunities?.length > 0 && (
        <Card>
          <p className="text-[16px] font-medium text-[#111827] mb-4">Como diferenciarte</p>
          <div className="flex flex-col gap-3">
            {report.opportunities.map((opp, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#E5E7EB] pl-3 pr-4 py-3"
                style={{ borderLeftWidth: 3, borderLeftColor: '#2563EB' }}
              >
                <p className="text-[14px] font-medium text-[#111827] mb-1">{opp.title}</p>
                <p className="text-[13px] text-[#374151] mb-2">{opp.description}</p>
                <div className="bg-[#EFF6FF] rounded-lg px-3 py-2">
                  <p className="text-[13px] text-[#2563EB]">
                    <span className="font-medium">Accion esta semana:</span> {opp.action}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Content recommendations */}
      {(raw.content_strategy || raw.posting_recommendation) && (
        <div className="grid grid-cols-2 gap-3">
          {raw.content_strategy && (
            <Card>
              <p className="text-sm font-medium text-[#111827] mb-2">Estrategia de contenido</p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{raw.content_strategy}</p>
            </Card>
          )}
          {raw.posting_recommendation && (
            <Card>
              <p className="text-sm font-medium text-[#111827] mb-2">Frecuencia recomendada</p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{raw.posting_recommendation}</p>
            </Card>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="pb-2">
        <Button onClick={handleApply}>
          Aplicar estas recomendaciones
        </Button>
      </div>
    </>
  )
}


