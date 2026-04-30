'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import {
  Share2, Copy, Check, MessageCircle, ChevronLeft,
  TrendingUp, AlertTriangle, Send, Users,
  ClipboardList, Star, Zap, Package, Clock,
  Edit2, Trash2, X, Plus,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import QRCode from 'qrcode'

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

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
  id: string; name: string; email: string | null; phone: string | null
}

interface SurveyResults {
  total_sent: number; total_completed: number; completion_rate: number; overall_avg: number
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
  response_count: number; text_count: number
}

interface Template { label: string; description: string; questions: Omit<Question, 'id'>[] }
type Tab = 'list' | 'create' | 'results'

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  { label: 'Experiencia cliente', description: 'Valora la experiencia general y mide la fidelidad', questions: [
    { type:'rating', text:'Valora tu experiencia general (1-5)', required:true },
    { type:'text',   text:'Que mejorarías de tu visita?',        required:false },
    { type:'rating', text:'Volverías con nosotros?',             required:true },
  ]},
  { label: 'Calidad del servicio', description: 'Mide la atencion del personal y la rapidez', questions: [
    { type:'rating', text:'Como valoras la atencion recibida?',    required:true },
    { type:'rating', text:'La rapidez del servicio fue adecuada?', required:true },
    { type:'text',   text:'Algun comentario sobre nuestro equipo', required:false },
  ]},
  { label: 'Valoracion de producto', description: 'Evalua la calidad del producto y la recompra', questions: [
    { type:'rating', text:'Como valoras la calidad del producto?',        required:true },
    { type:'rating', text:'Recomendarías nuestros productos a un amigo?', required:true },
    { type:'text',   text:'Que producto te gustaría que aniadieramos?',   required:false },
  ]},
  { label: 'Post-visita rapida', description: 'Solo 2 preguntas para maxima tasa de respuesta', questions: [
    { type:'rating', text:'Del 1 al 5, como ha sido tu experiencia hoy?', required:true },
    { type:'text',   text:'En una frase, que destacarías de tu visita?',  required:false },
  ]},
]

type TemplateIconKey = 'Experiencia cliente' | 'Calidad del servicio' | 'Valoracion de producto' | 'Post-visita rapida'

const TEMPLATE_ICONS: Record<TemplateIconKey, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  'Experiencia cliente':    Star,
  'Calidad del servicio':   Zap,
  'Valoracion de producto': Package,
  'Post-visita rapida':     Clock,
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function newQ(type: 'rating' | 'text'): Question {
  return { id: crypto.randomUUID(), type, text: '', required: type === 'rating' }
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' })
}
function scoreColor(n: number) { return n >= 4 ? '#0E9F6E' : n >= 3 ? '#D97706' : '#DC2626' }
function scoreBg(n: number)    { return n >= 4 ? '#DEF7EC' : n >= 3 ? '#FFF8E6' : '#FEF2F2' }

// ─────────────────────────────────────────────────────────────────
// FocusInput
// ─────────────────────────────────────────────────────────────────

