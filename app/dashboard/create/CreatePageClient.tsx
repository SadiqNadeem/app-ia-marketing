'use client'

import { useState } from 'react'
import { ContentControls } from './ContentControls'
import { LivePreview } from './LivePreview'
import { AISuggestionsPanel } from './AISuggestionsPanel'
import type { ContentType, VisualStyle } from './ContentControls'
import type { PreviewData } from './preview-types'
import type { Business, SocialPlatform, PromotionType } from '@/types'

interface Variant extends PreviewData {
  cta: string
  imagePrompt?: string
}

interface CreatePageClientProps {
  business: Business
  initialPromotionType?: PromotionType
}

export function CreatePageClient({ business, initialPromotionType }: CreatePageClientProps) {
  const [contentType, setContentType] = useState<ContentType>(
    initialPromotionType ? 'promotion' : 'post'
  )
  const [platform, setPlatform] = useState<SocialPlatform>('instagram')
  const [visualStyle, setVisualStyle] = useState<VisualStyle>('moderno')
  const [promotionType, setPromotionType] = useState<PromotionType>(
    initialPromotionType ?? 'oferta_2x1'
  )
  const [customInstructions, setCustomInstructions] = useState('')

  const [variants, setVariants] = useState<Variant[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [improving, setImproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Per-variant editable fields ──────────────────────────────
  const [editedTexts, setEditedTexts] = useState<string[]>([])
  const [editedHashtags, setEditedHashtags] = useState<string[][]>([])
  const [editedCtas, setEditedCtas] = useState<string[]>([])
  const [editedImages, setEditedImages] = useState<(string | null)[]>([])
  const [editedImagePrompts, setEditedImagePrompts] = useState<string[]>([])
  const [manuallyEdited, setManuallyEdited] = useState<boolean[]>([])

  const activeVariant = variants[selectedIdx] ?? null
  const activeEditedText = editedTexts[selectedIdx] ?? activeVariant?.text ?? ''
  const activeEditedHashtags = editedHashtags[selectedIdx] ?? activeVariant?.hashtags ?? []
  const activeEditedImage =
    editedImages[selectedIdx] !== undefined
      ? editedImages[selectedIdx]
      : activeVariant?.imageUrl ?? null

  const previewData: PreviewData | null = activeVariant
    ? {
        text: activeEditedText,
        hashtags: activeEditedHashtags,
        imageUrl: activeEditedImage,
      }
    : null

  function buildPayload(extraInstructions?: string) {
    const styleNote = `Estilo: ${visualStyle}`
    const combined = [customInstructions.trim(), extraInstructions, styleNote]
      .filter(Boolean)
      .join('. ')

    return {
      business_id: business.id,
      type: contentType,
      platform,
      promotion_type: contentType === 'promotion' ? promotionType : undefined,
      custom_instructions: combined || undefined,
    }
  }

  async function fetchVariants(payload: object): Promise<Variant[] | null> {
    try {
      const res = await fetch('/api/generate/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) return null

      const toVariant = (v: {
        caption?: string; text?: string; hashtags?: string[]; cta?: string;
        image_url?: string | null; image_prompt?: string
      }): Variant => ({
        text:        (v.caption ?? v.text ?? '').trim(),
        hashtags:    v.hashtags ?? [],
        cta:         v.cta ?? '',
        imageUrl:    v.image_url ?? null,
        imagePrompt: v.image_prompt ?? '',
      })

      const main = toVariant(data)
      if (!main.text) return null

      const extras: Variant[] = Array.isArray(data.variations)
        ? data.variations.map((v: { caption?: string; hashtags?: string[]; cta?: string; image_prompt?: string }) =>
            toVariant({ caption: v.caption, hashtags: v.hashtags, cta: v.cta, image_prompt: v.image_prompt })
          ).filter((v: Variant) => v.text.length > 0)
        : []

      return [main, ...extras]
    } catch {
      return null
    }
  }

  function initEditedState(result: Variant[]) {
    setEditedTexts(result.map((v) => v.text))
    setEditedHashtags(result.map((v) => v.hashtags))
    setEditedCtas(result.map((v) => v.cta))
    setEditedImages(result.map((v) => v.imageUrl ?? null))
    setEditedImagePrompts(result.map((v) => v.imagePrompt ?? ''))
    setManuallyEdited(result.map(() => false))
  }

  async function generate() {
    setLoading(true)
    setError(null)
    setVariants([])
    setSelectedIdx(0)

    const result = await fetchVariants(buildPayload())

    if (!result || result.length === 0) {
      setError('No se pudo generar el contenido. Intentalo de nuevo.')
    } else {
      setVariants(result)
      initEditedState(result)
    }

    setLoading(false)
  }

  async function improve(instruction?: string) {
    if (!activeVariant) return
    setImproving(true)

    const base = instruction
      ? `${instruction}. Texto actual: "${activeEditedText}"`
      : `Mejora el siguiente texto haciendolo mas atractivo y persuasivo, mantiendo el tono apropiado: "${activeEditedText}"`

    const result = await fetchVariants(buildPayload(base))

    if (result && result.length > 0) {
      const updated = [...variants]
      updated[selectedIdx] = result[0]
      setVariants(updated)

      const updatedTexts = [...editedTexts]
      updatedTexts[selectedIdx] = result[0].text
      setEditedTexts(updatedTexts)

      // Update hashtags + cta from improved result, keep edited image
      const updatedHashtags = [...editedHashtags]
      updatedHashtags[selectedIdx] = result[0].hashtags
      setEditedHashtags(updatedHashtags)

      const updatedCtas = [...editedCtas]
      updatedCtas[selectedIdx] = result[0].cta
      setEditedCtas(updatedCtas)

      // Keep existing image prompt if user has edited it
      const updatedImagePrompts = [...editedImagePrompts]
      if (!manuallyEdited[selectedIdx]) {
        updatedImagePrompts[selectedIdx] = result[0].imagePrompt ?? ''
        setEditedImagePrompts(updatedImagePrompts)
      }
    }

    setImproving(false)
  }

  // ── Handlers ─────────────────────────────────────────────────

  function markManual(idx: number) {
    const me = [...manuallyEdited]
    me[idx] = true
    setManuallyEdited(me)
  }

  function handleTextChange(idx: number, value: string) {
    const updated = [...editedTexts]
    updated[idx] = value
    setEditedTexts(updated)
    markManual(idx)
  }

  function handleHashtagsChange(idx: number, value: string[]) {
    const updated = [...editedHashtags]
    updated[idx] = value
    setEditedHashtags(updated)
    markManual(idx)
  }

  function handleCtaChange(idx: number, value: string) {
    const updated = [...editedCtas]
    updated[idx] = value
    setEditedCtas(updated)
    markManual(idx)
  }

  function handleImageChange(idx: number, url: string | null) {
    const updated = [...editedImages]
    updated[idx] = url
    setEditedImages(updated)
    markManual(idx)
  }

  function handleImagePromptChange(idx: number, value: string) {
    const updated = [...editedImagePrompts]
    updated[idx] = value
    setEditedImagePrompts(updated)
  }

  function handleDuplicate() {
    if (!activeVariant) return
    const copy: Variant = {
      ...activeVariant,
      text: editedTexts[selectedIdx] ?? activeVariant.text,
    }
    setVariants((prev) => [...prev, copy])
    setEditedTexts((prev) => [...prev, copy.text])
    setEditedHashtags((prev) => [...prev, editedHashtags[selectedIdx] ?? copy.hashtags])
    setEditedCtas((prev) => [...prev, editedCtas[selectedIdx] ?? copy.cta])
    setEditedImages((prev) => [...prev, editedImages[selectedIdx] ?? copy.imageUrl ?? null])
    setEditedImagePrompts((prev) => [...prev, editedImagePrompts[selectedIdx] ?? copy.imagePrompt ?? ''])
    setManuallyEdited((prev) => [...prev, manuallyEdited[selectedIdx] ?? false])
    setSelectedIdx(variants.length)
  }

  async function handleSaveTemplate() {
    if (!activeVariant) return
    try {
      await fetch('/api/library/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: business.id,
          text: activeEditedText,
          hashtags: activeEditedHashtags,
          platform,
          type: contentType,
        }),
      })
    } catch {
      // Non-critical action.
    }
  }

  return (
    <div className="h-full w-full bg-[#F0EDE8] p-3 md:p-4 lg:p-6">
      <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="order-1 min-h-[500px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8F6F2] p-3 md:p-4 lg:order-2 lg:col-span-2 lg:row-span-2 lg:min-h-0">
          {error && (
            <div
              style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#FDE8E8',
                border: '1px solid #FECACA',
                fontSize: 12,
                color: '#E02424',
              }}
            >
              {error}
            </div>
          )}
          <LivePreview
            data={previewData}
            platform={platform}
            contentType={contentType}
            businessName={business.name}
            logoUrl={business.logo_url}
            primaryColor={business.primary_color ?? '#1A56DB'}
            isExample={!activeVariant}
          />
        </div>

        <div className="order-2 min-h-[420px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white lg:order-1 lg:col-span-1 lg:row-span-1 lg:min-h-0">
          <ContentControls
            contentType={contentType}
            platform={platform}
            visualStyle={visualStyle}
            promotionType={promotionType}
            customInstructions={customInstructions}
            loading={loading}
            onContentTypeChange={setContentType}
            onPlatformChange={setPlatform}
            onVisualStyleChange={setVisualStyle}
            onPromotionTypeChange={setPromotionType}
            onInstructionsChange={setCustomInstructions}
            onGenerate={generate}
          />
        </div>

        <div className="order-3 min-h-[360px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white lg:col-span-1 lg:row-span-1 lg:min-h-0">
          <AISuggestionsPanel
            variants={variants}
            selectedIdx={selectedIdx}
            editedTexts={editedTexts}
            editedHashtags={editedHashtags}
            editedCtas={editedCtas}
            editedImages={editedImages}
            editedImagePrompts={editedImagePrompts}
            manuallyEdited={manuallyEdited}
            loading={loading}
            improving={improving}
            businessId={business.id}
            onSelectVariant={setSelectedIdx}
            onTextChange={handleTextChange}
            onHashtagsChange={handleHashtagsChange}
            onCtaChange={handleCtaChange}
            onImageChange={handleImageChange}
            onImagePromptChange={handleImagePromptChange}
            onRegenerate={generate}
            onImprove={improve}
            onDuplicate={handleDuplicate}
            onSaveTemplate={handleSaveTemplate}
          />
        </div>
      </div>
    </div>
  )
}
