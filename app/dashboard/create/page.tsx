import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatePageClient } from './CreatePageClient'
import type { DraftInitData } from './types'
import type { PromotionType, SocialPlatform } from '@/types'

interface CreatePageProps {
  searchParams: Promise<{ promotion_type?: string; example_id?: string; id?: string; tab?: string; template_id?: string }>
}

const VALID_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'google', 'whatsapp']

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const { promotion_type, example_id, id, tab, template_id } = await searchParams

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const { data: networksData } = await supabase
    .from('social_connections')
    .select('platform, platform_username, is_professional')
    .eq('business_id', business.id)
    .eq('is_active', true)

  const connectedNetworks = (networksData ?? []) as Array<{
    platform: SocialPlatform
    platform_username: string | null
    is_professional: boolean | null
  }>

  let initialExampleDescription: string | undefined
  if (example_id) {
    const { data: example } = await supabase
      .from('ai_examples')
      .select('style_description, title')
      .eq('id', example_id)
      .eq('is_active', true)
      .single()
    if (example) {
      initialExampleDescription = `Referencia de estilo: ${example.title}. ${example.style_description}`
    }
  }

  // ── Load template ─────────────────────────────────────────────────────────
  let initialTemplate: { id: string; title: string; fabric_json: object; canvas_width: number; canvas_height: number } | undefined
  if (template_id) {
    const { data: tpl } = await supabase
      .from('ai_examples')
      .select('id, title, fabric_json, canvas_width, canvas_height')
      .eq('id', template_id)
      .eq('is_template', true)
      .eq('is_active', true)
      .single()
    if (tpl?.fabric_json) {
      initialTemplate = {
        id: tpl.id,
        title: tpl.title,
        fabric_json: tpl.fabric_json as object,
        canvas_width: tpl.canvas_width ?? 1080,
        canvas_height: tpl.canvas_height ?? 1080,
      }
    }
  }

  let initialDraft: DraftInitData | undefined
  if (id) {
    const { data: draft } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('business_id', business.id)
      .eq('status', 'draft')
      .single()

    if (draft) {
      const rawPlatforms = Array.isArray(draft.platforms) ? draft.platforms : []
      const firstPlatform =
        rawPlatforms.find((p: string) => VALID_PLATFORMS.includes(p as SocialPlatform)) ??
        draft.platform ??
        'instagram'

      initialDraft = {
        id: draft.id,
        content: (draft.content_text ?? draft.content ?? '').trim(),
        platform: firstPlatform as SocialPlatform,
        hashtags: Array.isArray(draft.hashtags) ? draft.hashtags : [],
        cta: draft.cta ?? '',
        imageUrl: draft.image_url ?? null,
        imagePrompt: draft.image_prompt ?? '',
        visualStyle: draft.visual_style ?? 'moderno',
        promotionType: (draft.promotion_type ?? null) as PromotionType | null,
        extraContext: draft.extra_context ?? '',
      }
    }
  }

  return (
    <div style={{ height: '100%' }}>
      <CreatePageClient
        business={business}
        userId={user.id}
        isAdmin={user.email === process.env.ADMIN_EMAIL}
        connectedNetworks={connectedNetworks}
        initialPromotionType={promotion_type as PromotionType | undefined}
        initialExampleDescription={initialExampleDescription}
        initialDraft={initialDraft}
        initialTemplate={initialTemplate}
        initialTab={tab === 'create' ? 'create' : 'upload'}
      />
    </div>
  )
}