function FocusInput({ label, hint, textarea, rows = 2, ...props }: {
  label?: string; hint?: string; textarea?: boolean; rows?: number
  [k: string]: unknown
}) {
  const [focused, setFocused] = useState(false)
  const style: React.CSSProperties = {
    width: '100%', borderRadius: 8, padding: '9px 12px', fontSize: 13,
    color: '#111827', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
    border: `1.5px solid ${focused ? '#1A56DB' : '#E5E7EB'}`,
    boxShadow: focused ? '0 0 0 3px rgba(26,86,219,0.08)' : 'none',
    transition: 'all 120ms', fontFamily: 'inherit',
    ...(textarea ? { resize: 'none' as const } : {}),
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      {label && (
        <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>
          {label}{hint && <span style={{ fontWeight:400, color:'#9CA3AF' }}> {hint}</span>}
        </label>
      )}
      {textarea
        ? <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} rows={rows} style={style} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        : <input   {...(props as React.InputHTMLAttributes<HTMLInputElement>)}                style={style} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      }
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, bg }: { label: string; value: string | number; color?: string; bg?: string }) {
  return (
    <div style={{ background: bg ?? '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 12, padding: '16px 18px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <p style={{ fontSize:11, color:'#9CA3AF', marginBottom:8 }}>{label}</p>
      <p style={{ fontSize:26, fontWeight:700, letterSpacing:'-0.02em', color: color ?? '#111827', lineHeight:1 }}>{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SurveyCard
// ─────────────────────────────────────────────────────────────────

function SurveyCard({ survey, onResults, onShare, onSend, onToggle, onEdit, onDelete }: {
  survey: Survey; onResults: () => void; onShare: () => void; onSend: () => void; onToggle: () => void; onEdit: () => void; onDelete: () => void
}) {
  const avg = survey.metrics.avg_score
  const belowThreshold = avg !== null && avg < survey.alert_threshold && survey.metrics.completed > 0
  const accentColor = belowThreshold ? '#DC2626' : survey.is_active ? '#1A56DB' : '#E5E7EB'
  const rate = survey.metrics.sent > 0 ? Math.round((survey.metrics.completed / survey.metrics.sent) * 100) : 0

  return (
    <div style={{ background:'#FFFFFF', border:`1px solid ${belowThreshold ? '#FECACA' : '#E5E7EB'}`, borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ height:3, background:accentColor }} />
      <div style={{ padding:'16px 18px', display:'flex', alignItems:'flex-start', gap:16 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <p style={{ fontSize:14, fontWeight:600, color:'#111827' }}>{survey.name}</p>
            <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background: survey.is_active ? '#DEF7EC' : '#F4F5F7', color: survey.is_active ? '#0E9F6E' : '#9CA3AF', border:`1px solid ${survey.is_active ? '#A7F3D0' : '#E5E7EB'}` }}>
              <span style={{ marginRight:4, fontSize:8 }}>●</span>
              {survey.is_active ? 'Activa' : 'Inactiva'}
            </span>
            {belowThreshold && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100, background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA' }}>
                <AlertTriangle size={9} strokeWidth={2} /> Nota baja
              </span>
            )}
          </div>
          <p style={{ fontSize:12, color:'#9CA3AF', marginBottom:12 }}>
            {new Date(survey.created_at).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · {survey.questions.length} preguntas
          </p>
          <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
            {[{ icon:<Send size={12} strokeWidth={2}/>, label:'enviadas', value:survey.metrics.sent }, { icon:<Users size={12} strokeWidth={2}/>, label:'respuestas', value:survey.metrics.completed }].map(m => (
              <div key={m.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ color:'#9CA3AF' }}>{m.icon}</span>
                <span style={{ fontSize:13 }}>
                  <span style={{ fontWeight:700, color:'#111827' }}>{m.value}</span>
                  <span style={{ color:'#9CA3AF', marginLeft:4 }}>{m.label}</span>
                </span>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:16, fontWeight:700, color:'#111827' }}>{rate}%</span>
              <span style={{ fontSize:11, color:'#9CA3AF' }}>tasa</span>
            </div>
            {avg !== null && (
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:16, fontWeight:700, color:scoreColor(avg) }}>{avg.toFixed(1)}</span>
                <span style={{ fontSize:11, color:'#9CA3AF' }}>/5 media</span>
                <div style={{ width:48, height:5, borderRadius:100, background:'#E5E7EB', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${(avg/5)*100}%`, background:scoreColor(avg), borderRadius:100 }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
          <button onClick={onResults} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#1A56DB', color:'white', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Ver resultados
          </button>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={onShare} style={{ flex:1, padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#FFFFFF', color:'#374151', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <Share2 size={12} strokeWidth={2} /> Compartir
            </button>
            <button onClick={onSend} style={{ flex:1, padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#FFFFFF', color:'#374151', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
              Enviar
            </button>
          </div>
          <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
            <button onClick={onEdit} title="Editar"
              style={{ width:30, height:30, borderRadius:7, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#6B7280', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#1A56DB';(e.currentTarget as HTMLButtonElement).style.color='#1A56DB'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#E5E7EB';(e.currentTarget as HTMLButtonElement).style.color='#6B7280'}}>
              <Edit2 size={13} strokeWidth={2}/>
            </button>
            <button onClick={onDelete} title="Eliminar"
              style={{ width:30, height:30, borderRadius:7, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#9CA3AF', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#FECACA';(e.currentTarget as HTMLButtonElement).style.color='#DC2626';(e.currentTarget as HTMLButtonElement).style.background='#FEF2F2'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#E5E7EB';(e.currentTarget as HTMLButtonElement).style.color='#9CA3AF';(e.currentTarget as HTMLButtonElement).style.background='#F9FAFB'}}>
              <Trash2 size={13} strokeWidth={2}/>
            </button>
          </div>
          <button onClick={onToggle} style={{ fontSize:11, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', textAlign:'right', fontFamily:'inherit' }}>
            {survey.is_active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function SurveysPage() {
  const isMobile = useIsMobile()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('list')
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [formName, setFormName] = useState('')
  const [formQuestions, setFormQuestions] = useState<Question[]>([])
  const [customMode, setCustomMode] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null)
  const [results, setResults] = useState<SurveyResults | null>(null)
  const [resultsLoading, setResultsLoading] = useState(false)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState('')

  const [shareModalSurvey, setShareModalSurvey] = useState<Survey | null>(null)
  const [shareLink, setShareLink] = useState('')
  const [shareCopied, setShareCopied] = useState(false)
  const [shareQrUrl, setShareQrUrl] = useState('')
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [sendModalSurvey, setSendModalSurvey] = useState<Survey | null>(null)
  const [sendChannel, setSendChannel] = useState<'email' | 'whatsapp'>('email')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [customersLoading, setCustomersLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null)

  // Edit modal
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [editName, setEditName] = useState('')
  const [editQuestions, setEditQuestions] = useState<Question[]>([])
  const [editThreshold, setEditThreshold] = useState(3)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await createClient().from('businesses').select('id').eq('owner_id', user.id).single()
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

  useEffect(() => { if (businessId) loadSurveys() }, [businessId, loadSurveys])

  useEffect(() => {
    if (!sendModalSurvey || !businessId) return
    setCustomersLoading(true); setSelectedCustomers(new Set()); setSendResult(null)
    createClient().from('customers').select('id, name, email, phone').eq('business_id', businessId).order('name')
      .then(({ data }) => { setCustomers(data ?? []); setCustomersLoading(false) })
  }, [sendModalSurvey, businessId])

  useEffect(() => {
    if (!shareModalSurvey) { setShareQrUrl(''); setShareLink(''); return }
    const link = `${window.location.origin}/encuesta/open/${shareModalSurvey.id}`
    setShareLink(link)
    QRCode.toDataURL(link, { width:180, margin:2, color:{ dark:'#111827', light:'#FFFFFF' } })
      .then(setShareQrUrl).catch(() => setShareQrUrl(''))
  }, [shareModalSurvey])

  const filteredCustomers = customers.filter(c => sendChannel === 'email' ? !!c.email : !!c.phone)

  function pickTemplate(tpl: Template) {
    setSelectedTemplate(tpl); setFormName(tpl.label)
    setFormQuestions(tpl.questions.map(q => ({ ...q, id: crypto.randomUUID() })))
    setCustomMode(false); setCreateError('')
  }

  function resetCreate() {
    setSelectedTemplate(null); setFormName(''); setFormQuestions([]); setCustomMode(false); setCreateError('')
  }

  async function handleCreate() {
    if (!businessId || !formName.trim() || formQuestions.length === 0) return
    setCreateError(''); setCreating(true)
    const res = await fetch('/api/surveys/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: businessId, name: formName.trim(), questions: formQuestions, alert_threshold: 3.0 }),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) { setCreateError(data.error ?? 'Error al crear la encuesta'); return }
    resetCreate(); await loadSurveys(); setTab('list')
  }

  async function toggleActive(survey: Survey) {
    await fetch('/api/surveys/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ survey_id: survey.id, is_active: !survey.is_active }),
    })
    setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, is_active: !s.is_active } : s))
  }

  async function openResults(survey: Survey) {
    setSelectedSurvey(survey); setInsights(null); setInsightsError('')
    setTab('results'); setResultsLoading(true)
    const res = await fetch(`/api/surveys/results?survey_id=${survey.id}&business_id=${businessId}`)
    setResults(await res.json()); setResultsLoading(false)
  }

  async function loadInsights() {
    if (!selectedSurvey || !businessId) return
    setInsightsLoading(true); setInsightsError('')
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

  function copyShareLink() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink).then(() => {
      setShareCopied(true)
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setShareCopied(false), 2000)
    })
  }

  async function handleSend() {
    if (!sendModalSurvey || !businessId || selectedCustomers.size === 0 || sending) return
    setSending(true)
    const res = await fetch('/api/surveys/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ survey_id: sendModalSurvey.id, business_id: businessId, customer_ids: Array.from(selectedCustomers), channel: sendChannel }),
    })
    const data = await res.json()
    setSending(false); setSendResult({ sent: data.sent ?? 0, failed: data.failed ?? 0 }); await loadSurveys()
  }

  function openEdit(survey: Survey) {
    setEditingSurvey(survey)
    setEditName(survey.name)
    setEditQuestions(survey.questions.map(q => ({ ...q })))
    setEditThreshold(survey.alert_threshold)
    setEditError('')
  }

  async function handleUpdate() {
    if (!editingSurvey || !editName.trim() || editQuestions.length === 0) return
    setEditSaving(true); setEditError('')
    const { error } = await createClient()
      .from('surveys')
      .update({ name: editName.trim(), questions: editQuestions, alert_threshold: editThreshold })
      .eq('id', editingSurvey.id)
    setEditSaving(false)
    if (error) { setEditError(error.message); return }
    setSurveys(prev => prev.map(s => s.id === editingSurvey.id
      ? { ...s, name: editName.trim(), questions: editQuestions, alert_threshold: editThreshold }
      : s))
    setEditingSurvey(null)
  }

  async function handleDelete(surveyId: string) {
    setDeletingId(surveyId)
    await createClient().from('surveys').delete().eq('id', surveyId)
    setSurveys(prev => prev.filter(s => s.id !== surveyId))
    setDeletingId(null)
  }

  const tabList = [
    { key: 'list',   label: 'Mis encuestas',  badge: surveys.length > 0 ? surveys.length : null },
    { key: 'create', label: 'Nueva encuesta', badge: null },
    ...(tab === 'results' && selectedSurvey ? [{ key: 'results', label: selectedSurvey.name, badge: null }] : []),
  ]

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px', display:'flex', flexDirection:'column', gap:0, maxWidth:1100 }}>

      {/* Page header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'#111827', letterSpacing:'-0.02em' }}>Encuestas de satisfaccion</h1>
        <p style={{ fontSize:13, color:'#9CA3AF', marginTop:3 }}>Recoge feedback y toma decisiones</p>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', borderBottom:'1px solid #E5E7EB', marginBottom:20 }}>
        {tabList.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as Tab)} style={{
            padding:'11px 18px', fontSize:13, fontWeight: tab===t.key ? 600 : 400,
            color: tab===t.key ? '#1A56DB' : '#6B7280', border:'none',
            borderBottom: tab===t.key ? '2px solid #1A56DB' : '2px solid transparent',
            marginBottom:-1, background:'none', cursor:'pointer', transition:'all 120ms', fontFamily:'inherit',
          }}>
            {t.label}
            {t.badge !== null && (
              <span style={{ marginLeft:6, fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:100, background: tab===t.key ? '#1A56DB' : '#E5E7EB', color: tab===t.key ? 'white' : '#6B7280' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── LIST ── */}
      {tab === 'list' && (
        loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'64px 0' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid #1A56DB', borderTopColor:'transparent', animation:'spin 0.7s linear infinite' }} />
          </div>
        ) : surveys.length === 0 ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'64px 24px', textAlign:'center' }}>
            <ClipboardList size={36} color="#D1D5DB" strokeWidth={1.5} />
            <div>
              <p style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:6 }}>Todavia no tienes encuestas</p>
              <p style={{ fontSize:13, color:'#9CA3AF', maxWidth:300, lineHeight:1.7, margin:'0 auto' }}>
                Crea tu primera encuesta y empieza a recoger feedback de tus clientes automaticamente.
              </p>
            </div>
            <button onClick={() => setTab('create')} style={{ padding:'10px 24px', borderRadius:9, border:'none', background:'#1A56DB', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Crear primera encuesta
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {surveys.map(s => (
              <SurveyCard key={s.id} survey={s}
                onResults={() => openResults(s)} onShare={() => setShareModalSurvey(s)}
                onSend={() => setSendModalSurvey(s)} onToggle={() => toggleActive(s)}
                onEdit={() => openEdit(s)}
                onDelete={() => { if (confirm(`Eliminar "${s.name}"? Esta accion no se puede deshacer.`)) handleDelete(s.id) }} />
            ))}
          </div>
        )
      )}

      {/* ── CREATE ── */}
      {tab === 'create' && (
        !selectedTemplate ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:640 }}>
            <div>
              <p style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:4 }}>Elige una plantilla</p>
              <p style={{ fontSize:13, color:'#9CA3AF' }}>Empieza en segundos con preguntas predefinidas</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {TEMPLATES.map(tpl => {
                const IconComp = TEMPLATE_ICONS[tpl.label as TemplateIconKey]
                return (
                  <button key={tpl.label} onClick={() => pickTemplate(tpl)} style={{
                    textAlign:'left', padding:'16px', borderRadius:12,
                    border:'1.5px solid #E5E7EB', background:'#FFFFFF', cursor:'pointer',
                    transition:'all 140ms ease', fontFamily:'inherit',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='#1A56DB'; e.currentTarget.style.background='#EEF3FE' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.background='#FFFFFF' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div style={{ width:32, height:32, borderRadius:8, background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {IconComp && <IconComp size={15} color="#6B7280" strokeWidth={2} />}
                      </div>
                      <span style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{tpl.label}</span>
                    </div>
                    <p style={{ fontSize:11, color:'#9CA3AF', marginBottom:10, lineHeight:1.5 }}>{tpl.description}</p>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {tpl.questions.map((q, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                          <span style={{ width:4, height:4, borderRadius:'50%', background:'#D1D5DB', marginTop:5, flexShrink:0 }} />
                          <span style={{ fontSize:11, color:'#9CA3AF', lineHeight:1.4 }}>{q.text}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>
            <button onClick={() => {
              setSelectedTemplate({ label:'Encuesta personalizada', description:'', questions:[] })
              setFormName(''); setFormQuestions([newQ('rating')]); setCustomMode(true)
            }} style={{ padding:'12px', borderRadius:10, border:'1.5px dashed #D1D5DB', background:'transparent', color:'#6B7280', fontSize:13, fontWeight:500, cursor:'pointer', transition:'all 140ms', fontFamily:'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#1A56DB'; e.currentTarget.style.color='#1A56DB'; e.currentTarget.style.background='#EEF3FE' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#D1D5DB'; e.currentTarget.style.color='#6B7280'; e.currentTarget.style.background='transparent' }}>
              + Crear encuesta personalizada
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:18, maxWidth:560 }}>
            <button onClick={resetCreate} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:13, padding:0, width:'fit-content', fontFamily:'inherit' }}
              onMouseEnter={e => (e.currentTarget.style.color='#111827')}
              onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}>
              <ChevronLeft size={15} strokeWidth={2} /> Volver a plantillas
            </button>

            <FocusInput label="Nombre de la encuesta" placeholder="Ej: Encuesta mayo 2026"
              value={formName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)} required />

            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Preguntas</label>
              {formQuestions.map(q => (
                <div key={q.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#F8F8F9', borderRadius:9, border:'1px solid #E5E7EB' }}>
                  <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100, background: q.type==='rating' ? '#EEF3FE' : '#F3F4F6', color: q.type==='rating' ? '#1A56DB' : '#6B7280', flexShrink:0 }}>
                    {q.type === 'rating' ? '1-5' : 'Texto'}
                  </span>
                  <input value={q.text} onChange={e => setFormQuestions(prev => prev.map(x => x.id===q.id ? {...x, text:e.target.value} : x))}
                    placeholder="Texto de la pregunta..."
                    style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'#111827', fontFamily:'inherit' }} />
                  {(customMode || formQuestions.length > 1) && (
                    <button onClick={() => setFormQuestions(prev => prev.filter(x => x.id !== q.id))}
                      style={{ fontSize:11, color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}
                      onMouseEnter={e => (e.currentTarget.style.color='#DC2626')}
                      onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}>
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
              {formQuestions.length < 5 && (
                <div style={{ display:'flex', gap:8 }}>
                  {[{type:'rating' as const, label:'+ Valoracion 1-5'}, {type:'text' as const, label:'+ Pregunta de texto'}].map(b => (
                    <button key={b.type} onClick={() => setFormQuestions(prev => [...prev, newQ(b.type)])}
                      style={{ padding:'7px 13px', borderRadius:8, border:'1px solid #E5E7EB', background:'#FFFFFF', color:'#6B7280', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all 120ms', fontFamily:'inherit' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor='#1A56DB'; e.currentTarget.style.color='#1A56DB'; e.currentTarget.style.background='#EEF3FE' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.color='#6B7280'; e.currentTarget.style.background='#FFFFFF' }}>
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {createError && <p style={{ fontSize:13, color:'#DC2626' }}>{createError}</p>}

            <button onClick={handleCreate} disabled={creating || !formName.trim() || formQuestions.length === 0}
              style={{ padding:'10px 24px', borderRadius:9, border:'none', background: (creating || !formName.trim() || formQuestions.length === 0) ? '#9EB8F4' : '#1A56DB', color:'white', fontSize:13, fontWeight:600, cursor: creating ? 'default' : 'pointer', display:'flex', alignItems:'center', gap:8, alignSelf:'flex-start', fontFamily:'inherit' }}>
              {creating ? (
                <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Creando...</>
              ) : 'Crear encuesta'}
            </button>
          </div>
        )
      )}

      {/* ── RESULTS ── */}
      {tab === 'results' && selectedSurvey && (
        resultsLoading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'64px 0' }}>
            <div style={{ width:24, height:24, borderRadius:'50%', border:'2px solid #1A56DB', borderTopColor:'transparent', animation:'spin 0.7s linear infinite' }} />
          </div>
        ) : results ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <button onClick={() => setTab('list')} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', fontSize:13, padding:0, width:'fit-content', fontFamily:'inherit' }}
              onMouseEnter={e=>(e.currentTarget.style.color='#111827')} onMouseLeave={e=>(e.currentTarget.style.color='#9CA3AF')}>
              <ChevronLeft size={15} strokeWidth={2}/> Volver a encuestas
            </button>

            {results.overall_avg > 0 && results.overall_avg < selectedSurvey.alert_threshold && (
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:10, background:'#FEF2F2', border:'1px solid #FECACA' }}>
                <AlertTriangle size={16} strokeWidth={2} style={{ color:'#DC2626', flexShrink:0 }} />
                <p style={{ fontSize:13, color:'#DC2626', fontWeight:500 }}>
                  La nota media ({results.overall_avg.toFixed(1)}/5) esta por debajo del umbral de alerta ({selectedSurvey.alert_threshold}/5). Revisa los comentarios.
                </p>
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              <StatCard label="Enviadas"       value={results.total_sent} />
              <StatCard label="Completadas"    value={results.total_completed} />
              <StatCard label="Tasa respuesta" value={`${results.completion_rate}%`} />
              {results.overall_avg > 0 && (
                <StatCard label="Nota media" value={`${results.overall_avg.toFixed(1)}/5`} color={scoreColor(results.overall_avg)} bg={scoreBg(results.overall_avg)} />
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              <div style={{ background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Distribucion de puntuaciones</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={[1,2,3,4,5].map(n=>({ score:String(n), count:results.score_distribution[n]??0 }))} margin={{top:0,right:0,left:-24,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7"/>
                    <XAxis dataKey="score" tick={{fontSize:11,fill:'#9CA3AF'}}/>
                    <YAxis tick={{fontSize:11,fill:'#9CA3AF'}} allowDecimals={false}/>
                    <Tooltip contentStyle={{border:'1px solid #E5E7EB',borderRadius:8,fontSize:12}}/>
                    <Bar dataKey="count" name="Clientes" fill="#1A56DB" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Evolucion de la nota media</p>
                {results.daily_scores.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={results.daily_scores} margin={{top:0,right:0,left:-24,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7"/>
                      <XAxis dataKey="date" tick={{fontSize:10,fill:'#9CA3AF'}} tickFormatter={d=>d.slice(5)}/>
                      <YAxis domain={[1,5]} tick={{fontSize:11,fill:'#9CA3AF'}}/>
                      <Tooltip contentStyle={{border:'1px solid #E5E7EB',borderRadius:8,fontSize:12}}/>
                      <Line type="monotone" dataKey="avg_score" name="Nota media" stroke="#1A56DB" strokeWidth={2} dot={{r:3,fill:'#1A56DB'}}/>
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height:160, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#9CA3AF' }}>Sin datos suficientes</div>
                )}
              </div>
            </div>

            {results.question_averages.length > 0 && (
              <div style={{ background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:16 }}>Nota por pregunta</p>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {results.question_averages.map(q => (
                    <div key={q.question_id}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <p style={{ fontSize:13, color:'#6B7280', flex:1, paddingRight:16, lineHeight:1.4 }}>{q.question_text}</p>
                        <span style={{ fontSize:13, fontWeight:600, color:scoreColor(q.avg_score), flexShrink:0 }}>{q.avg_score.toFixed(1)}/5</span>
                      </div>
                      <div style={{ height:5, borderRadius:100, background:'#E5E7EB', overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${(q.avg_score/5)*100}%`, background:scoreColor(q.avg_score), borderRadius:100, transition:'width 400ms' }} />
                      </div>
                      <p style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>{q.response_count} respuestas</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights */}
            <div style={{ background:'#111827', border:'1px solid #1F2937', borderRadius:12, padding:'18px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'rgba(26,86,219,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <TrendingUp size={14} strokeWidth={2} style={{ color:'#93C5FD' }} />
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, color:'white' }}>Insights automaticos con IA</p>
                </div>
                {!insights && (
                  <button onClick={loadInsights} disabled={insightsLoading}
                    style={{ padding:'7px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'white', fontSize:12, fontWeight:600, cursor: insightsLoading ? 'default' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                    {insightsLoading
                      ? <><span style={{ width:12,height:12,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>Analizando...</>
                      : 'Analizar con IA'}
                  </button>
                )}
              </div>

              {insightsError && <p style={{ fontSize:13, color:'#FCA5A5' }}>{insightsError}</p>}

              {!insights && !insightsLoading && !insightsError && (
                <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.6 }}>Analiza las respuestas de texto para detectar temas recurrentes y puntos de mejora.</p>
              )}

              {insights && (
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div style={{ padding:'12px 14px', borderRadius:8, background: insights.sentiment==='positive' ? 'rgba(14,159,110,.12)' : insights.sentiment==='negative' ? 'rgba(220,38,38,.12)' : 'rgba(217,119,6,.12)', border:`1px solid ${insights.sentiment==='positive' ? 'rgba(14,159,110,.25)' : insights.sentiment==='negative' ? 'rgba(220,38,38,.25)' : 'rgba(217,119,6,.25)'}` }}>
                    <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color: insights.sentiment==='positive' ? '#34D399' : insights.sentiment==='negative' ? '#FCA5A5' : '#FCD34D', marginBottom:4 }}>
                      {insights.sentiment==='positive' ? 'Feedback positivo' : insights.sentiment==='negative' ? 'Requiere atencion' : 'Feedback mixto'}
                    </p>
                    <p style={{ fontSize:13, color:'#D1FAE5', lineHeight:1.6 }}>{insights.summary}</p>
                  </div>
                  {insights.keywords.length > 0 && (
                    <div>
                      <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6B7280', marginBottom:8 }}>Palabras mas mencionadas</p>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {insights.keywords.map(kw => (
                          <span key={kw.word} style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100, background:'rgba(26,86,219,.15)', color:'#93C5FD', border:'1px solid rgba(26,86,219,.25)' }}>
                            {kw.word}{kw.count > 1 && <span style={{ marginLeft:4, color:'#6B7280', fontWeight:400 }}>x{kw.count}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {insights.top_issues.length > 0 && (
                    <div>
                      <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#6B7280', marginBottom:8 }}>Areas de mejora</p>
                      {insights.top_issues.map((issue, i) => (
                        <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
                          <span style={{ width:4, height:4, borderRadius:'50%', background:'#FCA5A5', marginTop:5, flexShrink:0 }} />
                          <p style={{ fontSize:13, color:'#D1D5DB', lineHeight:1.5 }}>{issue}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p style={{ fontSize:11, color:'#6B7280' }}>Basado en {insights.text_count} respuestas de {insights.response_count} completadas</p>
                </div>
              )}
            </div>

            {results.recent_text_responses.length > 0 && (
              <div style={{ background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:12, padding:'18px 20px' }}>
                <p style={{ fontSize:13, fontWeight:600, color:'#111827', marginBottom:14 }}>Ultimos comentarios</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {results.recent_text_responses.map((r, i) => (
                    <div key={i} style={{ padding:'12px 14px', background:'#F8F8F9', borderRadius:9, border:'1px solid #E5E7EB' }}>
                      <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.6 }}>{r.text}</p>
                      <p style={{ fontSize:11, color:'#9CA3AF', marginTop:4 }}>{formatDate(r.completed_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null
      )}

      {/* ── EDIT MODAL ── */}
      {editingSurvey && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)' }} onClick={() => setEditingSurvey(null)} />
          <div style={{ position:'relative', background:'#FFFFFF', borderRadius:14, width:'100%', maxWidth:540, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 24px 56px rgba(0,0,0,.22)' }}>

            {/* Header */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Editar encuesta</p>
                <p style={{ fontSize:12, color:'#9CA3AF', marginTop:1 }}>{editingSurvey.name}</p>
              </div>
              <button onClick={() => setEditingSurvey(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:4 }}>
                <X size={18} strokeWidth={2}/>
              </button>
            </div>

            {/* Body */}
            <div style={{ flex:1, overflowY:'auto', padding:'20px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

                {/* Name */}
                <FocusInput label="Nombre de la encuesta" placeholder="Ej: Encuesta mayo 2026"
                  value={editName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)} />

                {/* Alert threshold */}
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:6 }}>
                    Umbral de alerta <span style={{ fontWeight:400, color:'#9CA3AF' }}>(nota media por debajo de este valor muestra alerta)</span>
                  </label>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <input type="range" min={1} max={5} step={0.5} value={editThreshold}
                      onChange={e => setEditThreshold(Number(e.target.value))}
                      style={{ flex:1 }} />
                    <span style={{ fontSize:14, fontWeight:700, color:'#111827', minWidth:32 }}>{editThreshold}/5</span>
                  </div>
                </div>

                {/* Questions */}
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:8 }}>
                    Preguntas ({editQuestions.length})
                  </label>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {editQuestions.map((q, idx) => (
                      <div key={q.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px', background:'#F9FAFB', borderRadius:9, border:'1px solid #E5E7EB' }}>
                        <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background: q.type==='rating' ? '#EEF3FE' : '#F3F4F6', color: q.type==='rating' ? '#1A56DB' : '#6B7280', flexShrink:0 }}>
                              {q.type === 'rating' ? '1-5' : 'Texto'}
                            </span>
                            <span style={{ fontSize:11, color:'#9CA3AF' }}>Pregunta {idx + 1}</span>
                            <button
                              onClick={() => {
                                const next = q.type === 'rating' ? 'text' : 'rating'
                                setEditQuestions(prev => prev.map(x => x.id===q.id ? {...x, type: next, required: next==='rating'} : x))
                              }}
                              style={{ fontSize:10, color:'#6B7280', background:'none', border:'1px solid #E5E7EB', borderRadius:4, padding:'2px 6px', cursor:'pointer', marginLeft:'auto' }}>
                              Cambiar tipo
                            </button>
                          </div>
                          <input
                            value={q.text}
                            onChange={e => setEditQuestions(prev => prev.map(x => x.id===q.id ? {...x, text:e.target.value} : x))}
                            placeholder="Texto de la pregunta..."
                            style={{ background:'none', border:'none', outline:'none', fontSize:13, color:'#111827', fontFamily:'inherit', width:'100%', padding:0 }}
                          />
                        </div>
                        <button onClick={() => setEditQuestions(prev => prev.filter(x => x.id !== q.id))}
                          style={{ color:'#9CA3AF', background:'none', border:'none', cursor:'pointer', padding:2, flexShrink:0 }}
                          onMouseEnter={e=>(e.currentTarget.style.color='#DC2626')}
                          onMouseLeave={e=>(e.currentTarget.style.color='#9CA3AF')}>
                          <Trash2 size={13} strokeWidth={2}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  {editQuestions.length < 6 && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      {[{type:'rating' as const, label:'+ Valoracion 1-5'}, {type:'text' as const, label:'+ Pregunta de texto'}].map(b => (
                        <button key={b.type}
                          onClick={() => setEditQuestions(prev => [...prev, newQ(b.type)])}
                          style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', color:'#6B7280', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4 }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#1A56DB';(e.currentTarget as HTMLButtonElement).style.color='#1A56DB'}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor='#E5E7EB';(e.currentTarget as HTMLButtonElement).style.color='#6B7280'}}>
                          <Plus size={11}/> {b.label.slice(2)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {editError && <p style={{ fontSize:13, color:'#DC2626' }}>{editError}</p>}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:'12px 20px', borderTop:'1px solid #E5E7EB', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setEditingSurvey(null)}
                style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F9FAFB', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                Cancelar
              </button>
              <button onClick={handleUpdate} disabled={editSaving || !editName.trim() || editQuestions.length === 0}
                style={{ padding:'9px 20px', borderRadius:8, border:'none', background: (editSaving || !editName.trim() || editQuestions.length === 0) ? '#93C5FD' : '#1A56DB', color:'white', fontSize:13, fontWeight:600, cursor: editSaving ? 'default' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARE MODAL ── */}
      {shareModalSurvey && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={() => setShareModalSurvey(null)} />
          <div style={{ position:'relative', background:'#FFFFFF', borderRadius:14, width:'100%', maxWidth:360, overflow:'hidden', boxShadow:'0 20px 48px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E5E7EB' }}>
              <p style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Compartir encuesta</p>
              <p style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{shareModalSurvey.name}</p>
            </div>
            <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ display:'flex', justifyContent:'center' }}>
                {shareQrUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={shareQrUrl} alt="QR" style={{ width:180, height:180, borderRadius:10, border:'1px solid #E5E7EB' }} />
                  : <div style={{ width:180, height:180, borderRadius:10, border:'1px solid #E5E7EB', background:'#F4F5F7', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:20, height:20, borderRadius:'50%', border:'2px solid #1A56DB', borderTopColor:'transparent', animation:'spin 0.7s linear infinite' }} /></div>
                }
              </div>
              <div>
                <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'#9CA3AF', marginBottom:8 }}>Enlace directo</p>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px', background:'#F4F5F7', borderRadius:9, border:'1px solid #E5E7EB' }}>
                  <p style={{ flex:1, fontSize:12, color:'#6B7280', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{shareLink}</p>
                  <button onClick={copyShareLink} style={{ background:'none', border:'none', cursor:'pointer', color: shareCopied ? '#0E9F6E' : '#1A56DB', flexShrink:0 }}>
                    {shareCopied ? <Check size={15} strokeWidth={2}/> : <Copy size={15} strokeWidth={2}/>}
                  </button>
                </div>
                {shareCopied && <p style={{ fontSize:11, color:'#0E9F6E', marginTop:4 }}>Enlace copiado</p>}
              </div>
              <button onClick={() => { const t=encodeURIComponent(`Encuesta de satisfaccion: ${shareLink}`); window.open(`https://wa.me/?text=${t}`,'_blank') }}
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px', borderRadius:9, border:'1px solid #A7F3D0', color:'#0E9F6E', background:'#F0FFF4', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                <MessageCircle size={15} strokeWidth={2}/> Enviar por WhatsApp
              </button>
            </div>
            <div style={{ padding:'0 20px 16px' }}>
              <button onClick={() => setShareModalSurvey(null)} style={{ width:'100%', padding:'9px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F4F5F7', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND MODAL ── */}
      {sendModalSurvey && (
        <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)' }} onClick={() => { setSendModalSurvey(null); setSendResult(null) }} />
          <div style={{ position:'relative', background:'#FFFFFF', borderRadius:14, width:'100%', maxWidth:480, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 48px rgba(0,0,0,.2)' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #E5E7EB' }}>
              <p style={{ fontSize:14, fontWeight:600, color:'#111827' }}>Enviar a clientes</p>
              <p style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>{sendModalSurvey.name}</p>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              {sendResult ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:'#DEF7EC', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                    <Check size={24} strokeWidth={2} style={{ color:'#0E9F6E' }} />
                  </div>
                  <p style={{ fontSize:14, fontWeight:600, color:'#111827', marginBottom:4 }}>Encuesta enviada</p>
                  <p style={{ fontSize:13, color:'#6B7280' }}>{sendResult.sent} enviadas{sendResult.failed>0 ? `, ${sendResult.failed} con error` : ''}</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:16 }}>
                    <p style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:8 }}>Canal</p>
                    <div style={{ display:'flex', gap:8 }}>
                      {(['email','whatsapp'] as const).map(ch => (
                        <button key={ch} onClick={() => { setSendChannel(ch); setSelectedCustomers(new Set()) }}
                          style={{ flex:1, padding:'9px', borderRadius:8, border:`1.5px solid ${sendChannel===ch ? '#1A56DB' : '#E5E7EB'}`, background: sendChannel===ch ? '#EEF3FE' : 'transparent', color: sendChannel===ch ? '#1A56DB' : '#6B7280', fontSize:13, fontWeight: sendChannel===ch ? 600 : 400, cursor:'pointer', fontFamily:'inherit', transition:'all 120ms' }}>
                          {ch==='email' ? 'Email' : 'WhatsApp'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <p style={{ fontSize:12, fontWeight:600, color:'#374151' }}>Clientes ({filteredCustomers.length})</p>
                      <button onClick={() => setSelectedCustomers(selectedCustomers.size===filteredCustomers.length ? new Set() : new Set(filteredCustomers.map(c=>c.id)))}
                        style={{ fontSize:12, color:'#1A56DB', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                        {selectedCustomers.size===filteredCustomers.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>
                    {customersLoading ? (
                      <div style={{ display:'flex', justifyContent:'center', padding:32 }}><div style={{ width:20,height:20,borderRadius:'50%',border:'2px solid #1A56DB',borderTopColor:'transparent',animation:'spin 0.7s linear infinite' }}/></div>
                    ) : filteredCustomers.length === 0 ? (
                      <p style={{ fontSize:13, color:'#9CA3AF', textAlign:'center', padding:'16px 0' }}>No hay clientes con {sendChannel==='email' ? 'email' : 'telefono'} registrado</p>
                    ) : (
                      <div style={{ border:'1px solid #E5E7EB', borderRadius:9, overflow:'hidden', maxHeight:224, overflowY:'auto' }}>
                        {filteredCustomers.map(c => (
                          <label key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #F4F5F7' }}>
                            <input type="checkbox" checked={selectedCustomers.has(c.id)}
                              onChange={() => setSelectedCustomers(prev => { const n=new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} />
                            <div>
                              <p style={{ fontSize:13, color:'#111827', fontWeight:500 }}>{c.name}</p>
                              <p style={{ fontSize:11, color:'#9CA3AF' }}>{sendChannel==='email' ? c.email : c.phone}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedCustomers.size > 0 && (
                      <p style={{ fontSize:12, color:'#6B7280', marginTop:8 }}>Vas a enviar a {selectedCustomers.size} cliente{selectedCustomers.size!==1 ? 's' : ''}</p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #E5E7EB', display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => { setSendModalSurvey(null); setSendResult(null) }}
                style={{ padding:'9px 18px', borderRadius:8, border:'1px solid #E5E7EB', background:'#F4F5F7', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                {sendResult ? 'Cerrar' : 'Cancelar'}
              </button>
              {!sendResult && (
                <button onClick={handleSend} disabled={selectedCustomers.size===0 || sending}
                  style={{ padding:'9px 18px', borderRadius:8, border:'none', background: (selectedCustomers.size===0||sending) ? '#9EB8F4' : '#1A56DB', color:'white', fontSize:13, fontWeight:600, cursor: (selectedCustomers.size===0||sending) ? 'default' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                  {sending
                    ? <><span style={{ width:12,height:12,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',animation:'spin 0.7s linear infinite',display:'inline-block'}}/>Enviando...</>
                    : 'Enviar encuesta'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
