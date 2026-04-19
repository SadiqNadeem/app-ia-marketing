import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getValidToken } from '@/lib/tokens'
import { publishToPlatform } from '@/lib/publishers'
import { checkCanPublish } from '@/lib/plans'
import { notifyPostPublished, notifyPostFailed } from '@/lib/notifications'
import type { SocialPlatform, Post } from '@/types'

interface RequestBody {
  post_id: string
  platforms: SocialPlatform[]
  scheduled_at?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { post_id, platforms, scheduled_at } = body
  if (!post_id || !platforms?.length) {
    return NextResponse.json({ error: 'Faltan post_id o platforms' }, { status: 400 })
  }

  // ── Fetch post and verify ownership via business ───────────────
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 403 })
  }

  // ── Plan limit check ──────────────────────────────────────────
  const { allowed, reason } = await checkCanPublish(business.id)
  if (!allowed) {
    return NextResponse.json({ error: reason }, { status: 403 })
  }

  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', post_id)
    .eq('business_id', business.id)
    .single()

  if (postError || !post) {
    return NextResponse.json({ error: 'Post no encontrado o sin permiso' }, { status: 403 })
  }

  // ── Schedule mode ─────────────────────────────────────────────
  if (scheduled_at) {
    const { error: updateError } = await supabase
      .from('posts')
      .update({ status: 'scheduled', scheduled_at, platforms })
      .eq('id', post_id)

    if (updateError) {
      return NextResponse.json({ error: 'Error al programar el post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, scheduled: true })
  }

  // ── Publish now ───────────────────────────────────────────────
  const results: Record<string, { success: boolean; error?: string }> = {}

  for (const platform of platforms) {
    const token = await getValidToken(business.id, platform)

    if (!token) {
      results[platform] = { success: false, error: `No hay cuenta conectada para ${platform}` }
      continue
    }

    results[platform] = await publishToPlatform(platform, post as Post, token)
  }

  // ── Determine final status ────────────────────────────────────
  const allSuccess = Object.values(results).every((r) => r.success)
  const failedPlatforms = Object.entries(results)
    .filter(([, r]) => !r.success)
    .map(([p, r]) => `${p}: ${r.error}`)

  // Collect platform_post_ids from successful publishes
  const platformPostIds: Record<string, string> = {}
  for (const [platform, result] of Object.entries(results)) {
    if (result.success && result.platform_post_id) {
      platformPostIds[platform] = result.platform_post_id
    }
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({
      status: allSuccess ? 'published' : 'failed',
      platforms,
      published_at: allSuccess ? new Date().toISOString() : null,
      error_message: failedPlatforms.length > 0 ? failedPlatforms.join(' | ') : null,
      ...(Object.keys(platformPostIds).length > 0 ? { platform_post_ids: platformPostIds } : {}),
    })
    .eq('id', post_id)

  if (updateError) {
    console.error('[publish] status update error:', updateError)
  }

  // Fire notifications (non-blocking)
  if (allSuccess) {
    notifyPostPublished(business.id, platforms).catch(() => {})
  } else {
    const errorSummary = failedPlatforms.join(' | ')
    notifyPostFailed(business.id, errorSummary, user.email ?? '').catch(() => {})
  }

  return NextResponse.json({ success: true, results })
}
