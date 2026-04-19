'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Lock, Users, TrendingUp, MessageSquare } from 'lucide-react'
import { fixEncoding } from '@/lib/fix-encoding'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WaTemplate {
  id: string
  name: string
  meta_template_name: string
  category: string
  language: string
  header_text: string | null
  body_text: string
  footer_text: string | null
  variables: string[]
  is_approved: boolean
  created_at: string
}

interface Customer {
  id: string
  name: string
  phone: string | null
}

interface Campaign {
  id: string
  name: string
  status: 'draft' | 'sending' | 'sent' | 'failed'
  recipients_count: number
  sent_count: number
  delivered_count: number
  read_count: number
  failed_count: number
  created_at: string
  sent_at: string | null
  template_id: string | null
}

interface Recipient {
  id: string
  name: string | null
  phone: string
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  error_message: string | null
}

type Tab = 'new' | 'history' | 'templates'

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_m, n) => vars[n] || `{{${n}}}`)
}

const STATUS_BADGE: Record<string, { variant: 'neutral' | 'info' | 'success' | 'error'; label: string }> = {
  draft:   { variant: 'neutral', label: 'Borrador' },
  sending: { variant: 'info',    label: 'Enviando' },
  sent:    { variant: 'success', label: 'Enviado' },
  failed:  { variant: 'error',   label: 'Fallido' },
}

const RECIPIENT_STATUS_BADGE: Record<string, { variant: 'neutral' | 'info' | 'success' | 'error'; label: string }> = {
  pending:   { variant: 'neutral', label: 'Pendiente' },
  sent:      { variant: 'info',    label: 'Enviado' },
  delivered: { variant: 'success', label: 'Entregado' },
  read:      { variant: 'success', label: 'Leido' },
  failed:    { variant: 'error',   label: 'Fallido' },
}

// ── Mock data shown to free users ─────────────────────────────────────────────

