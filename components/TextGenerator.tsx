'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { LanguageSelector } from '@/components/LanguageSelector'
import type { SocialPlatform, PromotionType } from '@/types'

type ContentType = 'post' | 'story' | 'promotion' | 'hashtags'
type LangCode = 'es' | 'en' | 'fr' | 'de' | 'it' | 'pt' | 'ar'

export interface GeneratedResult {
  text: string
  hashtags: string[]
  cta: string
}

interface TextGeneratorProps {
  businessId: string
  onGenerated: (result: GeneratedResult) => void
  onPlatformChange?: (platform: SocialPlatform) => void
  initialPromotionType?: PromotionType
}

// ── Platform char limits ──────────────────────────────────────────
const CHAR_LIMITS: Partial<Record<SocialPlatform, number>> = {
  instagram: 2200,
  tiktok: 150,
}

// ── Select option sets ────────────────────────────────────────────
const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'story', label: 'Historia' },
  { value: 'promotion', label: 'Promocion' },
  { value: 'hashtags', label: 'Hashtags' },
]

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const PROMOTION_TYPES: { value: PromotionType; label: string }[] = [
  { value: 'oferta_2x1', label: 'Oferta 2x1' },
  { value: 'menu_dia', label: 'Menu del dia' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'sorteo', label: 'Sorteo' },
  { value: 'evento', label: 'Evento' },
  { value: 'nuevo_producto', label: 'Nuevo producto' },
  { value: 'black_friday', label: 'Black Friday' },
  { value: 'navidad', label: 'Navidad' },
  { value: 'san_valentin', label: 'San Valentin' },
  { value: 'halloween', label: 'Halloween' },
  { value: 'apertura', label: 'Gran apertura' },
  { value: 'aniversario', label: 'Aniversario' },
]

const LANG_LABELS: Record<LangCode, string> = {
  es: 'ES',
  en: 'EN',
  fr: 'FR',
  de: 'DE',
  it: 'IT',
  pt: 'PT',
  ar: 'AR',
}

const selectClass =
  'w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-primary bg-brand-surface outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-150'

