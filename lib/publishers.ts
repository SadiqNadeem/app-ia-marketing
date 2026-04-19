import { createAdminClient } from '@/lib/supabase/admin'
import type { Post, SocialPlatform } from '@/types'

const GRAPH = 'https://graph.facebook.com/v19.0'

export interface PublishResult {
  success: boolean
  error?: string
  platform_post_id?: string
}

// ── Helper: get platform_user_id for a connection ─────────────────
async function getPlatformUserId(
  businessId: string,
  platform: SocialPlatform
): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('social_connections')
    .select('platform_user_id')
    .eq('business_id', businessId)
    .eq('platform', platform)
    .eq('is_active', true)
    .single()
  return data?.platform_user_id ?? null
}

// ── Instagram ─────────────────────────────────────────────────────
export async function publishToInstagram(
  post: Post,
  token: string
): Promise<PublishResult> {
  try {
    const igUserId = await getPlatformUserId(post.business_id, 'instagram')
    if (!igUserId) return { success: false, error: 'ID de cuenta Instagram no encontrado' }

    // Step 1 — create media container
    const containerParams = new URLSearchParams({
      access_token: token,
      caption: post.content_text ?? '',
    })

    if (post.image_url) {
      containerParams.set('image_url', post.image_url)
    } else {
      // Instagram requires media; use a plain text carousel or return error
      return { success: false, error: 'Instagram requiere una imagen para publicar' }
    }

    const containerRes = await fetch(
      `${GRAPH}/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: containerParams.toString(),
      }
    )
    const containerData = await containerRes.json()

    if (!containerRes.ok || !containerData.id) {
      const msg = containerData?.error?.message ?? `Error al crear contenedor (${containerRes.status})`
      return { success: false, error: msg }
    }

    const creationId: string = containerData.id

    // Step 2 — publish the container
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: token,
    })

    const publishRes = await fetch(
      `${GRAPH}/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: publishParams.toString(),
      }
    )
    const publishData = await publishRes.json()

    if (!publishRes.ok || !publishData.id) {
      const msg = publishData?.error?.message ?? `Error al publicar en Instagram (${publishRes.status})`
      return { success: false, error: msg }
    }

    return { success: true, platform_post_id: publishData.id as string }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado en Instagram' }
  }
}

// ── Facebook ──────────────────────────────────────────────────────
export async function publishToFacebook(
  post: Post,
  token: string
): Promise<PublishResult> {
  try {
    const pageId = await getPlatformUserId(post.business_id, 'facebook')
    if (!pageId) return { success: false, error: 'ID de pagina Facebook no encontrado' }

    let endpoint: string
    const body = new URLSearchParams({ access_token: token })

    if (post.image_url) {
      // Publish photo with caption
      endpoint = `${GRAPH}/${pageId}/photos`
      body.set('url', post.image_url)
      body.set('caption', post.content_text ?? '')
    } else {
      // Publish text post
      endpoint = `${GRAPH}/${pageId}/feed`
      body.set('message', post.content_text ?? '')
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? `Error al publicar en Facebook (${res.status})`
      return { success: false, error: msg }
    }

    const postId = (data as { id?: string; post_id?: string }).id ?? (data as { post_id?: string }).post_id
    return { success: true, platform_post_id: postId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado en Facebook' }
  }
}

// ── TikTok ────────────────────────────────────────────────────────
export async function publishToTikTok(
  post: Post,
  token: string
): Promise<PublishResult> {
  if (!post.video_url) {
    return { success: false, error: 'TikTok requiere un video' }
  }

  try {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: post.content_text ?? '',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'URL',
          video_url: post.video_url,
        },
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.data?.publish_id) {
      const msg = data?.error?.message ?? `Error al publicar en TikTok (${res.status})`
      return { success: false, error: msg }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado en TikTok' }
  }
}

// ── Google Business ───────────────────────────────────────────────
export async function publishToGoogle(
  post: Post,
  token: string
): Promise<PublishResult> {
  try {
    const locationName = await getPlatformUserId(post.business_id, 'google')
    if (!locationName) return { success: false, error: 'Ubicacion de Google Business no encontrada' }

    const body: Record<string, unknown> = {
      languageCode: 'es',
      summary: post.content_text ?? '',
      callToAction: { actionType: 'LEARN_MORE' },
      media: post.image_url
        ? [{ mediaFormat: 'PHOTO', sourceUrl: post.image_url }]
        : [],
    }

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )
    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? `Error al publicar en Google Business (${res.status})`
      return { success: false, error: msg }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado en Google Business' }
  }
}

// ── Dispatcher: pick the right publisher ─────────────────────────
export async function publishToPlatform(
  platform: SocialPlatform,
  post: Post,
  token: string
): Promise<PublishResult> {
  switch (platform) {
    case 'instagram': return publishToInstagram(post, token)
    case 'facebook':  return publishToFacebook(post, token)
    case 'tiktok':    return publishToTikTok(post, token)
    case 'google':    return publishToGoogle(post, token)
    default:          return { success: false, error: `Plataforma no soportada: ${platform}` }
  }
}