const MOCK_CAMPAIGNS = [
  {
    id: 'm1', name: 'Oferta fin de semana', status: 'sent' as const,
    recipients_count: 47, sent_count: 47, delivered_count: 44, read_count: 38, failed_count: 0,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2', name: 'Novedades de temporada', status: 'sent' as const,
    recipients_count: 31, sent_count: 31, delivered_count: 29, read_count: 22, failed_count: 0,
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm3', name: 'Descuento clientes VIP', status: 'sent' as const,
    recipients_count: 12, sent_count: 12, delivered_count: 12, read_count: 10, failed_count: 0,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

// ── WhatsApp bubble preview ───────────────────────────────────────────────────

function WaBubble({ message, header }: { message: string; header?: string }) {
  const hasContent = message.trim() || header?.trim()
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md p-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Vista previa del mensaje
      </p>
      <div className="flex justify-end">
        <div
          className="max-w-[82%] rounded-[12px] rounded-tr-[3px] px-4 py-3 relative"
          style={{ backgroundColor: '#DCF8C6' }}
        >
          {header && (
            <p className="text-[12px] font-semibold text-[#075E54] mb-1.5">{header}</p>
          )}
          <p
            className="text-[13px] leading-relaxed whitespace-pre-wrap"
            style={{ color: hasContent ? '#111827' : '#9EA3AE' }}
          >
            {fixEncoding(message.trim() || 'El mensaje que escribas aparecera aqui')}
          </p>
          <p className="text-[10px] text-[#9EA3AE] mt-1.5 text-right">Ahora</p>
        </div>
      </div>
    </div>
  )
}

// ── Paywall banner ────────────────────────────────────────────────────────────

function UpgradeBanner({ customerCount, onUpgrade }: { customerCount: number; onUpgrade: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Lock size={15} strokeWidth={2} className="text-blue-600 shrink-0" />
        <p className="text-[13px] text-blue-800 font-medium">
          {customerCount > 0
            ? `Activa el plan Business para enviar a tus ${customerCount} clientes`
            : 'Activa el plan Business para enviar campanas masivas'}
        </p>
      </div>
      <Button size="sm" onClick={onUpgrade} className="shrink-0">
        Ver planes
      </Button>
    </div>
  )
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon }: {
  label: string; value: string | number; sub?: string; icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 bg-[#F4F5F7] rounded-lg p-3 text-center">
      {icon && <div className="flex justify-center mb-0.5 text-[#9EA3AE]">{icon}</div>}
      <span className="text-[20px] font-bold text-[#111827] leading-none">{value}</span>
      <span className="text-[11px] text-[#5A6070]">{label}</span>
      {sub && <span className="text-[10px] text-[#9EA3AE]">{sub}</span>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [businessId, setBusinessId] = useState('')
  const [plan, setPlan] = useState<string>('basic')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('new')

  // Templates
  const [templates, setTemplates] = useState<WaTemplate[]>([])

  // Customers (loaded for all plans)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // New campaign form (paid)
  const [campaignName, setCampaignName] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})
  const [sendMode, setSendMode] = useState<'now' | 'later'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  // Free-user form state
  const [freeMessage, setFreeMessage] = useState('')
  const [freeCampaignName, setFreeCampaignName] = useState('')

  // History
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null)
  const [recipientsMap, setRecipientsMap] = useState<Record<string, Recipient[]>>({})

  // Template form
  const [tplName, setTplName] = useState('')
  const [tplMetaName, setTplMetaName] = useState('')
  const [tplCategory, setTplCategory] = useState<'MARKETING' | 'UTILITY'>('MARKETING')
  const [tplBody, setTplBody] = useState('')
  const [tplFooter, setTplFooter] = useState('')
  const [tplSaving, setTplSaving] = useState(false)
  const [tplError, setTplError] = useState('')
  const [tplSuccess, setTplSuccess] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isFree = plan === 'basic' || plan === 'pro'

  // ── Boot ─────────────────────────────────────────────────────────────────────

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

      // Always load customers (free users see count in CTA)
      fetchCustomers(biz.id)

      if (biz.plan === 'basic' || biz.plan === 'pro') return

      fetchTemplates(biz.id)
      fetchCampaigns(biz.id)
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchTemplates = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('business_id', bid)
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
  }, [supabase])

  const fetchCustomers = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('business_id', bid)
      .order('name', { ascending: true })
    setCustomers(data ?? [])
  }, [supabase])

  const fetchCampaigns = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('whatsapp_campaigns')
      .select('*')
      .eq('business_id', bid)
      .order('created_at', { ascending: false })
    setCampaigns(data ?? [])
  }, [supabase])

  // ── Derived (paid) ────────────────────────────────────────────────────────────

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null
  const approvedTemplates = templates.filter(t => t.is_approved)
  const customersWithPhone = customers.filter(c => !!c.phone?.trim())

  const filteredCustomers = customers.filter(c => {
    const q = customerSearch.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
  })

  const selectedWithPhone = customers.filter(c => selectedIds.has(c.id) && c.phone?.trim())
  const selectedWithoutPhone = customers.filter(c => selectedIds.has(c.id) && !c.phone?.trim())

  function toggleCustomer(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() { setSelectedIds(new Set(filteredCustomers.map(c => c.id))) }
  function deselectAll() { setSelectedIds(new Set()) }

  // ── Send campaign ─────────────────────────────────────────────────────────────

  async function handleSend() {
    setSending(true)
    setSendError('')
    setShowConfirm(false)

    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: businessId,
        campaign_name: campaignName,
        template_id: selectedTemplateId,
        template_variables: templateVars,
        customer_ids: Array.from(selectedIds),
        scheduled_at: sendMode === 'later' ? scheduledAt : undefined,
      }),
    })

    const data = await res.json()
    setSending(false)

    if (!res.ok) {
      setSendError(data.error ?? 'Error al enviar la campana')
      return
    }

    setCampaignName(''); setSelectedTemplateId(''); setTemplateVars({})
    setSelectedIds(new Set()); setSendMode('now'); setScheduledAt('')
    setActiveTab('history')
    fetchCampaigns(businessId)
  }

  // ── Load recipients ───────────────────────────────────────────────────────────

  async function loadRecipients(campaignId: string) {
    if (recipientsMap[campaignId]) {
      setExpandedCampaign(prev => prev === campaignId ? null : campaignId)
      return
    }
    const { data } = await supabase
      .from('whatsapp_campaign_recipients')
      .select('id, name, phone, status, error_message')
      .eq('campaign_id', campaignId)
    setRecipientsMap(prev => ({ ...prev, [campaignId]: data ?? [] }))
    setExpandedCampaign(campaignId)
  }

  // ── Save template ─────────────────────────────────────────────────────────────

  async function handleSaveTemplate() {
    setTplSaving(true); setTplError(''); setTplSuccess(false)

    const res = await fetch('/api/whatsapp/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        name: tplName,
        meta_template_name: tplMetaName,
        category: tplCategory,
        body_text: tplBody,
        footer_text: tplFooter || undefined,
      }),
    })

    const data = await res.json()
    setTplSaving(false)

    if (!res.ok) { setTplError(data.error ?? 'Error al guardar'); return }

    setTplSuccess(true); setTplName(''); setTplMetaName(''); setTplBody(''); setTplFooter('')
    fetchTemplates(businessId)
  }

  // ── Loading state ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── Preview text ──────────────────────────────────────────────────────────────

  const previewText = selectedTemplate
    ? interpolate(selectedTemplate.body_text, templateVars)
    : ''

  // ── Render ────────────────────────────────────────────────────────────────────

  const tabs = isFree
    ? [{ key: 'new' as Tab, label: 'Nueva campana' }, { key: 'history' as Tab, label: 'Historial' }]
    : [{ key: 'new' as Tab, label: 'Nueva campana' }, { key: 'history' as Tab, label: 'Historial' }, { key: 'templates' as Tab, label: 'Plantillas' }]

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Campanas de WhatsApp"
        subtitle="Envia promociones y aumenta tus ventas con WhatsApp"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#EAECF0]">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'text-[13px] px-4 py-2.5 border-b-2 transition-colors duration-[120ms]',
              activeTab === key
                ? 'border-[#1A56DB] text-[#1A56DB] font-medium'
                : 'border-transparent text-[#5A6070] hover:text-[#111827]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Nueva campana ─────────────────────────────────────────────────── */}
      {activeTab === 'new' && (
        <>
          {isFree ? (
            /* ── FREE USER EXPERIENCE ──────────────────────────────────────── */
            <div className="flex flex-col gap-5">
              <UpgradeBanner
                customerCount={customersWithPhone.length}
                onUpgrade={() => router.push('/pricing')}
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* Left — Form */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[#111827]">
                      Nombre de la campana
                    </label>
                    <input
                      type="text"
                      value={freeCampaignName}
                      onChange={e => setFreeCampaignName(e.target.value)}
                      placeholder="Ej: Oferta del fin de semana"
                      className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-medium text-[#111827]">
                      Mensaje
                    </label>
                    <textarea
                      rows={5}
                      value={freeMessage}
                      onChange={e => setFreeMessage(e.target.value)}
                      placeholder="Hola! Tenemos una oferta especial para ti este fin de semana. Visita nuestro local y disfruta de un 20% de descuento en toda la carta."
                      className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] resize-none focus:outline-none focus:border-[#1A56DB] transition-colors"
                    />
                    <p className="text-[11px] text-[#9EA3AE]">
                      {freeMessage.length} / 1024 caracteres
                    </p>
                  </div>

                  {/* Destinatarios preview */}
                  <div className="border border-[#EAECF0] rounded-[10px] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={14} strokeWidth={2} className="text-[#9EA3AE]" />
                        <span className="text-[13px] font-medium text-[#111827]">Destinatarios</span>
                      </div>
                      <span className="text-[13px] font-semibold text-[#1A56DB]">
                        {customersWithPhone.length} clientes
                      </span>
                    </div>
                    {customersWithPhone.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1.5 max-h-28 overflow-hidden relative">
                        {customersWithPhone.slice(0, 4).map(c => (
                          <div key={c.id} className="flex items-center justify-between">
                            <span className="text-[12px] text-[#5A6070]">{c.name || 'Sin nombre'}</span>
                            <span className="text-[12px] text-[#9EA3AE]">{c.phone}</span>
                          </div>
                        ))}
                        {customersWithPhone.length > 4 && (
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
                        )}
                      </div>
                    )}
                    {customersWithPhone.length === 0 && (
                      <p className="text-[12px] text-[#9EA3AE] mt-1">
                        Agrega clientes con telefono para poder enviarles campanas
                      </p>
                    )}
                  </div>

                  {/* Locked send button */}
                  <div className="flex flex-col gap-2">
                    <button
                      disabled
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-[#EAECF0] bg-[#F4F5F7] text-[13px] font-semibold text-[#9EA3AE] cursor-not-allowed"
                    >
                      <Lock size={13} strokeWidth={2} />
                      Enviar campana
                    </button>
                    <p className="text-[12px] text-[#9EA3AE] text-center">
                      Disponible en plan Business —{' '}
                      <button
                        onClick={() => router.push('/pricing')}
                        className="text-[#1A56DB] hover:underline font-medium"
                      >
                        ver planes
                      </button>
                    </p>
                  </div>
                </div>

                {/* Right — Preview */}
                <div className="flex flex-col gap-4">
                  <WaBubble message={freeMessage} header={freeCampaignName || undefined} />

                  {/* Value props */}
                  <div className="flex flex-col gap-2">
                    {[
                      { icon: <MessageSquare size={14} strokeWidth={2} />, text: 'Mensajes con tasa de apertura del 98%' },
                      { icon: <Users size={14} strokeWidth={2} />, text: 'Llega a todos tus clientes a la vez' },
                      { icon: <TrendingUp size={14} strokeWidth={2} />, text: 'Seguimiento de entregas y lecturas en tiempo real' },
                    ].map(({ icon, text }) => (
                      <div key={text} className="flex items-center gap-2.5">
                        <span className="text-[#1A56DB] shrink-0">{icon}</span>
                        <span className="text-[12px] text-[#5A6070]">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── PAID USER EXPERIENCE ──────────────────────────────────────── */
            <>
              {templates.length === 0 ? (
                <Card className="flex flex-col items-center gap-3 text-center p-10">
                  <p className="text-[#111827] font-medium">No tienes plantillas creadas</p>
                  <p className="text-[13px] text-[#5A6070]">
                    Ve a la pestana Plantillas para crear tu primera plantilla de mensaje.
                  </p>
                  <Button variant="secondary" onClick={() => setActiveTab('templates')}>
                    Crear primera plantilla
                  </Button>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {/* Left column — Config */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-[#111827]">Nombre de la campana</label>
                      <input
                        type="text"
                        value={campaignName}
                        onChange={e => setCampaignName(e.target.value)}
                        placeholder="Ej: Promo de verano julio 2026"
                        className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-medium text-[#111827]">Plantilla de mensaje</label>
                      <select
                        value={selectedTemplateId}
                        onChange={e => { setSelectedTemplateId(e.target.value); setTemplateVars({}) }}
                        className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] bg-white focus:outline-none focus:border-[#1A56DB] transition-colors"
                      >
                        <option value="">Seleccionar plantilla</option>
                        {approvedTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {approvedTemplates.length === 0 && templates.length > 0 && (
                        <p className="text-[12px] text-[#E02424]">
                          No hay plantillas aprobadas. Aprueba una desde Meta Business Manager.
                        </p>
                      )}
                    </div>

                    {selectedTemplate && selectedTemplate.variables.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <p className="text-[13px] font-medium text-[#111827]">Variables del mensaje</p>
                        {selectedTemplate.variables.map(varNum => (
                          <div key={varNum} className="flex flex-col gap-1.5">
                            <label className="text-[12px] text-[#5A6070]">Variable {varNum}</label>
                            <input
                              type="text"
                              value={templateVars[varNum] ?? ''}
                              onChange={e => setTemplateVars(prev => ({ ...prev, [varNum]: e.target.value }))}
                              placeholder={`Texto para {{${varNum}}}`}
                              className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedTemplate && (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[13px] font-medium text-[#111827]">Vista previa</p>
                        <WaBubble
                          message={previewText}
                          header={selectedTemplate.header_text ?? undefined}
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <p className="text-[13px] font-medium text-[#111827]">Opcion de envio</p>
                      {(['now', 'later'] as const).map(mode => (
                        <label key={mode} className="flex items-center gap-2 text-[13px] text-[#111827] cursor-pointer">
                          <input
                            type="radio"
                            name="sendMode"
                            value={mode}
                            checked={sendMode === mode}
                            onChange={() => setSendMode(mode)}
                          />
                          {mode === 'now' ? 'Enviar ahora' : 'Programar'}
                        </label>
                      ))}
                      {sendMode === 'later' && (
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={e => setScheduledAt(e.target.value)}
                          className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] focus:outline-none focus:border-[#1A56DB] transition-colors"
                        />
                      )}
                    </div>

                    {sendError && <p className="text-[13px] text-[#E02424]">{sendError}</p>}

                    <Button
                      disabled={
                        !campaignName.trim() || !selectedTemplateId ||
                        selectedIds.size === 0 || sending ||
                        (sendMode === 'later' && !scheduledAt)
                      }
                      onClick={() => setShowConfirm(true)}
                    >
                      {sendMode === 'later' ? 'Programar campana' : 'Enviar campana'}
                    </Button>
                  </div>

                  {/* Right column — Recipients */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-medium text-[#111827]">Destinatarios</p>
                      <div className="flex gap-3">
                        <button onClick={selectAll} className="text-[12px] text-[#1A56DB] hover:underline">
                          Seleccionar todos
                        </button>
                        <button onClick={deselectAll} className="text-[12px] text-[#1A56DB] hover:underline">
                          Deseleccionar todos
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Buscar por nombre o telefono..."
                      className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
                    />

                    <div className="border border-[#EAECF0] rounded-lg overflow-y-auto" style={{ maxHeight: '320px' }}>
                      {filteredCustomers.length === 0 ? (
                        <p className="text-[13px] text-[#9EA3AE] text-center py-8">Sin clientes</p>
                      ) : (
                        filteredCustomers.map(c => {
                          const hasPhone = !!c.phone?.trim()
                          return (
                            <label
                              key={c.id}
                              className={[
                                'flex items-center gap-3 px-4 py-2.5 border-b border-[#F4F5F7] last:border-0 cursor-pointer',
                                hasPhone ? 'hover:bg-[#F4F5F7]' : 'opacity-50 cursor-default',
                              ].join(' ')}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(c.id)}
                                onChange={() => hasPhone && toggleCustomer(c.id)}
                                disabled={!hasPhone}
                                className="shrink-0"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[13px] text-[#111827] truncate">{fixEncoding(c.name || 'Sin nombre')}</span>
                                <span className="text-[11px] text-[#9EA3AE]">
                                  {hasPhone ? c.phone : 'Sin telefono'}
                                </span>
                              </div>
                            </label>
                          )
                        })
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <p className="text-[13px] text-[#5A6070]">
                        {selectedIds.size} clientes seleccionados
                        {selectedWithPhone.length !== selectedIds.size && (
                          <> ({selectedWithPhone.length} con telefono)</>
                        )}
                      </p>
                      {selectedWithoutPhone.length > 0 && (
                        <p className="text-[12px] text-[#D97706]">
                          {selectedWithoutPhone.length} clientes sin telefono seran excluidos
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation modal */}
              {showConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                  <div className="bg-white rounded-[12px] p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
                    <p className="text-[15px] font-semibold text-[#111827]">Confirmar envio</p>
                    <p className="text-[13px] text-[#5A6070]">
                      Vas a enviar el mensaje a {selectedWithPhone.length} clientes.
                      {selectedWithoutPhone.length > 0 && (
                        <> {selectedWithoutPhone.length} sin telefono seran excluidos.</>
                      )}{' '}
                      Confirmas?
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancelar</Button>
                      <Button onClick={handleSend} loading={sending} disabled={sending}>
                        {sending ? 'Enviando...' : 'Confirmar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── TAB: Historial ────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3">
          {isFree ? (
            /* Mock campaigns for free users */
            <>
              <div className="flex items-center gap-3 border border-[#EAECF0] bg-[#F4F5F7] rounded-[10px] px-4 py-3">
                <p className="text-[13px] text-[#5A6070] flex-1">
                  Ejemplo de como se veran tus campanas cuando actives el plan Business
                </p>
                <Button size="sm" onClick={() => router.push('/pricing')}>
                  Activar plan
                </Button>
              </div>

              {MOCK_CAMPAIGNS.map(c => {
                const badge = STATUS_BADGE[c.status]
                return (
                  <Card key={c.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] font-medium text-[#111827]">{fixEncoding(c.name)}</span>
                        <span className="text-[12px] text-[#9EA3AE]">{formatDate(c.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[#9EA3AE] bg-[#F4F5F7] border border-[#EAECF0] px-2 py-0.5 rounded-full">
                          Ejemplo
                        </span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <MetricCard label="Enviados" value={c.sent_count} sub={pct(c.sent_count, c.recipients_count)} />
                      <MetricCard label="Entregados" value={c.delivered_count} sub={pct(c.delivered_count, c.sent_count)} />
                      <MetricCard label="Leidos" value={c.read_count} sub={pct(c.read_count, c.delivered_count)} />
                      <MetricCard label="Fallidos" value={c.failed_count} sub={pct(c.failed_count, c.recipients_count)} />
                    </div>
                  </Card>
                )
              })}
            </>
          ) : (
            /* Real campaigns for paid users */
            campaigns.length === 0 ? (
              <Card className="flex flex-col items-center gap-3 text-center py-16">
                <p className="text-[13px] text-[#9EA3AE]">No has enviado ninguna campana todavia</p>
                <Button variant="secondary" onClick={() => setActiveTab('new')}>Crear campana</Button>
              </Card>
            ) : (
              campaigns.map(c => {
                const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft
                const isExpanded = expandedCampaign === c.id
                return (
                  <Card key={c.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] font-medium text-[#111827]">{fixEncoding(c.name)}</span>
                        <span className="text-[12px] text-[#9EA3AE]">{formatDate(c.created_at)}</span>
                      </div>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <MetricCard label="Enviados" value={c.sent_count} sub={pct(c.sent_count, c.recipients_count)} />
                      <MetricCard label="Entregados" value={c.delivered_count} sub={pct(c.delivered_count, c.sent_count)} />
                      <MetricCard label="Leidos" value={c.read_count} sub={pct(c.read_count, c.delivered_count)} />
                      <MetricCard label="Fallidos" value={c.failed_count} sub={pct(c.failed_count, c.recipients_count)} />
                    </div>

                    <button
                      onClick={() => loadRecipients(c.id)}
                      className="text-[12px] text-[#1A56DB] hover:underline text-left"
                    >
                      {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                    </button>

                    {isExpanded && (
                      <div className="border border-[#EAECF0] rounded-lg overflow-hidden">
                        {(recipientsMap[c.id] ?? []).map(r => {
                          const rb = RECIPIENT_STATUS_BADGE[r.status] ?? RECIPIENT_STATUS_BADGE.pending
                          return (
                            <div
                              key={r.id}
                              className="flex items-center justify-between px-4 py-2.5 border-b border-[#F4F5F7] last:border-0"
                            >
                              <div className="flex flex-col">
                                <span className="text-[13px] text-[#111827]">{fixEncoding(r.name || 'Sin nombre')}</span>
                                <span className="text-[11px] text-[#9EA3AE]">{r.phone}</span>
                                {r.error_message && (
                                  <span className="text-[11px] text-[#E02424]">{fixEncoding(r.error_message)}</span>
                                )}
                              </div>
                              <Badge variant={rb.variant}>{rb.label}</Badge>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                )
              })
            )
          )}
        </div>
      )}

      {/* ── TAB: Plantillas (paid only) ───────────────────────────────────────── */}
      {activeTab === 'templates' && !isFree && (
        <div className="flex flex-col gap-6">
          {templates.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-medium text-[#111827]">Plantillas guardadas</p>
              {templates.map(t => (
                <Card key={t.id} className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#111827]">{fixEncoding(t.name)}</span>
                      <Badge variant={t.is_approved ? 'success' : 'neutral'}>
                        {t.is_approved ? 'Aprobada' : 'Pendiente'}
                      </Badge>
                    </div>
                    <span className="text-[12px] text-[#9EA3AE]">Meta: {fixEncoding(t.meta_template_name)}</span>
                    <p className="text-[12px] text-[#5A6070] line-clamp-2 mt-0.5">{fixEncoding(t.body_text)}</p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <p className="text-[13px] font-semibold text-[#111827]">Nueva plantilla</p>

            {[
              { label: 'Nombre interno', value: tplName, setter: setTplName, placeholder: 'Ej: Promo verano' },
              { label: 'Nombre en Meta', value: tplMetaName, setter: setTplMetaName, placeholder: 'Ej: promo_verano_2026' },
            ].map(({ label, value, setter, placeholder }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[#111827]">{label}</label>
                <input
                  type="text"
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
                />
              </div>
            ))}

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#111827]">Categoria</label>
              <select
                value={tplCategory}
                onChange={e => setTplCategory(e.target.value as 'MARKETING' | 'UTILITY')}
                className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] bg-white focus:outline-none focus:border-[#1A56DB] transition-colors"
              >
                <option value="MARKETING">Marketing</option>
                <option value="UTILITY">Utilidad</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#111827]">Texto del mensaje</label>
              <textarea
                value={tplBody}
                onChange={e => setTplBody(e.target.value)}
                rows={5}
                placeholder={'Hola {{1}}, te ofrecemos un {{2}} de descuento exclusivo para ti.'}
                className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] resize-none focus:outline-none focus:border-[#1A56DB] transition-colors"
              />
              <p className="text-[11px] text-[#9EA3AE]">
                Usa {'{{1}}'}, {'{{2}}'} para variables dinamicas
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-[#111827]">Pie de mensaje (opcional)</label>
              <input
                type="text"
                value={tplFooter}
                onChange={e => setTplFooter(e.target.value)}
                placeholder="Ej: Valido hasta el 31 de julio"
                className="border border-[#EAECF0] rounded-lg px-3 py-2 text-[13px] text-[#111827] placeholder-[#9EA3AE] focus:outline-none focus:border-[#1A56DB] transition-colors"
              />
            </div>

            {tplError && <p className="text-[13px] text-[#E02424]">{tplError}</p>}
            {tplSuccess && <p className="text-[13px] text-[#0E9F6E]">Plantilla guardada correctamente</p>}

            <div className="rounded-lg border border-[#EAECF0] bg-[#FFF8E6] px-4 py-3">
              <p className="text-[12px] text-[#D97706]">
                Las plantillas deben estar aprobadas en Meta Business Manager antes de usarlas en una campana.
              </p>
            </div>

            <Button
              disabled={!tplName.trim() || !tplMetaName.trim() || !tplBody.trim() || tplSaving}
              loading={tplSaving}
              onClick={handleSaveTemplate}
            >
              {tplSaving ? 'Guardando...' : 'Guardar plantilla'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
