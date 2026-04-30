import { createAdminClient } from '@/lib/supabase/admin'
import type { Post, SocialPlatform } from '@/types'

const GRAPH = 'https://graph.facebook.com/v19.0'

interface GraphErrorBody {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    type?: string
  }
  id?: string
  post_id?: string
  data?: {
    publish_id?: string
  }
}

export interface PublishResult {
  success: boolean
  error?: string
  platform_post_id?: string
}

function getPostText(post: Post): string {
  return (post.content_text ?? post.content ?? '').trim()
}

function getPostMediaUrl(post: Post): string | null {
  return post.media_url ?? post.image_url ?? null
}

function parseMetaError(stage: string, status: number, body: GraphErrorBody): string {
  const message = body.error?.message?.trim()
  const code = body.error?.code

  if (code === 190) {
    return `${stage}: token expirado o invalido. Reconecta la cuenta.`
  }
  if (code === 10 || code === 200) {
    return `${stage}: faltan permisos para publicar.`
  }
  if (message?.toLowerCase().includes('permission')) {
    return `${stage}: permisos insuficientes para publicar.`
  }

  return `${stage}: ${message ?? `Error de API (${status})`}`
}

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

async function resolveFacebookPageToken(userToken: string, pageId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/me/accounts?fields=id,access_token&access_token=${encodeURIComponent(userToken)}`
    )
    const body = (await res.json()) as GraphErrorBody & {
      data?: Array<{ id?: string; access_token?: string }>
    }

    if (!res.ok || !Array.isArray(body.data)) {
      return null
    }

    const page = body.data.find((entry) => entry.id === pageId)
    return page?.access_token ?? null
  } catch {
    return null
  }
}

async function waitForContainerReady(
  containerId: string,
  token: string,
  maxAttempts = 12,
  delayMs = 3000
): Promise<'FINISHED' | 'ERROR' | 'TIMEOUT'> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs))
    try {
      const res = await fetch(
        `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(token)}`
      )
      const body = (await res.json()) as { status_code?: string }
      if (body.status_code === 'FINISHED') return 'FINISHED'
      if (body.status_code === 'ERROR') return 'ERROR'
      // IN_PROGRESS / EXPIRED / etc — keep waiting
    } catch {
      // network hiccup, keep trying
    }
  }
  return 'TIMEOUT'
}

export async function publishToInstagram(post: Post, token: string): Promise<PublishResult> {
  try {
    const igUserId = await getPlatformUserId(post.business_id, 'instagram')
    if (!igUserId) {
      return { success: false, error: 'Instagram business account no conectado.' }
    }

    const mediaUrl = getPostMediaUrl(post)
    if (!mediaUrl) {
      return { success: false, error: 'Instagram requiere una imagen para publicar.' }
    }

    // Step 1 — create media container
    const containerParams = new URLSearchParams({
      access_token: token,
      caption: getPostText(post),
      image_url: mediaUrl,
    })

    const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: containerParams.toString(),
    })
    const containerBody = (await containerRes.json()) as GraphErrorBody

    if (!containerRes.ok || !containerBody.id) {
      return {
        success: false,
        error: parseMetaError('Fallo al crear media container', containerRes.status, containerBody),
      }
    }

    // Step 2 — wait until Instagram finishes processing the image
    const containerStatus = await waitForContainerReady(containerBody.id, token)
    if (containerStatus === 'ERROR') {
      return { success: false, error: 'Instagram no pudo procesar la imagen. Verifica que la URL sea publica.' }
    }
    if (containerStatus === 'TIMEOUT') {
      return { success: false, error: 'Instagram tardo demasiado en procesar la imagen. Intentalo de nuevo.' }
    }

    // Step 3 — publish the ready container
    const publishParams = new URLSearchParams({
      access_token: token,
      creation_id: containerBody.id,
    })

    const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams.toString(),
    })
    const publishBody = (await publishRes.json()) as GraphErrorBody

    if (!publishRes.ok || !publishBody.id) {
      return {
        success: false,
        error: parseMetaError('Fallo en media_publish', publishRes.status, publishBody),
      }
    }

    return { success: true, platform_post_id: publishBody.id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al publicar en Instagram.',
    }
  }
}

export async function publishToFacebook(post: Post, token: string): Promise<PublishResult> {
  try {
    const pageId = await getPlatformUserId(post.business_id, 'facebook')
    if (!pageId) {
      return { success: false, error: 'Facebook Page no conectada.' }
    }

    const pageToken = (await resolveFacebookPageToken(token, pageId)) ?? token
    const mediaUrl = getPostMediaUrl(post)
    const text = getPostText(post)

    let endpoint = `${GRAPH}/${pageId}/feed`
    const body = new URLSearchParams({ access_token: pageToken, message: text })

    if (mediaUrl) {
      endpoint = `${GRAPH}/${pageId}/photos`
      body.set('url', mediaUrl)
      body.set('caption', text)
      body.delete('message')
    }

    const publishRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const publishBody = (await publishRes.json()) as GraphErrorBody

    if (!publishRes.ok) {
      return {
        success: false,
        error: parseMetaError('Fallo al publicar en Facebook', publishRes.status, publishBody),
      }
    }

    const platformPostId = publishBody.id ?? publishBody.post_id
    return { success: true, platform_post_id: platformPostId }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al publicar en Facebook.',
    }
  }
}

export async function publishToTikTok(post: Post, token: string): Promise<PublishResult> {
  if (!post.video_url) {
    return { success: false, error: 'TikTok requiere un video.' }
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
          title: getPostText(post),
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

    const data = (await res.json()) as GraphErrorBody
    if (!res.ok || !data.data?.publish_id) {
      return { success: false, error: `TikTok publish init fallo (${res.status}).` }
    }

    return { success: true, platform_post_id: data.data.publish_id }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al publicar en TikTok.',
    }
  }
}

export async function publishToGoogle(post: Post, token: string): Promise<PublishResult> {
  try {
    const locationName = await getPlatformUserId(post.business_id, 'google')
    if (!locationName) return { success: false, error: 'Google Business no conectado.' }

    const mediaUrl = getPostMediaUrl(post)
    const body: Record<string, unknown> = {
      languageCode: 'es',
      summary: getPostText(post),
      callToAction: { actionType: 'LEARN_MORE' },
      media: mediaUrl ? [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }] : [],
    }

    const res = await fetch(`https://mybusiness.googleapis.com/v4/${locationName}/localPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const data = (await res.json()) as GraphErrorBody & { name?: string }

    if (!res.ok) {
      const msg = data?.error?.message ?? `Google Business fallo (${res.status}).`
      return { success: false, error: msg }
    }

    return { success: true, platform_post_id: data.name }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al publicar en Google Business.',
    }
  }
}

export async function publishToPlatform(
  platform: SocialPlatform,
  post: Post,
  token: string
): Promise<PublishResult> {
  switch (platform) {
    case 'instagram':
      return publishToInstagram(post, token)
    case 'facebook':
      return publishToFacebook(post, token)
    case 'tiktok':
      return publishToTikTok(post, token)
    case 'google':
      return publishToGoogle(post, token)
    default:
      return { success: false, error: `Plataforma no soportada: ${platform}` }
  }
}