export function TextGenerator({ businessId, onGenerated, onPlatformChange, initialPromotionType }: TextGeneratorProps) {
  // Form state
  const [contentType, setContentType] = useState<ContentType>(
    initialPromotionType ? 'promotion' : 'post'
  )
  const [platform, setPlatform] = useState<SocialPlatform>('instagram')
  const [promotionType, setPromotionType] = useState<PromotionType>(
    initialPromotionType ?? 'oferta_2x1'
  )
  const [customInstructions, setCustomInstructions] = useState('')

  // Result state
  const [result, setResult] = useState<GeneratedResult | null>(null)
  const [editedText, setEditedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Translation state
  const [translateOpen, setTranslateOpen] = useState(false)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([])
  const [translating, setTranslating] = useState(false)
  const [translations, setTranslations] = useState<Partial<Record<LangCode, string>>>({})
  const [activeTab, setActiveTab] = useState<LangCode>('es')
  const [translateError, setTranslateError] = useState<string | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const charLimit = CHAR_LIMITS[platform]

  // Current tab text (ES uses editedText, others use translations)
  const currentText = activeTab === 'es' ? editedText : (translations[activeTab] ?? '')
  const charsLeft = charLimit !== undefined ? charLimit - currentText.length : null

  // Available tabs: always ES + translated ones
  const availableTabs: LangCode[] = [
    'es',
    ...(['en', 'fr', 'de', 'it', 'pt', 'ar'] as LangCode[]).filter(
      (l) => translations[l] !== undefined
    ),
  ]

  async function generate() {
    setError(null)
    setLoading(true)
    // Reset translations when regenerating
    setTranslations({})
    setActiveTab('es')
    setTranslateOpen(false)
    setSelectedLanguages([])

    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          type: contentType,
          platform,
          promotion_type: contentType === 'promotion' ? promotionType : undefined,
          custom_instructions: customInstructions.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al generar el texto')
        return
      }

      setResult(data)
      setEditedText(data.text)
      onGenerated(data)
    } catch {
      setError('Error de conexion. Comprueba tu red e intentalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleTranslate() {
    if (translateOpen) {
      setTranslateOpen(false)
      return
    }
    // Check plan
    try {
      const res = await fetch(`/api/plans/check?feature=translate&business_id=${businessId}`)
      const data = await res.json()
      if (!data.allowed) {
        setShowUpgradeModal(true)
        return
      }
    } catch {
      // Allow if check fails
    }
    setTranslateOpen(true)
  }

  async function handleTranslate() {
    if (selectedLanguages.length === 0) return
    setTranslateError(null)
    setTranslating(true)

    try {
      const res = await fetch('/api/generate/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          text: editedText,
          source_language: 'es',
          target_languages: selectedLanguages,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setTranslateError(data.error ?? 'Error al traducir')
        return
      }

      setTranslations(data.translations ?? {})
      // Switch to first translated tab
      if (selectedLanguages[0]) {
        setActiveTab(selectedLanguages[0] as LangCode)
      }
      setTranslateOpen(false)
    } catch {
      setTranslateError('Error de conexion. Intentalo de nuevo.')
    } finally {
      setTranslating(false)
    }
  }

  function handleUseText() {
    if (!result) return
    onGenerated({ ...result, text: currentText })
  }

  function handleTabTextChange(val: string) {
    if (activeTab === 'es') {
      setEditedText(val)
    } else {
      setTranslations((prev) => ({ ...prev, [activeTab]: val }))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Generator form ────────────────────────────────────── */}
      <Card>
        <div className="flex flex-col gap-5">
          <PageHeader
            title="Generar texto"
            subtitle="La IA escribe el contenido adaptado a tu negocio"
          />

          {error && (
            <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
              {error}
            </Badge>
          )}

          {/* Tipo de contenido */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-text-primary">
              Tipo de contenido
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as ContentType)}
              className={selectClass}
            >
              {CONTENT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Plataforma */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-text-primary">Plataforma</label>
            <select
              value={platform}
              onChange={(e) => {
                const p = e.target.value as SocialPlatform
                setPlatform(p)
                onPlatformChange?.(p)
              }}
              className={selectClass}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Tipo de promocion — solo si type=promotion */}
          {contentType === 'promotion' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-brand-text-primary">
                Tipo de promocion
              </label>
              <select
                value={promotionType}
                onChange={(e) => setPromotionType(e.target.value as PromotionType)}
                className={selectClass}
              >
                {PROMOTION_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Instrucciones adicionales */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-text-primary">
              Instrucciones adicionales{' '}
              <span className="font-normal text-brand-text-secondary">(opcional)</span>
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Ejemplo: menciona que el descuento es solo este fin de semana"
              rows={3}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-primary placeholder:text-brand-text-secondary bg-brand-surface outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-150 resize-none"
            />
          </div>

          <Button onClick={generate} loading={loading} className="w-full">
            {loading ? 'Generando...' : 'Generar con IA'}
          </Button>
        </div>
      </Card>

      {/* ── Result panel ──────────────────────────────────────── */}
      {result && (
        <Card className="bg-brand-bg">
          <div className="flex flex-col gap-4">

            {/* Language tabs */}
            {availableTabs.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                {availableTabs.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveTab(lang)}
                    style={{
                      fontSize: '12px',
                      fontWeight: activeTab === lang ? 600 : 400,
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: '1px solid',
                      borderColor: activeTab === lang ? '#2563EB' : '#E5E7EB',
                      backgroundColor: activeTab === lang ? '#EFF6FF' : '#ffffff',
                      color: activeTab === lang ? '#2563EB' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                  >
                    {LANG_LABELS[lang]}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-brand-text-primary">
                {availableTabs.length > 1 ? `Texto (${LANG_LABELS[activeTab]})` : 'Texto generado'}
              </span>
              {charsLeft !== null && (
                <span
                  className={[
                    'text-xs tabular-nums',
                    charsLeft < 0 ? 'text-brand-error' : 'text-brand-text-secondary',
                  ].join(' ')}
                >
                  {charsLeft} caracteres restantes
                </span>
              )}
            </div>

            {/* Editable textarea — RTL for Arabic */}
            <textarea
              value={currentText}
              onChange={(e) => handleTabTextChange(e.target.value)}
              dir={activeTab === 'ar' ? 'rtl' : 'ltr'}
              rows={8}
              style={activeTab === 'ar' ? { textAlign: 'right' } : undefined}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-primary bg-brand-surface outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-150 resize-y"
            />

            {/* Hashtag pills — only on ES tab */}
            {activeTab === 'es' && result.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-full bg-brand-border text-brand-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Translation section */}
            <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: '#374151',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Traduccion automatica
                </span>
                <button
                  onClick={handleToggleTranslate}
                  style={{
                    fontSize: '12px',
                    color: translateOpen ? '#374151' : '#2563EB',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  className="hover:underline"
                >
                  {translateOpen ? 'Cancelar' : 'Traducir a otros idiomas'}
                </button>
              </div>

              {translateOpen && (
                <div className="flex flex-col gap-3">
                  <LanguageSelector
                    selectedLanguages={selectedLanguages}
                    onChange={setSelectedLanguages}
                    maxSelection={4}
                  />

                  {translateError && (
                    <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
                      {translateError}
                    </Badge>
                  )}

                  <Button
                    variant="secondary"
                    onClick={handleTranslate}
                    loading={translating}
                    disabled={selectedLanguages.length === 0}
                    className="w-full"
                  >
                    {translating
                      ? `Traduciendo a ${selectedLanguages.length} ${selectedLanguages.length === 1 ? 'idioma' : 'idiomas'}...`
                      : 'Traducir'}
                  </Button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={generate}
                loading={loading}
                className="flex-1"
              >
                Regenerar
              </Button>
              <Button onClick={handleUseText} className="flex-1">
                Usar este texto
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Upgrade modal */}
      <Dialog
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        title="Funcion no disponible en tu plan"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#374151]">
            La traduccion automatica esta disponible en el plan Pro o superior.
            Mejora tu plan para traducir contenido a ingles, frances, aleman, italiano, portugues y arabe con un clic.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Ahora no
            </Button>
            <Button
              onClick={() => { setShowUpgradeModal(false); window.location.href = '/pricing' }}
              className="flex-1"
            >
              Ver planes
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}


