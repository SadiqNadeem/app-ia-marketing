'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  ChevronLeft,
  TrendingUp,
  AlertTriangle,
  Send,
  Users,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import QRCode from 'qrcode'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Question {
  id: string
  type: 'rating' | 'text'
  text: string
  required: boolean
}

interface Survey {
  id: string
  name: string
  questions: Question[]
  is_active: boolean
  alert_threshold: number
  created_at: string
  metrics: { sent: number; completed: number; avg_score: number | null }
}

interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
}

interface SurveyResults {
  total_sent: number
  total_completed: number
  completion_rate: number
  overall_avg: number
  question_averages: Array<{ question_id: string; question_text: string; avg_score: number; response_count: number }>
  score_distribution: Record<number, number>
  recent_text_responses: Array<{ text: string; completed_at: string }>
  daily_scores: Array<{ date: string; avg_score: number; count: number }>
}

interface Insights {
  summary: string
  keywords: Array<{ word: string; count: number }>
  top_issues: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
  response_count: number
  text_count: number
}

type Tab = 'list' | 'create' | 'results'

interface Template {
  label: string
  description: string
  questions: Omit<Question, 'id'>[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    label: 'Experiencia cliente',
    description: 'Valora la experiencia general, recoge comentarios y mide fidelidad',
    questions: [
      { type: 'rating', text: 'Valora tu experiencia general (1-5)', required: true },
      { type: 'text', text: 'Que mejorarías de tu visita?', required: false },
      { type: 'rating', text: 'Volvarias con nosotros?', required: true },
    ],
  },
  {
    label: 'Calidad del servicio',
    description: 'Mide la atencion del personal y la satisfaccion con el servicio',
    questions: [
      { type: 'rating', text: 'Como valorarias la atencion recibida?', required: true },
      { type: 'rating', text: 'La rapidez del servicio fue adecuada?', required: true },
      { type: 'text', text: 'Algun comentario sobre nuestro equipo?', required: false },
    ],
  },
  {
    label: 'Valoracion de producto',
    description: 'Evalua la calidad del producto y la intencion de recompra',
    questions: [
      { type: 'rating', text: 'Como valorarias la calidad del producto?', required: true },
      { type: 'rating', text: 'Recomendarias nuestros productos a un amigo?', required: true },
      { type: 'text', text: 'Que producto te gustaria que anadieramos?', required: false },
    ],
  },
  {
    label: 'Post-visita rapida',
    description: 'Encuesta breve de 2 preguntas para maxima tasa de respuesta',
    questions: [
      { type: 'rating', text: 'Del 1 al 5, como ha sido tu experiencia hoy?', required: true },
      { type: 'text', text: 'En una frase, que destacarias de tu visita?', required: false },
    ],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function newQuestion(type: 'rating' | 'text'): Question {
  return { id: crypto.randomUUID(), type, text: '', required: type === 'rating' }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function scoreColor(score: number): string {
  if (score >= 4) return '#0E9F6E'
  if (score >= 3) return '#D97706'
  return '#E02424'
}

function scoreBg(score: number): string {
  if (score >= 4) return '#DEF7EC'
  if (score >= 3) return '#FFF8E6'
  return '#FDE8E8'
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SurveysPage() {
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('list')
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)

  // ── Create state ─────────────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formName, setFormName] = useState('')
  const [formQuestions, setFormQuestions] = useState<Question[]>([])
  const [customMode, setCustomMode] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // ── Results state ─────────────────────────────────────────────────────────────
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [results, setResults] = useState<SurveyResults | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')

  // ── Share modal ───────────────────────────────────────────────────────────────
  const [shareModalSurvey, setShareModalSurvey] = useState<Survey | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [shareQrUrl, setShareQrUrl] = useState('')
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Send modal ────────────────────────────────────────────────────────────────
  const [sendModalSurvey, setSendModalSurvey] = useState<Survey | null>(null)
  const [sendChannel, setSendChannel] = useState<'email' | 'whatsapp'>('email')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [customersLoading, setCustomersLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)

  // Load business id
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single()
      if (data) setBusinessId(data.id)
    })
  }, [])

  const loadSurveys = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const res = await fetch(`/api/surveys/list?business_id=${businessId}`)
    const data = await res.json()
    setSurveys(data.surveys ?? [])
    setLoading(false)
  }, [businessId])

  useEffect(() => {
    if (businessId) loadSurveys()
  }, [businessId, loadSurveys])

  // Load customers when send modal opens
  useEffect(() => {
    if (!sendModalSurvey || !businessId) return
    setCustomersLoading(true)
    setSelectedCustomers(new Set())
    setSendResult(null)
    const supabase = createClient()
    supabase
      .from('customers')
      .select('id, name, email, phone')
      .eq('business_id', businessId)
      .order('name')
      .then(({ data }) => {
        setCustomers(data ?? [])
        setCustomersLoading(false)
      })
  }, [sendModalSurvey, businessId])

  // Generate QR when share modal opens
  useEffect(() => {
    if (!shareModalSurvey) { setShareQrUrl(''); setShareLink(''); return }
    const link = `${window.location.origin}/encuesta/open/${shareModalSurvey.id}`
    setShareLink(link)
    QRCode.toDataURL(link, { width: 180, margin: 2, color: { dark: '#111827', light: '#FFFFFF' } })
      .then(setShareQrUrl)
      .catch(() => setShareQrUrl(''))
  }, [shareModalSurvey])

  const filteredCustomers = customers.filter(c =>
    sendChannel === 'email' ? !!c.email : !!c.phone
  )

  // ── Create ────────────────────────────────────────────────────────────────────

  function pickTemplate(tpl: Template) {
    setSelectedTemplate(tpl)
    setFormName(tpl.label)
    setFormQuestions(tpl.questions.map(q => ({ ...q, id: crypto.randomUUID() })))
    setCustomMode(false)
    setCreateError('')
  }

  function resetCreate() {
    setSelectedTemplate(null)
    setFormName('')
    setFormQuestions([])
    setCustomMode(false)
    setCreateError('')
  }

  function updateQuestionText(id: string, text: string) {
    setFormQuestions(prev => prev.map(q => q.id === id ? { ...q, text } : q))
  }

  function addQuestion(type: 'rating' | 'text') {
    if (formQuestions.length >= 5) return
    setFormQuestions(prev => [...prev, newQuestion(type)])
  }

  function removeQuestion(id: string) {
    setFormQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handleCreate() {
    if (!businessId || !formName.trim() || formQuestions.length === 0) return
    setCreateError('')
    setCreating(true)
    const res = await fetch('/api/surveys/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: businessId,
        name: formName.trim(),
        questions: formQuestions,
        alert_threshold: 3.0,
      }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(data.error ?? 'Error al crear la encuesta'); return }
    resetCreate()
    await loadSurveys()
    setTab('list')
  }

  // ── Toggle ────────────────────────────────────────────────────────────────────

  async function toggleActive(survey: Survey) {
    await fetch('/api/surveys/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ survey_id: survey.id, is_active: !survey.is_active }),
    })
    setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, is_active: !s.is_active } : s))
  }

  // ── Results ───────────────────────────────────────────────────────────────────

  async function openResults(survey: Survey) {
    setSelectedSurvey(survey)
    setInsights(null)
    setInsightsError('')
    setTab('results')
    setResultsLoading(true)
    const res = await fetch(`/api/surveys/results?survey_id=${survey.id}&business_id=${businessId}`)
    const data = await res.json()
    setResults(data)
    setResultsLoading(false)
  }

  async function loadInsights() {
    if (!selectedSurvey || !businessId) return
    setInsightsLoading(true)
    setInsightsError('')
    const res = await fetch('/api/surveys/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ survey_id: selectedSurvey.id, business_id: businessId }),
    })
    const data = await res.json()
    setInsightsLoading(false)
    if (!res.ok) { setInsightsError(data.error ?? 'Error al generar insights'); return }
    setInsights(data as Insights)
  }

  // ── Share ─────────────────────────────────────────────────────────────────────

  function copyShareLink() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setShareCopied(false), 2000)
    })
  }

  function openWhatsApp() {
    const text = encodeURIComponent(`Hola! Te invitamos a responder nuestra encuesta de satisfaccion: ${shareLink}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  // ── Send ──────────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!sendModalSurvey || !businessId || selectedCustomers.size === 0 || sending) return
    setSending(true)
    const res = await fetch('/api/surveys/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        survey_id: sendModalSurvey.id,
        business_id: businessId,
        customer_ids: Array.from(selectedCustomers),
        channel: sendChannel,
      }),
    })
    const data = await res.json()
    setSending(false)
    setSendResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 })
    await loadSurveys()
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Encuestas de satisfaccion"
        subtitle="Recoge feedback y toma decisiones"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#EAECF0] mb-6">
        {[
          { key: 'list', label: 'Mis encuestas' },
          { key: 'create', label: 'Nueva encuesta' },
          ...(tab === 'results' && selectedSurvey
            ? [{ key: 'results', label: selectedSurvey.name }]
            : []),
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as Tab)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-[120ms]',
              tab === key
                ? 'border-[#1A56DB] text-[#1A56DB]'
                : 'border-transparent text-[#5A6070] hover:text-[#111827]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: LIST ────────────────────────────────────────────────────────── */}
      {tab === 'list' && (
        <div>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[15px] text-[#5A6070] mb-4">Todavia no tienes encuestas</p>
              <Button onClick={() => setTab('create')}>Crear primera encuesta</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {surveys.map(survey => {
                const belowThreshold =
                  survey.metrics.avg_score !== null &&
                  survey.metrics.avg_score < survey.alert_threshold &&
                  survey.metrics.completed > 0
                return (
                  <Card key={survey.id} className={belowThreshold ? 'border-[#E02424]' : ''}>
                    <div className="flex items-start gap-4">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-[#111827] text-[15px] truncate">
                            {survey.name}
                          </p>
                          <Badge variant={survey.is_active ? 'success' : 'neutral'}>
                            {survey.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                          {belowThreshold && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E02424] bg-[#FDE8E8] px-2 py-0.5 rounded-full">
                              <AlertTriangle size={10} strokeWidth={2} />
                              Nota baja
                            </span>
                          )}
                        </div>

                        <p className="text-[12px] text-[#9EA3AE] mb-3">
                          {formatDate(survey.created_at)} &middot; {survey.questions.length} preguntas
                        </p>

                        {/* Metrics row */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Send size={12} strokeWidth={2} className="text-[#9EA3AE]" />
                            <span className="text-[13px] text-[#5A6070]">
                              <span className="font-semibold text-[#111827]">{survey.metrics.sent}</span> enviadas
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users size={12} strokeWidth={2} className="text-[#9EA3AE]" />
                            <span className="text-[13px] text-[#5A6070]">
                              <span className="font-semibold text-[#111827]">{survey.metrics.completed}</span> respuestas
                            </span>
                          </div>
                          {survey.metrics.avg_score !== null && (
                            <span
                              className="text-[13px] font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                color: scoreColor(survey.metrics.avg_score),
                                backgroundColor: scoreBg(survey.metrics.avg_score),
                              }}
                            >
                              {survey.metrics.avg_score.toFixed(1)}/5
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <Button size="sm" onClick={() => openResults(survey)}>
                          Ver resultados
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setShareModalSurvey(survey)}
                          >
                            <Share2 size={13} strokeWidth={2} />
                            Compartir
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSendModalSurvey(survey)}
                          >
                            Enviar
                          </Button>
                        </div>
                        <button
                          onClick={() => toggleActive(survey)}
                          className="text-[11px] text-[#9EA3AE] hover:text-[#5A6070] transition-colors text-right"
                        >
                          {survey.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: CREATE ──────────────────────────────────────────────────────── */}
      {tab === 'create' && (
        <div className="max-w-2xl">
          {!selectedTemplate ? (
            /* Step 1: Choose template */
            <div>
              <p className="text-[14px] text-[#5A6070] mb-5">
                Elige una plantilla para empezar en segundos
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-6">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.label}
                    onClick={() => pickTemplate(tpl)}
                    className="text-left border border-[#EAECF0] rounded-[10px] p-4 bg-white hover:border-[#1A56DB] hover:bg-[#EEF3FE] transition-all duration-[120ms] group"
                  >
                    <p className="font-semibold text-[#111827] text-[14px] mb-1 group-hover:text-[#1A56DB]">
                      {tpl.label}
                    </p>
                    <p className="text-[12px] text-[#9EA3AE] mb-3">{tpl.description}</p>
                    <div className="flex flex-col gap-1">
                      {tpl.questions.map((q, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#EAECF0] group-hover:bg-[#1A56DB] shrink-0" />
                          <span className="text-[11px] text-[#5A6070] truncate">{q.text}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom option */}
              <button
                onClick={() => {
                  setSelectedTemplate({ label: 'Encuesta personalizada', description: '', questions: [] })
                  setFormName('')
                  setFormQuestions([newQuestion('rating')])
                  setCustomMode(true)
                }}
                className="w-full border border-dashed border-[#D1D5DB] rounded-[10px] p-4 text-[13px] text-[#5A6070] hover:border-[#1A56DB] hover:text-[#1A56DB] hover:bg-[#EEF3FE] transition-all duration-[120ms]"
              >
                Crear encuesta personalizada
              </button>
            </div>
          ) : (
            /* Step 2: Confirm / edit */
            <div>
              <button
                onClick={resetCreate}
                className="flex items-center gap-1.5 text-[13px] text-[#5A6070] hover:text-[#111827] mb-5 transition-colors"
              >
                <ChevronLeft size={15} strokeWidth={2} />
                Volver a plantillas
              </button>

              {/* Name */}
              <div className="mb-4">
                <label className="block text-[13px] font-medium text-[#111827] mb-1.5">
                  Nombre de la encuesta
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ej: Encuesta mayo 2026"
                  className="w-full border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
                />
              </div>

              {/* Questions */}
              <div className="mb-5">
                <label className="block text-[13px] font-medium text-[#111827] mb-2">
                  Preguntas
                </label>
                <div className="flex flex-col gap-2">
                  {formQuestions.map((q, i) => (
                    <div
                      key={q.id}
                      className="flex items-center gap-3 border border-[#EAECF0] rounded-lg px-3 py-2.5 bg-white"
                    >
                      <span className="shrink-0 text-[11px] font-medium text-[#9EA3AE] bg-[#F4F5F7] px-2 py-0.5 rounded-full">
                        {q.type === 'rating' ? '1-5' : 'Texto'}
                      </span>
                      <input
                        type="text"
                        value={q.text}
                        onChange={e => updateQuestionText(q.id, e.target.value)}
                        placeholder="Texto de la pregunta..."
                        className="flex-1 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none bg-transparent"
                      />
                      {customMode && (
                        <button
                          onClick={() => removeQuestion(q.id)}
                          className="shrink-0 text-[11px] text-[#9EA3AE] hover:text-[#E02424] transition-colors"
                          aria-label={`Eliminar pregunta ${i + 1}`}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {customMode && formQuestions.length < 5 && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => addQuestion('rating')}
                      className="text-[12px] border border-[#EAECF0] rounded-lg px-3 py-1.5 text-[#5A6070] hover:bg-[#F4F5F7] transition-colors"
                    >
                      + Valoracion (1-5)
                    </button>
                    <button
                      onClick={() => addQuestion('text')}
                      className="text-[12px] border border-[#EAECF0] rounded-lg px-3 py-1.5 text-[#5A6070] hover:bg-[#F4F5F7] transition-colors"
                    >
                      + Pregunta de texto
                    </button>
                  </div>
                )}
              </div>

              {createError && (
                <p className="text-[13px] text-[#E02424] mb-3">{createError}</p>
              )}

              <Button
                onClick={handleCreate}
                loading={creating}
                disabled={creating || !formName.trim() || formQuestions.length === 0}
              >
                {creating ? 'Creando...' : 'Crear encuesta'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: RESULTS ─────────────────────────────────────────────────────── */}
      {tab === 'results' && selectedSurvey && (
        <div>
          {resultsLoading ? (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results ? (
            <div className="flex flex-col gap-5">
              {/* Alert banner */}
              {results.overall_avg > 0 && results.overall_avg < selectedSurvey.alert_threshold && (
                <div className="flex items-center gap-3 bg-[#FDE8E8] border border-[#E02424] rounded-[10px] px-4 py-3">
                  <AlertTriangle size={16} strokeWidth={2} className="text-[#E02424] shrink-0" />
                  <p className="text-[13px] text-[#E02424] font-medium">
                    La nota media ({results.overall_avg.toFixed(1)}/5) esta por debajo del umbral de alerta ({selectedSurvey.alert_threshold}/5). Revisa los comentarios.
                  </p>
                </div>
              )}

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Enviadas', value: results.total_sent },
                  { label: 'Completadas', value: results.total_completed },
                  { label: 'Tasa respuesta', value: `${results.completion_rate}%` },
                  {
                    label: 'Nota media',
                    value: results.overall_avg > 0 ? results.overall_avg.toFixed(1) : '—',
                    color: results.overall_avg > 0 ? scoreColor(results.overall_avg) : undefined,
                    bg: results.overall_avg > 0 ? scoreBg(results.overall_avg) : undefined,
                  },
                ].map(({ label, value, color, bg }) => (
                  <Card key={label} padding="sm">
                    <p className="text-[11px] text-[#9EA3AE] mb-1">{label}</p>
                    <p
                      className="text-[26px] font-bold leading-none"
                      style={{ color: color ?? '#111827' }}
                    >
                      {value}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <p className="text-[13px] font-semibold text-[#111827] mb-4">Distribucion de puntuaciones</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={[1, 2, 3, 4, 5].map(n => ({
                        score: String(n),
                        count: results.score_distribution[n] ?? 0,
                      }))}
                      margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" />
                      <XAxis dataKey="score" tick={{ fontSize: 11, fill: '#9EA3AE' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9EA3AE' }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ border: '1px solid #EAECF0', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="count" name="Clientes" fill="#1A56DB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <p className="text-[13px] font-semibold text-[#111827] mb-4">Evolucion de la nota media</p>
                  {results.daily_scores.length > 0 ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart
                        data={results.daily_scores}
                        margin={{ top: 0, right: 0, left: -24, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: '#9EA3AE' }}
                          tickFormatter={d => d.slice(5)}
                        />
                        <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: '#9EA3AE' }} />
                        <Tooltip
                          contentStyle={{ border: '1px solid #EAECF0', borderRadius: 8, fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg_score"
                          name="Nota media"
                          stroke="#1A56DB"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#1A56DB' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[160px] flex items-center justify-center text-[13px] text-[#9EA3AE]">
                      Sin datos suficientes
                    </div>
                  )}
                </Card>
              </div>

              {/* Question averages */}
              {results.question_averages.length > 0 && (
                <Card>
                  <p className="text-[13px] font-semibold text-[#111827] mb-4">Nota por pregunta</p>
                  <div className="flex flex-col gap-4">
                    {results.question_averages.map(q => (
                      <div key={q.question_id}>
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[13px] text-[#5A6070] flex-1 pr-4 leading-snug">{q.question_text}</p>
                          <span className="text-[13px] font-semibold shrink-0" style={{ color: scoreColor(q.avg_score) }}>
                            {q.avg_score.toFixed(1)}/5
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#F4F5F7] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(q.avg_score / 5) * 100}%`, backgroundColor: scoreColor(q.avg_score) }}
                          />
                        </div>
                        <p className="text-[11px] text-[#9EA3AE] mt-1">{q.response_count} respuestas</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Insights IA */}
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={15} strokeWidth={2} className="text-[#1A56DB]" />
                    <p className="text-[13px] font-semibold text-[#111827]">Insights automaticos</p>
                  </div>
                  {!insights && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={loadInsights}
                      loading={insightsLoading}
                      disabled={insightsLoading}
                    >
                      {insightsLoading ? 'Analizando...' : 'Analizar con IA'}
                    </Button>
                  )}
                </div>

                {insightsError && (
                  <p className="text-[13px] text-[#E02424]">{insightsError}</p>
                )}

                {!insights && !insightsLoading && !insightsError && (
                  <p className="text-[13px] text-[#9EA3AE]">
                    Analiza las respuestas de texto para detectar temas recurrentes y puntos de mejora.
                  </p>
                )}

                {insights && (
                  <div className="flex flex-col gap-4">
                    {/* Sentiment + summary */}
                    <div
                      className="rounded-lg px-4 py-3"
                      style={{
                        backgroundColor:
                          insights.sentiment === 'positive' ? '#DEF7EC'
                          : insights.sentiment === 'negative' ? '#FDE8E8'
                          : '#FFF8E6',
                      }}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1"
                        style={{
                          color:
                            insights.sentiment === 'positive' ? '#0E9F6E'
                            : insights.sentiment === 'negative' ? '#E02424'
                            : '#D97706',
                        }}
                      >
                        {insights.sentiment === 'positive' ? 'Feedback positivo'
                          : insights.sentiment === 'negative' ? 'Requiere atencion'
                          : 'Feedback mixto'}
                      </p>
                      <p className="text-[13px] text-[#111827] leading-snug">{insights.summary}</p>
                    </div>

                    {/* Keywords */}
                    {insights.keywords.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-[#9EA3AE] uppercase tracking-wide mb-2">
                          Palabras mas mencionadas
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {insights.keywords.map(kw => (
                            <span
                              key={kw.word}
                              className="text-[12px] font-medium text-[#1A56DB] bg-[#EEF3FE] px-3 py-1 rounded-full"
                            >
                              {kw.word}
                              {kw.count > 1 && (
                                <span className="ml-1 text-[#9EA3AE] font-normal">x{kw.count}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top issues */}
                    {insights.top_issues.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-[#9EA3AE] uppercase tracking-wide mb-2">
                          Areas de mejora
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {insights.top_issues.map((issue, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#E02424] shrink-0" />
                              <p className="text-[13px] text-[#5A6070]">{issue}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-[#9EA3AE]">
                      Basado en {insights.text_count} respuestas de texto de {insights.response_count} encuestas completadas
                    </p>
                  </div>
                )}
              </Card>

              {/* Text responses */}
              {results.recent_text_responses.length > 0 && (
                <Card>
                  <p className="text-[13px] font-semibold text-[#111827] mb-4">Ultimos comentarios</p>
                  <div className="flex flex-col gap-2">
                    {results.recent_text_responses.map((r, i) => (
                      <div key={i} className="bg-[#F4F5F7] rounded-lg px-4 py-3">
                        <p className="text-[13px] text-[#5A6070] leading-snug">{r.text}</p>
                        <p className="text-[11px] text-[#9EA3AE] mt-1">{formatDate(r.completed_at)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ── SHARE MODAL ───────────────────────────────────────────────────────── */}
      {shareModalSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShareModalSurvey(null)}
          />
          <div className="relative bg-white rounded-[12px] w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAECF0]">
              <p className="font-semibold text-[#111827] text-[15px]">Compartir encuesta</p>
              <p className="text-[12px] text-[#9EA3AE] mt-0.5">{shareModalSurvey.name}</p>
            </div>

            <div className="px-5 py-5 flex flex-col gap-5">
              {/* QR */}
              {shareQrUrl ? (
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={shareQrUrl}
                    alt="QR de la encuesta"
                    className="w-[180px] h-[180px] rounded-lg border border-[#EAECF0]"
                  />
                </div>
              ) : (
                <div className="flex justify-center">
                  <div className="w-[180px] h-[180px] rounded-lg border border-[#EAECF0] bg-[#F4F5F7] flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              )}

              {/* Link */}
              <div>
                <p className="text-[11px] font-semibold text-[#9EA3AE] uppercase tracking-wide mb-2">
                  Enlace directo
                </p>
                <div className="flex items-center gap-2 border border-[#EAECF0] rounded-lg px-3 py-2 bg-[#F4F5F7]">
                  <p className="flex-1 text-[12px] text-[#5A6070] truncate">{shareLink}</p>
                  <button
                    onClick={copyShareLink}
                    className="shrink-0 text-[#1A56DB] hover:text-[#1648C0] transition-colors"
                    aria-label="Copiar enlace"
                  >
                    {shareCopied ? (
                      <Check size={15} strokeWidth={2} className="text-[#0E9F6E]" />
                    ) : (
                      <Copy size={15} strokeWidth={2} />
                    )}
                  </button>
                </div>
                {shareCopied && (
                  <p className="text-[11px] text-[#0E9F6E] mt-1">Enlace copiado</p>
                )}
              </div>

              {/* WhatsApp */}
              <button
                onClick={openWhatsApp}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[#25D366] text-[#25D366] text-[13px] font-medium hover:bg-[#F0FFF4] transition-colors"
              >
                <MessageCircle size={15} strokeWidth={2} />
                Enviar por WhatsApp
              </button>
            </div>

            <div className="px-5 pb-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => setShareModalSurvey(null)}
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND MODAL ────────────────────────────────────────────────────────── */}
      {sendModalSurvey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => { setSendModalSurvey(null); setSendResult(null) }}
          />
          <div className="relative bg-white rounded-[12px] w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[#EAECF0]">
              <p className="font-semibold text-[#111827] text-[15px]">Enviar a clientes</p>
              <p className="text-[12px] text-[#9EA3AE] mt-0.5">{sendModalSurvey.name}</p>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1">
              {sendResult ? (
                <div className="text-center py-8">
                  <p className="text-[15px] font-semibold text-[#111827] mb-1">Encuesta enviada</p>
                  <p className="text-[13px] text-[#5A6070]">
                    {sendResult.sent} enviadas correctamente
                    {sendResult.failed > 0 && `, ${sendResult.failed} con error`}
                  </p>
                </div>
              ) : (
                <>
                  {/* Channel selector */}
                  <div className="mb-4">
                    <label className="block text-[13px] font-medium text-[#111827] mb-2">Canal</label>
                    <div className="flex gap-2">
                      {(['email', 'whatsapp'] as const).map(ch => (
                        <button
                          key={ch}
                          onClick={() => { setSendChannel(ch); setSelectedCustomers(new Set()) }}
                          className={[
                            'flex-1 py-2 rounded-lg border text-[13px] font-medium transition-colors duration-[120ms]',
                            sendChannel === ch
                              ? 'border-[#1A56DB] bg-[#EEF3FE] text-[#1A56DB]'
                              : 'border-[#EAECF0] text-[#5A6070] hover:bg-[#F4F5F7]',
                          ].join(' ')}
                        >
                          {ch === 'email' ? 'Email' : 'WhatsApp'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customer list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[13px] font-medium text-[#111827]">
                        Clientes ({filteredCustomers.length})
                      </label>
                      <button
                        onClick={() => {
                          setSelectedCustomers(
                            selectedCustomers.size === filteredCustomers.length
                              ? new Set()
                              : new Set(filteredCustomers.map(c => c.id))
                          )
                        }}
                        className="text-[12px] text-[#1A56DB] hover:underline"
                      >
                        {selectedCustomers.size === filteredCustomers.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>

                    {customersLoading ? (
                      <div className="flex justify-center py-8">
                        <div className="w-5 h-5 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <p className="text-[13px] text-[#9EA3AE] py-4 text-center">
                        No hay clientes con {sendChannel === 'email' ? 'email' : 'telefono'} registrado
                      </p>
                    ) : (
                      <div className="border border-[#EAECF0] rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                        {filteredCustomers.map(c => (
                          <label
                            key={c.id}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#F4F5F7] border-b border-[#F4F5F7] last:border-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCustomers.has(c.id)}
                              onChange={() => {
                                setSelectedCustomers(prev => {
                                  const next = new Set(prev)
                                  next.has(c.id) ? next.delete(c.id) : next.add(c.id)
                                  return next
                                })
                              }}
                              className="rounded"
                            />
                            <div>
                              <p className="text-[13px] text-[#111827]">{c.name}</p>
                              <p className="text-[11px] text-[#9EA3AE]">
                                {sendChannel === 'email' ? c.email : c.phone}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}

                    {selectedCustomers.size > 0 && (
                      <p className="text-[12px] text-[#5A6070] mt-2">
                        Vas a enviar a {selectedCustomers.size} cliente{selectedCustomers.size !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[#EAECF0] flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => { setSendModalSurvey(null); setSendResult(null) }}
              >
                {sendResult ? 'Cerrar' : 'Cancelar'}
              </Button>
              {!sendResult && (
                <Button
                  onClick={handleSend}
                  loading={sending}
                  disabled={selectedCustomers.size === 0 || sending}
                >
                  {sending ? 'Enviando...' : 'Enviar encuesta'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

