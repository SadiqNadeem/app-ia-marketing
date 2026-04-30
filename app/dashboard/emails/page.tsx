'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { buildEmailHtml, buildPlainText } from '@/lib/email-template'
import { fixEncoding } from '@/lib/fix-encoding'
import { EmailPreview } from '@/components/EmailPreview'

// ── Types ─────────────────────────────────────────────────────────────────────

type EmailType = 'newsletter' | 'promotion' | 'announcement' | 'seasonal'
type PromotionType = '2x1' | 'descuento_porcentaje' | 'descuento_fijo' | 'regalo' | 'sorteo' | 'flash'
type Tab = 'new' | 'recipients' | 'history' | 'unsubscribes'
type SendMode = 'now' | 'later'

interface GeneratedEmail {
  subject: string
  preview_text: string
  headline: string
  body: string
  cta_text: string
  cta_url: string
  footer_text: string
}

interface Campaign {
  id: string
  name: string
  subject: string
  status: 'draft' | 'sending' | 'sent' | 'failed'
  recipients_count: number
  sent_count: number
  open_count: number
  click_count: number
  bounce_count: number
  unsubscribe_count: number
  sent_at: string | null
  created_at: string
}

interface Customer {
  id: string
  name: string
  email: string | null
}

interface Unsubscribe {
  id: string
  email: string
  unsubscribed_at: string
}

interface BusinessData {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const UNSUBSCRIBE_PLACEHOLDER = '__UNSUBSCRIBE_URL__'

const EMAIL_TYPES: { value: EmailType; label: string }[] = [
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'promotion', label: 'Promocion' },
  { value: 'announcement', label: 'Comunicado' },
  { value: 'seasonal', label: 'Temporada' },
]

const PROMOTION_TYPES: { value: PromotionType; label: string }[] = [
  { value: '2x1', label: '2x1' },
  { value: 'descuento_porcentaje', label: 'Descuento %' },
  { value: 'descuento_fijo', label: 'Descuento fijo' },
  { value: 'regalo', label: 'Regalo' },
  { value: 'sorteo', label: 'Sorteo' },
  { value: 'flash', label: 'Oferta flash' },
]

