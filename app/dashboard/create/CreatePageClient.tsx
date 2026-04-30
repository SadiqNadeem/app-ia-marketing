'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { usePosts } from '@/components/providers/PostsProvider'
import { ContentControls } from './ContentControls'
import { LivePreview } from './LivePreview'
import { AISuggestionsPanel } from './AISuggestionsPanel'
import { PublishModal } from './PublishModal'
import { UploadTab } from './UploadTab'
import type { DraftInitData } from './types'
import type { ContentType, VisualStyle } from './ContentControls'
import type { PreviewData } from './preview-types'
import type { Business, Post, PromotionType, SocialPlatform } from '@/types'

type PageTab = 'upload' | 'create'

interface Variant extends PreviewData {
  cta: string
  imagePrompt?: string
}

interface CreatePageClientProps {
  business: Business
  userId: string
  isAdmin?: boolean
  connectedNetworks: Array<{ platform: SocialPlatform; platform_username: string | null; is_professional: boolean | null }>
  initialPromotionType?: PromotionType
  initialExampleDescription?: string
  initialDraft?: DraftInitData
  initialTemplate?: { id: string; title: string; fabric_json: object; canvas_width: number; canvas_height: number }
  initialTab?: PageTab
}

type ToastState = { message: string; type: 'success' | 'error' } | null

const VALID_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'google', 'whatsapp']

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

function asSocialPlatforms(value: unknown, fallback: SocialPlatform): SocialPlatform[] {
  if (!Array.isArray(value)) return [fallback]
  const clean = value.filter(
    (entry): entry is SocialPlatform =>
      typeof entry === 'string' && VALID_PLATFORMS.includes(entry as SocialPlatform)
  )
  return clean.length > 0 ? clean : [fallback]
}

function normalizeInsertedPost(
  row: Record<string, unknown>,
  fallback: {
    businessId: string
    text: string
    hashtags: string[]
    imageUrl: string | null
    platform: SocialPlatform
    promotionType: PromotionType | null
    userId: string
  }
): Post {
  const fallbackCreatedAt = new Date().toISOString()
  const contentText =
    typeof row.content_text === 'string'
      ? row.content_text
      : typeof row.content === 'string'
      ? row.content
      : fallback.text

  return {
    id: typeof row.id === 'string' ? row.id : crypto.randomUUID(),
    business_id: typeof row.business_id === 'string' ? row.business_id : fallback.businessId,
    user_id: typeof row.user_id === 'string' ? row.user_id : fallback.userId,
    content: typeof row.content === 'string' ? row.content : contentText,
    content_text: contentText,
    image_url: typeof row.image_url === 'string' ? row.image_url : fallback.imageUrl,
    video_url: typeof row.video_url === 'string' ? row.video_url : null,
    platforms: asSocialPlatforms(row.platforms, fallback.platform),
    status:
      row.status === 'draft' || row.status === 'publishing' || row.status === 'scheduled' ||
      row.status === 'published' || row.status === 'failed'
        ? row.status
        : 'draft',
    scheduled_at: typeof row.scheduled_at === 'string' ? row.scheduled_at : null,
    published_at: typeof row.published_at === 'string' ? row.published_at : null,
    promotion_type:
      typeof row.promotion_type === 'string'
        ? (row.promotion_type as PromotionType)
        : fallback.promotionType,
    is_suggestion: typeof row.is_suggestion === 'boolean' ? row.is_suggestion : false,
    suggestion_date: typeof row.suggestion_date === 'string' ? row.suggestion_date : null,
    title: typeof row.title === 'string' ? row.title : null,
    hashtags: asStringArray(row.hashtags).length > 0 ? asStringArray(row.hashtags) : fallback.hashtags,
    error_message: typeof row.error_message === 'string' ? row.error_message : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : fallbackCreatedAt,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    cta: typeof row.cta === 'string' ? row.cta : null,
    image_prompt: typeof row.image_prompt === 'string' ? row.image_prompt : null,
    visual_style: typeof row.visual_style === 'string' ? row.visual_style : null,
    extra_context: typeof row.extra_context === 'string' ? row.extra_context : null,
  }
}

