'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Route } from 'next'

// ── Types ─────────────────────────────────────────────────────────────────────

type Platform  = 'meta' | 'google'
type Objective = 'awareness' | 'traffic' | 'leads' | 'sales' | 'engagement'

interface MetaVariant {
  variant: 'A' | 'B'
  headline: string
  description: string
  body_text: string
  cta: string
  rationale: string
}

interface GoogleVariant {
  variant: 'A' | 'B'
  headline_1: string
  headline_2: string
  headline_3: string
  description_1: string
  description_2: string
  keywords: string[]
  rationale: string
}

type AdVariant = MetaVariant | GoogleVariant

interface AdCreative {
  id: string
  platform: Platform
  objective: Objective
  target_audience: string | null
  budget_daily: number | null
  variants: AdVariant[]
  image_url: string | null
  status: string
  created_at: string
  // extended fields from generate response
  audience_suggestion?: string
  budget_recommendation?: string
  expected_results?: string
  match_type_recommendation?: string
  negative_keywords?: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'meta',   label: 'Meta Ads (Facebook e Instagram)' },
  { value: 'google', label: 'Google Ads' },
]

const OBJECTIVE_OPTIONS: { value: Objective; label: string }[] = [
  { value: 'awareness',  label: 'Reconocimiento de marca' },
  { value: 'traffic',    label: 'Trafico al local' },
  { value: 'leads',      label: 'Captacion de leads' },
  { value: 'sales',      label: 'Ventas' },
  { value: 'engagement', label: 'Interaccion' },
]

const PROMOTION_TYPES = [
  { value: '',               label: 'Sin tipo especifico' },
  { value: 'menu_dia',       label: 'Menu del dia' },
  { value: 'oferta_2x1',     label: 'Oferta 2x1' },
  { value: 'happy_hour',     label: 'Happy hour' },
  { value: 'sorteo',         label: 'Sorteo / Concurso' },
  { value: 'evento',         label: 'Evento especial' },
  { value: 'nuevo_producto', label: 'Nuevo producto/servicio' },
  { value: 'apertura',       label: 'Apertura / Inauguracion' },
  { value: 'black_friday',   label: 'Black Friday' },
  { value: 'navidad',        label: 'Navidad' },
  { value: 'aniversario',    label: 'Aniversario' },
]

const OBJECTIVE_LABEL: Record<Objective, string> = {
  awareness:  'Reconocimiento',
  traffic:    'Trafico',
  leads:      'Leads',
  sales:      'Ventas',
  engagement: 'Interaccion',
}

