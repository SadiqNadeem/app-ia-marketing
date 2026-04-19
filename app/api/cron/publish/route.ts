import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/tokens'
import { publishToPlatform } from '@/lib/publishers'
import type { Post, SocialPlatform } from '@/types'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── Auth: verify CRON_SECRET ──────────────────────────────────
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  // ── Fetch all due scheduled posts ─────────────────────────────
  const { data: duePosts, error: fetchError } = await admin
    .from('posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())

  if (fetchError) {
    console.error('[cron/publish] fetch error:', fetchError)
    return NextResponse.json({ error: 'Error al obtener posts programados' }, { status: 500 })
  }

  if (!duePosts || duePosts.length === 0) {
    return NextResponse.json({ processed: 0, succeeded: 0, failed: 0 })
  }

  let succeeded = 0
  let failed = 0

  for (const post of duePosts as Post[]) {
    const platforms = post.platforms as SocialPlatform[]
    const results: Record<string, { success: boolean; error?: string }> = {}

    for (const platform of platforms) {
      const token = await getValidToken(post.business_id, platform)

      if (!token) {
        results[platform] = {
          success: false,
          error: `Sin token activo para ${platform}`,
        }
        continue
      }

      results[platform] = await publishToPlatform(platform, post, token)
    }

    const allSuccess = Object.values(results).every((r) => r.success)
    const failedPlatforms = Object.entries(results)
      .filter(([, r]) => !r.success)
      .map(([p, r]) => `${p}: ${r.error}`)

    await admin
      .from('posts')
      .update({
        status: allSuccess ? 'published' : 'failed',
        published_at: allSuccess ? new Date().toISOString() : null,
        error_message: failedPlatforms.length > 0 ? failedPlatforms.join(' | ') : null,
      })
      .eq('id', post.id)

    if (allSuccess) succeeded++
    else failed++
  }

  return NextResponse.json({
    processed: duePosts.length,
    succeeded,
    failed,
  })
}