export function CreatePageClient({
  business,
  userId,
  isAdmin = false,
  connectedNetworks,
  initialPromotionType,
  initialExampleDescription,
  initialDraft,
  initialTemplate,
  initialTab = 'upload',
}: CreatePageClientProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { addOrUpdatePost, setLastDraftFromPost, lastDraft, refreshPosts } = usePosts()

  const [activeTab, setActiveTab] = useState<PageTab>(initialTab)

  const [contentType, setContentType] = useState<ContentType>(
    initialDraft?.promotionType || initialPromotionType ? 'promotion' : 'post'
  )
  const [platform, setPlatform] = useState<SocialPlatform>(
    initialDraft?.platform ?? 'instagram'
  )
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(
    (initialDraft?.visualStyle as VisualStyle | undefined) ?? 'moderno'
  )
  const [promotionType, setPromotionType] = useState<PromotionType>(
    initialDraft?.promotionType ?? initialPromotionType ?? 'oferta_2x1'
  )
  const [customInstructions, setCustomInstructions] = useState(
    initialDraft?.extraContext ?? initialExampleDescription ?? ''
  )

  const [variants, setVariants] = useState<Variant[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const [improving, setImproving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)

  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showPlatformModal, setShowPlatformModal] = useState(false)
  const [savedDraftPost, setSavedDraftPost] = useState<Post | null>(null)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(initialDraft?.id ?? null)

  const [editedTexts, setEditedTexts] = useState<string[]>([])
  const [editedHashtags, setEditedHashtags] = useState<string[][]>([])
  const [editedCtas, setEditedCtas] = useState<string[]>([])
  const [editedImages, setEditedImages] = useState<(string | null)[]>([])
  const [editedImagePrompts, setEditedImagePrompts] = useState<string[]>([])
  const [manuallyEdited, setManuallyEdited] = useState<boolean[]>([])

  // Load initial draft into the editor on mount
  useEffect(() => {
    if (!initialDraft?.content) return
    const restoredVariant: Variant = {
      text: initialDraft.content,
      hashtags: initialDraft.hashtags,
      cta: initialDraft.cta,
      imageUrl: initialDraft.imageUrl,
      imagePrompt: initialDraft.imagePrompt,
    }
    setVariants([restoredVariant])
    initEditedState([restoredVariant])
    setSelectedIdx(0)
    setError(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeVariant = variants[selectedIdx] ?? null
  const activeEditedText = editedTexts[selectedIdx] ?? activeVariant?.text ?? ''
  const activeEditedHashtags = editedHashtags[selectedIdx] ?? activeVariant?.hashtags ?? []
  const activeEditedImage =
    editedImages[selectedIdx] !== undefined ? editedImages[selectedIdx] : activeVariant?.imageUrl ?? null

  const previewData: PreviewData | null = activeVariant
    ? { text: activeEditedText, hashtags: activeEditedHashtags, imageUrl: activeEditedImage }
    : null

  function pushToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
  }

  useEffect(() => {
    if (!toast) return
    const timeoutId = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  function buildPayload(extraInstructions?: string) {
    const styleNote = `Estilo: ${visualStyle}`
    const combined = [customInstructions.trim(), extraInstructions, styleNote].filter(Boolean).join('. ')
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
        text: (v.caption ?? v.text ?? '').trim(),
        hashtags: v.hashtags ?? [],
        cta: v.cta ?? '',
        imageUrl: v.image_url ?? null,
        imagePrompt: v.image_prompt ?? '',
      })

      const main = toVariant(data)
      if (!main.text) return null

      const extras: Variant[] = Array.isArray(data.variations)
        ? data.variations
            .map((v: { caption?: string; hashtags?: string[]; cta?: string; image_prompt?: string }) =>
              toVariant({ caption: v.caption, hashtags: v.hashtags, cta: v.cta, image_prompt: v.image_prompt })
            )
            .filter((v: Variant) => v.text.length > 0)
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

  // INSERT a brand-new draft (with fallback chain for legacy schemas)
  async function insertDraftInDb(variant: Variant): Promise<Post | null> {
    const text = variant.text.trim()
    if (!text) return null

    const normalizedPromotionType = contentType === 'promotion' ? promotionType : null
    const hashtags = variant.hashtags ?? []
    const imageUrl = variant.imageUrl ?? null

    const dropColumns = (payload: Record<string, unknown>, columns: string[]): Record<string, unknown> => {
      const next = { ...payload }
      for (const column of columns) delete next[column]
      return next
    }

    const basePayload: Record<string, unknown> = {
      business_id: business.id,
      user_id: userId,
      content: text,
      content_text: text,
      media_url: imageUrl,
      image_url: imageUrl,
      video_url: null,
      platforms: [platform],
      platform,
      status: 'draft',
      promotion_type: normalizedPromotionType,
      is_suggestion: false,
      suggestion_date: null,
      title: null,
      hashtags,
      scheduled_at: null,
      published_at: null,
      cta: variant.cta ?? '',
      image_prompt: variant.imagePrompt ?? '',
      visual_style: visualStyle,
      extra_context: customInstructions,
    }

    const attempts: Record<string, unknown>[] = [
      basePayload,
      dropColumns(basePayload, ['media_url']),
      dropColumns(basePayload, ['media_url', 'platform']),
      dropColumns(basePayload, ['media_url', 'platform', 'cta', 'image_prompt', 'visual_style', 'extra_context']),
      dropColumns(basePayload, ['media_url', 'platform', 'user_id', 'cta', 'image_prompt', 'visual_style', 'extra_context']),
    ]

    let lastMsg = 'No se pudo guardar el borrador.'
    for (const payload of attempts) {
      const { data, error: insertError } = await supabase.from('posts').insert([payload]).select('*').single()
      if (!insertError && data) {
        return normalizeInsertedPost(data as Record<string, unknown>, {
          businessId: business.id, text, hashtags, imageUrl, platform,
          promotionType: normalizedPromotionType, userId,
        })
      }
      if (insertError?.message) lastMsg = insertError.message
    }

    throw new Error(lastMsg)
  }

  // UPDATE an existing draft
  async function updateDraftInDb(id: string, variant: Variant): Promise<Post | null> {
    const text = (variant.text ?? '').trim()
    const normalizedPromotionType = contentType === 'promotion' ? promotionType : null
    const hashtags = variant.hashtags ?? []
    const imageUrl = variant.imageUrl ?? null

    const basePayload: Record<string, unknown> = {
      content: text,
      content_text: text,
      image_url: imageUrl,
      media_url: imageUrl,
      hashtags,
      platforms: [platform],
      platform,
      promotion_type: normalizedPromotionType,
      cta: variant.cta ?? '',
      image_prompt: variant.imagePrompt ?? '',
      visual_style: visualStyle,
      extra_context: customInstructions,
    }

    // Try with all new fields first, fall back without them if columns don't exist yet
    for (const payload of [
      basePayload,
      { ...basePayload, cta: undefined, image_prompt: undefined, visual_style: undefined, extra_context: undefined },
    ]) {
      const { data, error } = await supabase
        .from('posts')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single()

      if (!error && data) {
        return normalizeInsertedPost(data as Record<string, unknown>, {
          businessId: business.id, text, hashtags, imageUrl, platform,
          promotionType: normalizedPromotionType, userId,
        })
      }
    }

    return null
  }

  // Upsert: update if we have an existing ID, otherwise insert
  async function upsertDraftVariant(variant: Variant): Promise<Post | null> {
    const existingId = currentDraftId ?? savedDraftPost?.id ?? null
    if (existingId) {
      return updateDraftInDb(existingId, variant)
    }
    return insertDraftInDb(variant)
  }

  function getCurrentVariantForDraft(): Variant | null {
    if (!activeVariant) return null
    return {
      ...activeVariant,
      text: activeEditedText || activeVariant.text,
      hashtags: activeEditedHashtags.length > 0 ? activeEditedHashtags : activeVariant.hashtags,
      cta: editedCtas[selectedIdx] ?? activeVariant.cta,
      imageUrl: activeEditedImage ?? activeVariant.imageUrl ?? null,
      imagePrompt: editedImagePrompts[selectedIdx] ?? activeVariant.imagePrompt ?? '',
    }
  }

  async function ensureDraftPost(): Promise<Post | null> {
    const variant = getCurrentVariantForDraft()
    if (!variant) return null

    const post = await upsertDraftVariant(variant)
    if (post) {
      addOrUpdatePost(post)
      setLastDraftFromPost(post)
      setSavedDraftPost(post)
      if (!currentDraftId) setCurrentDraftId(post.id)
    }
    return post
  }

  async function generate() {
    setLoading(true)
    setError(null)
    setVariants([])
    setSelectedIdx(0)

    try {
      const result = await fetchVariants(buildPayload())
      if (!result || result.length === 0) {
        setError('No se pudo generar el contenido. Intentalo de nuevo.')
        return
      }

      setVariants(result)
      initEditedState(result)

      // Pass result[0] directly — state updates are async so can't use getCurrentVariantForDraft here
      let insertedPost: Post | null = null
      const existingId = currentDraftId ?? savedDraftPost?.id ?? null
      if (existingId) {
        insertedPost = await updateDraftInDb(existingId, result[0])
        if (!insertedPost) insertedPost = await insertDraftInDb(result[0])
      } else {
        insertedPost = await insertDraftInDb(result[0])
      }

      if (!insertedPost) {
        setError('Se genero el texto, pero no se pudo guardar como borrador.')
        pushToast('No se pudo guardar el borrador en Supabase.', 'error')
        return
      }

      addOrUpdatePost(insertedPost)
      setLastDraftFromPost(insertedPost)
      setSavedDraftPost(insertedPost)
      if (!currentDraftId) setCurrentDraftId(insertedPost.id)
      setShowPublishModal(true)
      pushToast('Post guardado como borrador.', 'success')
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? `Error al guardar el borrador: ${generateError.message}`
          : 'Error al guardar el borrador.'
      )
      pushToast('No se pudo guardar el post generado.', 'error')
    } finally {
      setLoading(false)
    }
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

      const updatedHashtags = [...editedHashtags]
      updatedHashtags[selectedIdx] = result[0].hashtags
      setEditedHashtags(updatedHashtags)

      const updatedCtas = [...editedCtas]
      updatedCtas[selectedIdx] = result[0].cta
      setEditedCtas(updatedCtas)

      const updatedImagePrompts = [...editedImagePrompts]
      if (!manuallyEdited[selectedIdx]) {
        updatedImagePrompts[selectedIdx] = result[0].imagePrompt ?? ''
        setEditedImagePrompts(updatedImagePrompts)
      }
    }

    setImproving(false)
  }

  async function handleSaveDraftInline() {
    try {
      const ensured = await ensureDraftPost()
      if (!ensured) {
        pushToast('No hay contenido para guardar como borrador.', 'error')
        return
      }
      pushToast('Borrador guardado.', 'success')
    } catch (draftError) {
      pushToast(
        draftError instanceof Error ? `No se pudo guardar: ${draftError.message}` : 'No se pudo guardar el borrador.',
        'error'
      )
    }
  }

  function openPlatformModal() {
    if (!activeVariant) {
      pushToast('Genera contenido primero.', 'error')
      return
    }
    setShowPlatformModal(true)
  }

  async function handlePublishWithPlatforms(platforms: SocialPlatform[]) {
    const draftPost = await ensureDraftPost()
    if (!draftPost) {
      pushToast('No hay un borrador listo para publicar.', 'error')
      return
    }

    setPublishing(true)

    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ post_id: draftPost.id, platforms }),
      })

      const data = await response.json()
      if (!response.ok) {
        pushToast(data?.error ?? 'No se pudo publicar el post.', 'error')
        return
      }

      const results = (data?.results ?? {}) as Record<string, { success?: boolean; error?: string }>
      const failedPlatforms = Object.entries(results)
        .filter(([, value]) => !value?.success)
        .map(([key, value]) => `${key}${value?.error ? `: ${value.error}` : ''}`)

      if (failedPlatforms.length > 0) {
        pushToast(`Error al publicar: ${failedPlatforms.join(' | ')}`, 'error')
      } else if (data?.success === false && data?.error) {
        pushToast(data.error, 'error')
      } else {
        pushToast('Post publicado correctamente.', 'success')
        setSavedDraftPost(null)
        setCurrentDraftId(null)
        setShowPlatformModal(false)
        setShowPublishModal(false)
      }

      await refreshPosts()
    } catch {
      pushToast('Error de conexion al publicar.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  function handleSaveDraftFromModal() {
    setShowPublishModal(false)
    pushToast('Borrador guardado. Puedes verlo en Borradores.', 'success')
  }

  function markManual(idx: number) {
    const updated = [...manuallyEdited]
    updated[idx] = true
    setManuallyEdited(updated)
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
    const copy: Variant = { ...activeVariant, text: editedTexts[selectedIdx] ?? activeVariant.text }
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
      pushToast('Plantilla guardada.', 'success')
    } catch {
      pushToast('No se pudo guardar la plantilla.', 'error')
    }
  }

  // Navigate to create?id=... to properly restore full draft data from Supabase
  function restoreLastDraft() {
    if (!lastDraft?.id) return
    router.push(`/dashboard/create?id=${lastDraft.id}`)
  }

  const isEditingExistingDraft = !!initialDraft
  const showRecoverBanner = !activeVariant && !isEditingExistingDraft && !!lastDraft?.content
  const modalPreviewText =
    savedDraftPost?.content_text ?? savedDraftPost?.content ?? activeEditedText ?? activeVariant?.text ?? ''

  // ── Tab style helper ──────────────────────────────────────────────────────
  function tabStyle(active: boolean): React.CSSProperties {
    return {
      fontSize: 14,
      fontWeight: active ? 600 : 500,
      color: active ? '#1A56DB' : '#6B7280',
      padding: '10px 0',
      marginRight: 24,
      background: 'none',
      border: 'none',
      borderBottom: active ? '2px solid #1A56DB' : '2px solid transparent',
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          padding: '0 24px',
          flexShrink: 0,
          display: 'flex',
        }}
      >
        <button style={tabStyle(activeTab === 'upload')} onClick={() => setActiveTab('upload')}>
          Subir contenido
        </button>
      </div>

      {/* Content area — overflow:hidden on desktop, scrollable on mobile/tablet */}
      <div className="create-content-area">
        {activeTab === 'upload' ? (
          <UploadTab
            business={business}
            userId={userId}
            connectedNetworks={connectedNetworks}
            isAdmin={isAdmin}
            initialTemplate={initialTemplate}
          />
        ) : (
    <div className="w-full bg-[#F0EDE8] p-3 md:p-4 lg:p-6 lg:h-full">
      <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="order-1 min-h-[340px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-[#F8F6F2] p-3 md:p-4 lg:order-2 lg:col-span-2 lg:row-span-2 lg:min-h-0">
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

          {isEditingExistingDraft && (
            <div
              style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#FFF7ED',
                border: '1px solid #FED7AA',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>
                Editando borrador existente. Guarda los cambios cuando termines.
              </p>
              <button
                onClick={() => router.push('/dashboard/drafts' as never)}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '5px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#92400E',
                  background: '#FED7AA',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Ver borradores
              </button>
            </div>
          )}

          {showRecoverBanner && (
            <div
              style={{
                margin: '0 0 12px',
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: '#1E3A8A' }}>
                Tienes un borrador reciente guardado. Puedes recuperarlo con todos sus datos.
              </p>
              <button
                onClick={restoreLastDraft}
                style={{
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#1D4ED8',
                  background: '#DBEAFE',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Recuperar
              </button>
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

        <div className="order-2 min-h-[300px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white lg:order-1 lg:col-span-1 lg:row-span-1 lg:min-h-0">
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

        <div className="order-3 min-h-[260px] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white lg:col-span-1 lg:row-span-1 lg:min-h-0">
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
            onSaveDraft={handleSaveDraftInline}
            onPublishNow={openPlatformModal}
            publishing={publishing}
          />
        </div>
      </div>

      <Dialog
        open={activeTab === 'create' && showPublishModal && !!savedDraftPost}
        onClose={() => setShowPublishModal(false)}
        title="Post generado y guardado"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>
            El contenido ya se guardo como borrador en Supabase.
          </p>
          <div
            style={{
              border: '1px solid #E5E7EB',
              borderRadius: 10,
              background: '#F9FAFB',
              padding: 12,
              maxHeight: 220,
              overflowY: 'auto',
              fontSize: 13,
              color: '#111827',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {modalPreviewText}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" className="flex-1" onClick={handleSaveDraftFromModal} disabled={publishing}>
              Guardar borrador
            </Button>
            <Button className="flex-1" onClick={openPlatformModal} loading={publishing}>
              Publicar ahora
            </Button>
          </div>
        </div>
      </Dialog>

      <PublishModal
        open={activeTab === 'create' && showPlatformModal}
        onClose={() => setShowPlatformModal(false)}
        businessId={business.id}
        postContent={activeEditedText || activeVariant?.text}
        postImageUrl={activeEditedImage ?? activeVariant?.imageUrl ?? null}
        initialPlatforms={savedDraftPost?.platforms ?? [platform]}
        publishing={publishing}
        onPublish={handlePublishWithPlatforms}
      />

      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 80,
            borderRadius: 10,
            padding: '10px 14px',
            color: '#FFFFFF',
            background: toast.type === 'success' ? '#059669' : '#DC2626',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
        )}
      </div>
    </div>
  )
}