const PLATFORM_INSTRUCTIONS: Record<Platform, (objective: string, budget: number) => string> = {
  meta: (obj, budget) =>
    `1. Ve a business.facebook.com → Administrador de anuncios\n2. Crea una nueva campana con el objetivo '${obj}'\n3. En el conjunto de anuncios configura la segmentacion sugerida arriba\n4. En el anuncio, copia el titular, descripcion y texto principal de la variante que elijas\n5. Sube la imagen generada arriba\n6. Establece el presupuesto diario de ${budget} EUR\n7. Revisa y publica tu anuncio`,
  google: (_obj, budget) =>
    `1. Ve a ads.google.com\n2. Crea una nueva campana de busqueda\n3. Anade las palabras clave de la variante elegida\n4. Copia los 3 titulares y las 2 descripciones en el anuncio de respuesta dinamica\n5. Establece el presupuesto diario de ${budget} EUR\n6. Revisa y activa tu campana`,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

function charCount(value: string, max: number) {
  const len = value.length
  const color = len > max ? '#EF4444' : len > max * 0.85 ? '#F59E0B' : '#4B5563'
  return <span style={{ color, fontSize: 11 }}>{len}/{max}</span>
}

async function copyToClipboard(text: string) {
  try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handle() {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={handle}
      title="Copiar al portapapeles"
      className="shrink-0 p-1 rounded text-[#4B5563] hover:text-[#374151] hover:bg-[#F3F4F6] transition-colors"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}

function FieldCard({ label, value, max, multiline = false }: { label: string; value: string; max: number; multiline?: boolean }) {
  return (
    <div className="border border-[#E5E7EB] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[#374151] uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1.5">
          {charCount(value, max)}
          <CopyButton text={value} />
        </div>
      </div>
      {multiline ? (
        <p className="text-sm text-[#111827] leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm font-medium text-[#111827]">{value}</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [businessId, setBusinessId] = useState('')
  const [plan, setPlan] = useState<string>('basic')
  const [loading, setLoading] = useState(true)

  // Form
  const [platform, setPlatform]           = useState<Platform>('meta')
  const [objective, setObjective]         = useState<Objective>('awareness')
  const [targetAudience, setTargetAudience] = useState('')
  const [budgetDaily, setBudgetDaily]     = useState('')
  const [promotionType, setPromotionType] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [generating, setGenerating]       = useState(false)
  const [generateError, setGenerateError] = useState('')

  // History and current ad
  const [history, setHistory]             = useState<AdCreative[]>([])
  const [currentAd, setCurrentAd]         = useState<AdCreative | null>(null)
  const [activeVariant, setActiveVariant] = useState<'A' | 'B'>('A')
  const [regeneratingImage, setRegeneratingImage] = useState(false)
  const [savingToLibrary, setSavingToLibrary] = useState(false)
  const [librarySaved, setLibrarySaved]   = useState(false)

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

      if (biz.plan === 'basic' || biz.plan === 'pro') return
      fetchHistory(biz.id)
    }
    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchHistory = useCallback(async (bid: string) => {
    const res = await fetch(`/api/ads/list?business_id=${bid}`)
    if (res.ok) setHistory(await res.json())
  }, [])

  // ── Generate ───────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!businessId || !targetAudience.trim() || !budgetDaily) return
    setGenerating(true)
    setGenerateError('')
    setCurrentAd(null)
    setLibrarySaved(false)

    try {
      const res = await fetch('/api/ads/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          platform,
          objective,
          target_audience: targetAudience,
          budget_daily: Number(budgetDaily),
          promotion_type: promotionType || undefined,
          custom_instructions: customInstructions || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setGenerateError(data.error ?? 'Error al generar'); return }

      setCurrentAd(data)
      setActiveVariant('A')
      fetchHistory(businessId)
    } catch {
      setGenerateError('Error de conexion')
    } finally {
      setGenerating(false)
    }
  }

  // ── Regenerate image ───────────────────────────────────────────────────────

  async function handleRegenerateImage() {
    if (!currentAd) return
    setRegeneratingImage(true)
    try {
      const res = await fetch('/api/ads/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ ad_id: currentAd.id, business_id: businessId }),
      })
      const data = await res.json()
      if (res.ok) setCurrentAd(prev => prev ? { ...prev, image_url: data.image_url } : prev)
    } catch (err) {
      console.error('[ads] regenerate image error:', err)
    } finally {
      setRegeneratingImage(false)
    }
  }

  // ── Save to library ────────────────────────────────────────────────────────

  async function handleSaveToLibrary() {
    if (!currentAd?.image_url) return
    setSavingToLibrary(true)
    try {
      await fetch('/api/library/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          image_url: currentAd.image_url,
          type: 'ad',
          title: `Anuncio ${currentAd.platform.toUpperCase()} - ${OBJECTIVE_LABEL[currentAd.objective]}`,
        }),
      })
      setLibrarySaved(true)
    } catch { /* non-fatal */ } finally {
      setSavingToLibrary(false)
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
  if (plan === 'basic' || plan === 'pro') {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <PageHeader title="Anuncios de pago" subtitle="Genera el copy perfecto para tus campanas" />
        <Card>
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full bg-[#F3F4F6] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-[#111827] mb-1">
                El generador de anuncios esta disponible en el plan Business o superior
              </p>
              <p className="text-sm text-[#374151]">
                Genera copy para Meta Ads y Google Ads con variantes A/B e imagen lista para usar.
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

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <PageHeader title="Anuncios de pago" subtitle="Genera el copy perfecto para tus campanas" />

      <div className="flex gap-6 items-start">

        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ flex: '0 0 38%' }}>
          <Card>
            <h2 className="text-base font-semibold text-[#111827] mb-4">Nuevo anuncio</h2>
            <div className="flex flex-col gap-3">

              {/* Platform */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Plataforma</label>
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value as Platform)}
                  disabled={generating}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                >
                  {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Objective */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Objetivo</label>
                <select
                  value={objective}
                  onChange={e => setObjective(e.target.value as Objective)}
                  disabled={generating}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                >
                  {OBJECTIVE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Target audience */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Publico objetivo</label>
                <textarea
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="Ej: Mujeres de 25-45 anos en Sevilla interesadas en restaurantes"
                  rows={2}
                  disabled={generating}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Presupuesto diario (EUR)</label>
                <input
                  type="number"
                  min="1"
                  value={budgetDaily}
                  onChange={e => setBudgetDaily(e.target.value)}
                  placeholder="Ej: 10"
                  disabled={generating}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                />
              </div>

              {/* Promotion type */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Tipo de promocion <span className="text-[#4B5563] font-normal">(opcional)</span>
                </label>
                <select
                  value={promotionType}
                  onChange={e => setPromotionType(e.target.value)}
                  disabled={generating}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                >
                  {PROMOTION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Custom instructions */}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Instrucciones adicionales <span className="text-[#4B5563] font-normal">(opcional)</span>
                </label>
                <textarea
                  value={customInstructions}
                  onChange={e => setCustomInstructions(e.target.value)}
                  placeholder="Ej: Destaca el precio especial del menu del dia"
                  rows={2}
                  disabled={generating}
                  className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#111827] resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-50"
                />
              </div>

              {generateError && (
                <p className="text-sm text-red-600">{generateError}</p>
              )}

              <Button
                onClick={handleGenerate}
                disabled={generating || !targetAudience.trim() || !budgetDaily}
              >
                {generating ? 'Generando anuncio...' : 'Generar anuncio con IA'}
              </Button>
            </div>
          </Card>

          {/* History */}
          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-[#374151]">Anuncios anteriores</p>
              {history.map(ad => {
                const isSelected = currentAd?.id === ad.id
                return (
                  <button
                    key={ad.id}
                    onClick={() => { setCurrentAd(ad); setActiveVariant('A'); setLibrarySaved(false) }}
                    className={[
                      'w-full text-left rounded-xl border p-3 transition-colors',
                      isSelected
                        ? 'border-[#2563EB] bg-[#EFF6FF]'
                        : 'border-[#E5E7EB] bg-white hover:bg-[#F7F8FA]',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium text-[#111827]">
                        {ad.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
                      </span>
                      <Badge variant="success">Listo</Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#374151]">{OBJECTIVE_LABEL[ad.objective]}</span>
                      <span className="text-xs text-[#4B5563]">{formatDate(ad.created_at)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN — Ad result ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ flex: '1 1 0' }}>
          {!currentAd ? (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" />
                </svg>
                <p className="text-sm text-[#4B5563]">Genera un anuncio para ver el resultado aqui</p>
              </div>
            </Card>
          ) : (
            <AdResult
              ad={currentAd}
              activeVariant={activeVariant}
              setActiveVariant={setActiveVariant}
              onRegenerateImage={handleRegenerateImage}
              regeneratingImage={regeneratingImage}
              onSaveToLibrary={handleSaveToLibrary}
              savingToLibrary={savingToLibrary}
              librarySaved={librarySaved}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ad result component ───────────────────────────────────────────────────────

interface AdResultProps {
  ad: AdCreative
  activeVariant: 'A' | 'B'
  setActiveVariant: (v: 'A' | 'B') => void
  onRegenerateImage: () => void
  regeneratingImage: boolean
  onSaveToLibrary: () => void
  savingToLibrary: boolean
  librarySaved: boolean
}

function AdResult({ ad, activeVariant, setActiveVariant, onRegenerateImage, regeneratingImage, onSaveToLibrary, savingToLibrary, librarySaved }: AdResultProps) {
  const variant = ad.variants?.find(v => v.variant === activeVariant) as AdVariant | undefined
  const isMeta = ad.platform === 'meta'
  const metaVariant = variant as MetaVariant | undefined
  const googleVariant = variant as GoogleVariant | undefined

  const instructionsText = PLATFORM_INSTRUCTIONS[ad.platform](
    OBJECTIVE_LABEL[ad.objective],
    ad.budget_daily ?? 0
  )

  return (
    <>
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#111827]">
              {ad.platform === 'meta' ? 'Meta Ads (Facebook e Instagram)' : 'Google Ads'} — {OBJECTIVE_LABEL[ad.objective]}
            </p>
            {ad.target_audience && (
              <p className="text-xs text-[#374151] mt-0.5">{ad.target_audience}</p>
            )}
          </div>
          <Badge variant="success">Listo para usar</Badge>
        </div>
      </Card>

      {/* Image */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-[#111827]">Imagen del anuncio</p>
          <button
            onClick={onRegenerateImage}
            disabled={regeneratingImage}
            className="text-xs text-[#2563EB] hover:underline disabled:opacity-50"
          >
            {regeneratingImage ? 'Regenerando...' : 'Regenerar imagen'}
          </button>
        </div>
        {ad.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.image_url}
            alt="Imagen del anuncio"
            className="w-full aspect-square object-cover rounded-lg"
            style={{ maxWidth: 400, margin: '0 auto', display: 'block' }}
          />
        ) : (
          <div className="w-full aspect-square bg-[#F3F4F6] rounded-lg flex items-center justify-center" style={{ maxWidth: 400 }}>
            <p className="text-sm text-[#4B5563]">
              {regeneratingImage ? 'Generando imagen...' : 'Sin imagen'}
            </p>
          </div>
        )}
      </Card>

      {/* Variant tabs */}
      <Card>
        <div className="flex gap-1 mb-4 bg-[#F3F4F6] rounded-lg p-1">
          {(['A', 'B'] as const).map(v => (
            <button
              key={v}
              onClick={() => setActiveVariant(v)}
              className={[
                'flex-1 text-sm font-medium py-1.5 rounded-md transition-colors',
                activeVariant === v
                  ? 'bg-white text-[#111827] shadow-sm'
                  : 'text-[#374151] hover:text-[#374151]',
              ].join(' ')}
            >
              Variante {v}
            </button>
          ))}
        </div>

        {variant && (
          <div className="flex flex-col gap-3">
            {isMeta && metaVariant ? (
              <>
                <FieldCard label="Titular" value={metaVariant.headline ?? ''} max={30} />
                <FieldCard label="Descripcion" value={metaVariant.description ?? ''} max={30} />
                <FieldCard label="Texto principal" value={metaVariant.body_text ?? ''} max={125} multiline />
                <FieldCard label="CTA" value={metaVariant.cta ?? ''} max={30} />
              </>
            ) : googleVariant ? (
              <>
                <FieldCard label="Titular 1" value={googleVariant.headline_1 ?? ''} max={30} />
                <FieldCard label="Titular 2" value={googleVariant.headline_2 ?? ''} max={30} />
                <FieldCard label="Titular 3" value={googleVariant.headline_3 ?? ''} max={30} />
                <FieldCard label="Descripcion 1" value={googleVariant.description_1 ?? ''} max={90} multiline />
                <FieldCard label="Descripcion 2" value={googleVariant.description_2 ?? ''} max={90} multiline />

                {/* Keywords */}
                {googleVariant.keywords?.length > 0 && (
                  <div className="border border-[#E5E7EB] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[#374151] uppercase tracking-wide">Palabras clave</span>
                      <CopyButton text={googleVariant.keywords.join(', ')} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {googleVariant.keywords.map((kw, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#2563EB] text-xs font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Negative keywords */}
                {ad.negative_keywords && ad.negative_keywords.length > 0 && (
                  <div className="border border-[#E5E7EB] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[#374151] uppercase tracking-wide">Palabras clave negativas</span>
                      <CopyButton text={ad.negative_keywords.join(', ')} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ad.negative_keywords.map((kw, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF2F2] text-[#EF4444] text-xs font-medium">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}

            {/* Rationale */}
            {variant.rationale && (
              <div className="bg-[#F7F8FA] rounded-lg p-4">
                <p className="text-xs font-medium text-[#374151] mb-1">Por que esta variante</p>
                <p className="text-[13px] text-[#374151] leading-relaxed">{variant.rationale}</p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Recommendations */}
      {(ad.audience_suggestion || ad.budget_recommendation || ad.expected_results) && (
        <div className="grid grid-cols-3 gap-3">
          {ad.audience_suggestion && (
            <Card padding="sm">
              <p className="text-xs font-medium text-[#111827] mb-1.5">Segmentacion recomendada</p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{ad.audience_suggestion}</p>
            </Card>
          )}
          {ad.budget_recommendation && (
            <Card padding="sm">
              <p className="text-xs font-medium text-[#111827] mb-1.5">Presupuesto y duracion</p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{ad.budget_recommendation}</p>
            </Card>
          )}
          {ad.expected_results && (
            <Card padding="sm">
              <p className="text-xs font-medium text-[#111827] mb-1.5">Resultados esperados</p>
              <p className="text-[13px] text-[#374151] leading-relaxed">{ad.expected_results}</p>
            </Card>
          )}
        </div>
      )}

      {/* Match type (Google only) */}
      {ad.match_type_recommendation && (
        <Card padding="sm">
          <p className="text-xs font-medium text-[#111827] mb-1.5">Tipo de concordancia recomendado</p>
          <p className="text-[13px] text-[#374151]">{ad.match_type_recommendation}</p>
        </Card>
      )}

      {/* Instructions */}
      <div
        className="rounded-xl border border-[#E5E7EB] p-4"
        style={{ borderLeftWidth: 3, borderLeftColor: '#2563EB' }}
      >
        <p className="text-sm font-medium text-[#111827] mb-2">Como usar este anuncio</p>
        <pre className="text-[13px] text-[#374151] whitespace-pre-wrap font-sans leading-relaxed">
          {instructionsText}
        </pre>
      </div>

      {/* Save to library */}
      {ad.image_url && (
        <div className="pb-2">
          <Button
            variant="secondary"
            onClick={onSaveToLibrary}
            disabled={savingToLibrary || librarySaved}
          >
            {librarySaved ? 'Guardado en biblioteca' : savingToLibrary ? 'Guardando...' : 'Guardar en biblioteca'}
          </Button>
        </div>
      )}
    </>
  )
}