const STATUS_BADGE: Record<string, { variant: 'neutral' | 'info' | 'success' | 'error'; label: string }> = {
  draft:   { variant: 'neutral', label: 'Borrador' },
  sending: { variant: 'info',    label: 'Enviando' },
  sent:    { variant: 'success', label: 'Enviado' },
  failed:  { variant: 'error',   label: 'Fallido' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [businessId, setBusinessId] = useState('')
  const [business, setBusiness] = useState<BusinessData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('new')

  // ── Generate form ──────────────────────────────────────────────────────────
  const [emailType, setEmailType] = useState<EmailType>('newsletter')
  const [promotionType, setPromotionType] = useState<PromotionType>('descuento_porcentaje')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // ── Editor form ────────────────────────────────────────────────────────────
  const [generated, setGenerated] = useState<GeneratedEmail | null>(null)
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [ctaText, setCtaText] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [footerText, setFooterText] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [savingDraft, setSavingDraft] = useState(false)
  const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null)
  const [saveMsg, setSaveMsg] = useState('')
  const [showMobilePreview, setShowMobilePreview] = useState(false)

  // ── Recipients ─────────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [customerSearch, setCustomerSearch] = useState('')
  const [unsubscribedEmails, setUnsubscribedEmails] = useState<Set<string>>(new Set())
  const [sendMode, setSendMode] = useState<SendMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  // ── History ────────────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  // ── Unsubscribes ───────────────────────────────────────────────────────────
  const [unsubs, setUnsubs] = useState<Unsubscribe[]>([])

  // ── Boot ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function boot() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: biz } = await supabase
        .from('businesses')
        .select('id, name, logo_url, primary_color')
        .eq('owner_id', user.id)
        .single()

      if (!biz) { router.push('/onboarding'); return }

      setBusinessId(biz.id)
      setBusiness(biz)
      setLoading(false)

      fetchCustomers(biz.id)
      fetchCampaigns(biz.id)
      fetchUnsubscribes(biz.id)
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCustomers = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('business_id', bid)
      .not('email', 'is', null)
      .order('name', { ascending: true })
    setCustomers((data ?? []) as Customer[])
  }, [supabase])

  const fetchCampaigns = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('email_campaigns')
      .select('id, name, subject, status, recipients_count, sent_count, open_count, click_count, bounce_count, unsubscribe_count, sent_at, created_at')
      .eq('business_id', bid)
      .order('created_at', { ascending: false })
    setCampaigns((data ?? []) as Campaign[])
  }, [supabase])

  const fetchUnsubscribes = useCallback(async (bid: string) => {
    const { data } = await supabase
      .from('email_unsubscribes')
      .select('id, email, unsubscribed_at')
      .eq('business_id', bid)
      .order('unsubscribed_at', { ascending: false })
    const rows = (data ?? []) as Unsubscribe[]
    setUnsubs(rows)
    setUnsubscribedEmails(new Set(rows.map(u => u.email.toLowerCase())))
  }, [supabase])

  // ── Generate ───────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!businessId) return
    setGenerating(true)
    setGenerateError('')

    try {
      const res = await fetch('/api/email/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          type: emailType,
          promotion_type: emailType === 'promotion' ? promotionType : undefined,
          custom_instructions: customInstructions || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setGenerateError(data.error ?? 'Error al generar'); return }

      const g = data as GeneratedEmail
      setGenerated(g)
      setSubject(fixEncoding(g.subject))
      setPreviewText(g.preview_text)
      setHeadline(fixEncoding(g.headline))
      setBody(fixEncoding(g.body))
      setCtaText(g.cta_text)
      setCtaUrl(g.cta_url)
      setFooterText(g.footer_text)
      if (!campaignName) setCampaignName(fixEncoding(`Email ${EMAIL_TYPES.find(t => t.value === emailType)?.label} — ${new Date().toLocaleDateString('es-ES')}`))
      setSavedCampaignId(null)
      setSaveMsg('')
    } catch {
      setGenerateError('Error de conexion')
    } finally {
      setGenerating(false)
    }
  }

  // ── Preview HTML ───────────────────────────────────────────────────────────

  const previewHtml = useMemo(() => {
    if (!business || !headline) return ''
    return buildEmailHtml({
      business,
      subject: subject || 'Vista previa',
      headline,
      body,
      cta_text: ctaText || null,
      cta_url: ctaUrl || null,
      footer_text: footerText || null,
      unsubscribe_url: '#',
    })
  }, [business, subject, headline, body, ctaText, ctaUrl, footerText])

  // ── Save draft ─────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!businessId || !subject || !headline) return
    setSavingDraft(true)
    setSaveMsg('')

    const htmlContent = buildEmailHtml({
      business: business!,
      subject,
      headline,
      body,
      cta_text: ctaText || null,
      cta_url: ctaUrl || null,
      footer_text: footerText || null,
      unsubscribe_url: UNSUBSCRIBE_PLACEHOLDER,
    })

    const plainContent = buildPlainText({
      headline,
      body,
      cta_text: ctaText || null,
      cta_url: ctaUrl || null,
      footer_text: footerText || null,
    }) + `\n\nDarse de baja: ${UNSUBSCRIBE_PLACEHOLDER}`

    const payload = {
      business_id: businessId,
      name: fixEncoding(campaignName || `Email — ${new Date().toLocaleDateString('es-ES')}`),
      subject,
      preview_text: previewText || null,
      html_content: htmlContent,
      plain_text: plainContent,
      status: 'draft',
    }

    if (savedCampaignId) {
      const { error } = await supabase
        .from('email_campaigns')
        .update(payload)
        .eq('id', savedCampaignId)
      if (error) { setSaveMsg('Error al guardar'); setSavingDraft(false); return }
    } else {
      const { data, error } = await supabase
        .from('email_campaigns')
        .insert(payload)
        .select('id')
        .single()
      if (error || !data) { setSaveMsg('Error al guardar'); setSavingDraft(false); return }
      setSavedCampaignId(data.id)
    }

    setSaveMsg('Borrador guardado')
    setSavingDraft(false)
    fetchCampaigns(businessId)
  }

  // ── Recipients helpers ─────────────────────────────────────────────────────

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return customers
    const q = customerSearch.toLowerCase()
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    )
  }, [customers, customerSearch])

  const excludedCount = useMemo(() =>
    customers.filter(c => c.email && unsubscribedEmails.has(c.email.toLowerCase())).length,
    [customers, unsubscribedEmails]
  )

  function toggleCustomer(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    const eligible = filteredCustomers.filter(
      c => !c.email || !unsubscribedEmails.has(c.email.toLowerCase())
    )
    if (eligible.every(c => selectedIds.has(c.id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(eligible.map(c => c.id)))
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  async function handleSend() {
    if (!savedCampaignId || !selectedIds.size) return
    setSending(true)
    setSendError('')
    setSendSuccess('')
    setShowConfirm(false)

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          campaign_id: savedCampaignId,
          customer_ids: Array.from(selectedIds),
          scheduled_at: sendMode === 'later' ? scheduledAt : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setSendError(data.error ?? 'Error al enviar'); return }

      if (data.scheduled) {
        setSendSuccess('Campana programada correctamente')
      } else {
        setSendSuccess(`Enviado a ${data.sent} cliente${data.sent !== 1 ? 's' : ''}${data.failed ? ` (${data.failed} fallidos)` : ''}`)
      }
      fetchCampaigns(businessId)
      setActiveTab('history')
    } catch {
      setSendError('Error de conexion')
    } finally {
      setSending(false)
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────

  function exportCsv() {
    const rows = ['email,fecha_baja', ...unsubs.map(u => `${u.email},${u.unsubscribed_at}`)]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bajas_email.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-[#374151]">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <PageHeader
        title="Email marketing"
        subtitle="Envia newsletters y promociones a tus clientes"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB]">
        {([
          { key: 'new',          label: 'Nueva campana' },
          { key: 'recipients',   label: 'Destinatarios y envio' },
          { key: 'history',      label: 'Historial' },
          { key: 'unsubscribes', label: 'Bajas' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === key
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#374151] hover:text-[#111827]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Nueva campana ── */}
      {activeTab === 'new' && (
        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left column — Editor */}
          <div className="flex flex-col gap-4 md:basis-[55%] md:shrink-0">

            {/* Card 1 — Generar con IA */}
            <Card>
              <h2 className="text-base font-semibold text-[#111827] mb-4">Generar con IA</h2>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Tipo de email</label>
                  <select
                    value={emailType}
                    onChange={e => setEmailType(e.target.value as EmailType)}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  >
                    {EMAIL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {emailType === 'promotion' && (
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Tipo de promocion</label>
                    <select
                      value={promotionType}
                      onChange={e => setPromotionType(e.target.value as PromotionType)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      {PROMOTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Asunto del email (opcional)</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Ej: Oferta especial este fin de semana"
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">Instrucciones adicionales (opcional)</label>
                  <textarea
                    value={customInstructions}
                    onChange={e => setCustomInstructions(e.target.value)}
                    placeholder="Menciona algun detalle especifico que quieras incluir..."
                    rows={3}
                    className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                {generateError && (
                  <p className="text-sm text-red-600">{generateError}</p>
                )}

                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Generando tu email...' : 'Generar con IA'}
                </Button>
              </div>
            </Card>

            {/* Card 2 — Editar contenido */}
            <Card>
                <h2 className="text-base font-semibold text-[#111827] mb-4">Contenido del email</h2>

                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Nombre de la campana</label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={e => setCampaignName(e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-[#374151]">Asunto</label>
                      <span className={`text-xs ${subject.length > 60 ? 'text-red-500' : 'text-[#9CA3AF]'}`}>
                        {subject.length}/60
                      </span>
                    </div>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      maxLength={80}
                      placeholder="El asunto que veran en su bandeja de entrada"
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-[#374151]">Texto de preview</label>
                      <span className={`text-xs ${previewText.length > 90 ? 'text-red-500' : 'text-[#4B5563]'}`}>
                        {previewText.length}/90
                      </span>
                    </div>
                    <input
                      type="text"
                      value={previewText}
                      onChange={e => setPreviewText(e.target.value)}
                      maxLength={110}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Titulo principal</label>
                    <input
                      type="text"
                      value={headline}
                      onChange={e => setHeadline(e.target.value)}
                      placeholder="El titulo grande dentro del email"
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">
                      Cuerpo del email <span className="text-[#4B5563] font-normal">(acepta HTML basico: p, strong, br, ul, li)</span>
                    </label>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      rows={6}
                      placeholder="El contenido principal. Puedes usar HTML basico: <strong>, <br>, <ul>, <li>"
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">Texto del boton (opcional)</label>
                      <input
                        type="text"
                        value={ctaText}
                        onChange={e => setCtaText(e.target.value)}
                        placeholder="Ej: Ver la oferta, Reservar ahora, Ver menu"
                        className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#374151] mb-1">URL del boton (opcional)</label>
                      <input
                        type="url"
                        value={ctaUrl}
                        onChange={e => setCtaUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">Texto del pie</label>
                    <textarea
                      value={footerText}
                      onChange={e => setFooterText(e.target.value)}
                      rows={2}
                      placeholder="Ej: Abierto de lunes a domingo de 12:00 a 23:00. C/ Gran Via 45"
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  {saveMsg && (
                    <p className="text-sm text-green-600">{saveMsg}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={handleSaveDraft}
                      disabled={savingDraft || !subject || !headline}
                    >
                      {savingDraft ? 'Guardando...' : 'Guardar borrador'}
                    </Button>
                    <Button
                      onClick={() => {
                        if (!savedCampaignId) {
                          handleSaveDraft().then(() => setActiveTab('recipients'))
                        } else {
                          setActiveTab('recipients')
                        }
                      }}
                      disabled={!subject || !headline}
                    >
                      Continuar a destinatarios
                    </Button>
                  </div>
                </div>
            </Card>
          </div>

          {/* Right column — Preview */}
          <div className="md:basis-[45%] md:shrink-0">
            {/* Mobile toggle button */}
            <button
              className="md:hidden w-full flex items-center justify-center gap-2 mb-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] font-medium text-[#374151] bg-white"
              onClick={() => setShowMobilePreview((v) => !v)}
            >
              {showMobilePreview ? 'Ocultar vista previa' : 'Ver vista previa'}
            </button>
            <div className={`sticky top-6 ${showMobilePreview ? 'block' : 'hidden md:block'}`}>
              <p className="text-[12px] font-medium text-[#9EA3AE] text-center mb-2.5">
                Vista previa
              </p>
              <EmailPreview
                businessName={business?.name ?? ''}
                businessColor={business?.primary_color ?? '#2563EB'}
                subject={subject}
                headline={headline}
                body={body}
                ctaText={ctaText}
                footerText={footerText}
              />
              {(headline || body || subject) && (
                <p className="text-[11px] text-[#9EA3AE] mt-2 text-center">
                  Asi veran el email tus clientes en su bandeja de entrada
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: Destinatarios y envio ── */}
      {activeTab === 'recipients' && (
        <div className="flex flex-col gap-4 max-w-2xl">
          {!savedCampaignId && (
            <Card>
              <p className="text-sm text-[#374151]">
                Primero guarda un borrador en la pestana "Nueva campana" antes de seleccionar destinatarios.
              </p>
            </Card>
          )}

          {savedCampaignId && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-[#111827]">Seleccionar destinatarios</h2>
                  <span className="text-sm text-[#374151]">
                    {selectedIds.size} seleccionados
                    {excludedCount > 0 && ` · ${excludedCount} excluidos por baja`}
                  </span>
                </div>

                <input
                  type="text"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="Buscar por nombre o email..."
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] mb-3 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />

                {/* Select all */}
                <div className="flex items-center gap-2 pb-2 border-b border-[#E5E7EB] mb-2">
                  <input
                    type="checkbox"
                    id="select-all-email"
                    checked={
                      filteredCustomers.filter(c => !c.email || !unsubscribedEmails.has(c.email.toLowerCase())).length > 0 &&
                      filteredCustomers.filter(c => !c.email || !unsubscribedEmails.has(c.email.toLowerCase())).every(c => selectedIds.has(c.id))
                    }
                    onChange={toggleAll}
                    className="w-4 h-4 accent-[#2563EB]"
                  />
                  <label htmlFor="select-all-email" className="text-sm text-[#374151] cursor-pointer">
                    Seleccionar todos ({filteredCustomers.filter(c => !c.email || !unsubscribedEmails.has(c.email.toLowerCase())).length} disponibles)
                  </label>
                </div>

                <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                  {filteredCustomers.map(customer => {
                    const isUnsub = customer.email ? unsubscribedEmails.has(customer.email.toLowerCase()) : false
                    return (
                      <label
                        key={customer.id}
                        className={[
                          'flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer',
                          isUnsub ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#F7F8FA]',
                        ].join(' ')}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.id)}
                          onChange={() => !isUnsub && toggleCustomer(customer.id)}
                          disabled={isUnsub}
                          className="w-4 h-4 accent-[#2563EB] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm text-[#111827] truncate">{customer.name}</p>
                          <p className="text-xs text-[#374151] truncate">{customer.email}</p>
                        </div>
                        {isUnsub && (
                          <span className="text-xs text-[#4B5563] shrink-0">baja</span>
                        )}
                      </label>
                    )
                  })}

                  {filteredCustomers.length === 0 && (
                    <p className="text-sm text-[#4B5563] text-center py-4">
                      No hay clientes con email registrado
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-semibold text-[#111827] mb-4">Opciones de envio</h2>

                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => setSendMode('now')}
                    className={[
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                      sendMode === 'now'
                        ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                        : 'border-[#D1D5DB] text-[#374151] hover:bg-[#F7F8FA]',
                    ].join(' ')}
                  >
                    Enviar ahora
                  </button>
                  <button
                    onClick={() => setSendMode('later')}
                    className={[
                      'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                      sendMode === 'later'
                        ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                        : 'border-[#D1D5DB] text-[#374151] hover:bg-[#F7F8FA]',
                    ].join(' ')}
                  >
                    Programar
                  </button>
                </div>

                {sendMode === 'later' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-[#374151] mb-1">Fecha y hora de envio</label>
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                )}

                {sendError && <p className="text-sm text-red-600 mb-3">{sendError}</p>}
                {sendSuccess && <p className="text-sm text-green-600 mb-3">{sendSuccess}</p>}

                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={!selectedIds.size || sending || (sendMode === 'later' && !scheduledAt)}
                >
                  Enviar campana
                </Button>
              </Card>

              {/* Confirm modal */}
              {showConfirm && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
                    <h3 className="text-base font-semibold text-[#111827] mb-2">Confirmar envio</h3>
                    <p className="text-sm text-[#374151] mb-6">
                      {sendMode === 'now'
                        ? `Se enviara el email a ${selectedIds.size} destinatario${selectedIds.size !== 1 ? 's' : ''}. Esta accion no se puede deshacer.`
                        : `Se programara el envio a ${selectedIds.size} destinatario${selectedIds.size !== 1 ? 's' : ''}.`
                      }
                    </p>
                    <div className="flex gap-3">
                      <Button variant="secondary" onClick={() => setShowConfirm(false)}>Cancelar</Button>
                      <Button onClick={handleSend} disabled={sending}>
                        {sending ? 'Enviando...' : 'Confirmar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB: Historial ── */}
      {activeTab === 'history' && (
        <div className="flex flex-col gap-3 max-w-3xl">
          {campaigns.length === 0 && (
            <Card>
              <p className="text-sm text-[#374151] text-center py-4">No hay campanas enviadas todavia.</p>
            </Card>
          )}
          {campaigns.map(c => {
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.draft
            return (
              <Card key={c.id}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#111827] truncate">{c.name}</p>
                    <p className="text-xs text-[#374151] truncate mt-0.5">{c.subject}</p>
                    {c.sent_at && (
                      <p className="text-xs text-[#4B5563] mt-0.5">{formatDate(c.sent_at)}</p>
                    )}
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Enviados', value: c.sent_count, sub: '' },
                    { label: 'Abiertos', value: c.open_count, sub: pct(c.open_count, c.sent_count) },
                    { label: 'Clics', value: c.click_count, sub: pct(c.click_count, c.sent_count) },
                    { label: 'Bajas', value: c.unsubscribe_count, sub: pct(c.unsubscribe_count, c.sent_count) },
                  ].map(({ label, value, sub }) => (
                    <div key={label} className="bg-[#F7F8FA] rounded-lg p-3">
                      <p className="text-xs text-[#374151] mb-1">{label}</p>
                      <p className="text-lg font-semibold text-[#111827]">{value}</p>
                      {sub && <p className="text-xs text-[#4B5563]">{sub}</p>}
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── TAB: Bajas ── */}
      {activeTab === 'unsubscribes' && (
        <div className="flex flex-col gap-4 max-w-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#374151]">
              {unsubs.length} email{unsubs.length !== 1 ? 's' : ''} dados de baja
            </p>
            {unsubs.length > 0 && (
              <Button variant="secondary" onClick={exportCsv}>Exportar lista</Button>
            )}
          </div>

          <Card padding="sm">
            <p className="text-xs text-[#374151] mb-3">
              Estos emails estan excluidos automaticamente de todos los envios.
            </p>
            {unsubs.length === 0 ? (
              <p className="text-sm text-[#4B5563] text-center py-4">No hay bajas registradas.</p>
            ) : (
              <div className="flex flex-col divide-y divide-[#E5E7EB]">
                {unsubs.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2.5">
                    <p className="text-sm text-[#111827]">{u.email}</p>
                    <p className="text-xs text-[#4B5563]">{formatDate(u.unsubscribed_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
