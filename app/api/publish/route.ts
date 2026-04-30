import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/tokens'
import { publishToPlatform, type PublishResult } from '@/lib/publishers'
import { checkCanPublish } from '@/lib/plans'
import { notifyPostFailed, notifyPostPublished } from '@/lib/notifications'
import type { Post, SocialPlatform } from '@/types'

interface RequestBody {
  post_id?: string
  postId?: string
  platforms?: SocialPlatform[]
  scheduled_at?: string
}

const ALLOWED_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'google', 'whatsapp']

function pickPostText(post: Post): string {
  return (post.content_text ?? post.content ?? '').trim()
}

function pickPostMedia(post: Post): string | null {
  return post.media_url ?? post.image_url ?? null
}

function pickPlatforms(post: Post, requested?: SocialPlatform[]): SocialPlatform[] {
  if (Array.isArray(requested) && requested.length > 0) {
    return requested.filter((platform): platform is SocialPlatform => ALLOWED_PLATFORMS.includes(platform))
  }
  if (Array.isArray(post.platforms) && post.platforms.length > 0) {
    return post.platforms.filter((platform): platform is SocialPlatform =>
      ALLOWED_PLATFORMS.includes(platform)
    )
  }
  if (post.platform && ALLOWED_PLATFORMS.includes(post.platform)) return [post.platform]
  return []
}

async function loadConnectionIssue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
  platform: SocialPlatform
): Promise<string | null> {
  const { data: conn } = await supabase
    .from('social_connections')
    .select('is_active, access_token, token_expires_at, platform_user_id')
    .eq('business_id', businessId)
    .eq('platform', platform)
    .single()

  if (!conn || !conn.is_active) {
    return `No hay cuenta conectada para ${platform}.`
  }

  if (!conn.access_token) {
    return `Token faltante para ${platform}.`
  }

  if ((platform === 'instagram' || platform === 'facebook') && !conn.platform_user_id) {
    return platform === 'instagram'
      ? 'Instagram business account no conectado.'
      : 'Facebook Page no conectada.'
  }

  if (conn.token_expires_at && new Date(conn.token_expires_at).getTime() <= Date.now()) {
    return `Token expirado para ${platform}. Reconecta la cuenta.`
  }

  return null
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const postId = body.post_id ?? body.postId
  if (!postId) {
    return NextResponse.json({ error: 'Falta postId/post_id' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 403 })
  }

  const { allowed, reason } = await checkCanPublish(business.id)
  if (!allowed) {
    return NextResponse.json({ error: reason }, { status: 403 })
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('business_id', business.id)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post no encontrado o sin permiso' }, { status: 403 })
  }

  const typedPost = post as Post
  const platforms = pickPlatforms(typedPost, body.platforms)
  if (platforms.length === 0) {
    return NextResponse.json({ error: 'No hay plataformas definidas para publicar.' }, { status: 400 })
  }

  if (body.scheduled_at) {
    const { error: scheduleError } = await supabase
      .from('posts')
      .update({
        status: 'scheduled',
        scheduled_at: body.scheduled_at,
        platforms,
        platform: platforms[0] ?? null,
      })
      .eq('id', postId)

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, scheduled: true })
  }

  const text = pickPostText(typedPost)
  const media = pickPostMedia(typedPost)

  if (platforms.includes('instagram') && !media) {
    return NextResponse.json({ error: 'Instagram requiere una imagen para publicar.' }, { status: 400 })
  }

  if (platforms.includes('tiktok') && !typedPost.video_url) {
    return NextResponse.json({ error: 'TikTok requiere un video para publicar.' }, { status: 400 })
  }

  if (!text) {
    return NextResponse.json({ error: 'El post no tiene contenido para publicar.' }, { status: 400 })
  }

  // Mark as draft while publishing (DB constraint only allows draft/published/scheduled/failed)
  await supabase
    .from('posts')
    .update({
      status: 'draft',
      error_message: null,
      platforms,
      platform: platforms[0] ?? null,
    })
    .eq('id', postId)

  const results: Record<string, PublishResult> = {}

  for (const platform of platforms) {
    const issue = await loadConnectionIssue(supabase, business.id, platform)
    if (issue) {
      results[platform] = { success: false, error: issue }
      continue
    }

    const token = await getValidToken(business.id, platform)
    if (!token) {
      results[platform] = {
        success: false,
        error: `No se pudo obtener un token valido para ${platform}.`,
      }
      continue
    }

    results[platform] = await publishToPlatform(platform, typedPost, token)
  }

  const allSuccess = Object.values(results).every((result) => result.success)
  const failedPlatforms = Object.entries(results)
    .filter(([, result]) => !result.success)
    .map(([platform, result]) => `${platform}: ${result.error ?? 'error desconocido'}`)
  const errorSummary = failedPlatforms.join(' | ')

  const platformPostIds: Record<string, string> = {}
  for (const [platform, result] of Object.entries(results)) {
    if (result.success && result.platform_post_id) {
      platformPostIds[platform] = result.platform_post_id
    }
  }
  const externalPostId = Object.values(platformPostIds)[0] ?? null

  const { error: updateError } = await supabase
    .from('posts')
    .update({
      status: allSuccess ? 'published' : 'failed',
      platforms,
      platform: platforms[0] ?? null,
      content: typedPost.content ?? typedPost.content_text ?? '',
      content_text: typedPost.content_text ?? typedPost.content ?? '',
      media_url: media,
      image_url: typedPost.image_url ?? media,
      external_post_id: externalPostId,
      platform_post_ids: Object.keys(platformPostIds).length > 0 ? platformPostIds : {},
      published_at: allSuccess ? new Date().toISOString() : null,
      error_message: errorSummary || null,
    })
    .eq('id', postId)

  if (updateError) {
    console.error('[publish] status update error:', updateError)
  }

  if (allSuccess) {
    notifyPostPublished(business.id, platforms).catch(() => {})
  } else {
    notifyPostFailed(business.id, errorSummary, user.email ?? '').catch(() => {})
  }

  return NextResponse.json({
    success: allSuccess,
    results,
    error: allSuccess ? null : errorSummary,
  })
}
