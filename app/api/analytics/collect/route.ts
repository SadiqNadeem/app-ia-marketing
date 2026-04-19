import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/tokens'

const GRAPH = 'https://graph.facebook.com/v19.0'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: cron secret
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all published posts from last 30 days that have platform_post_ids
  const { data: posts, error: postsError } = await admin
    .from('posts')
    .select('id, business_id, platform_post_ids, platforms, published_at')
    .eq('status', 'published')
    .gte('published_at', since)
    .not('platform_post_ids', 'eq', '{}')

  if (postsError) {
    console.error('[analytics/collect] fetch posts error:', postsError)
    return NextResponse.json({ error: 'Error al obtener posts' }, { status: 500 })
  }

  let processed = 0
  let errors = 0

  for (const post of posts ?? []) {
    const platformPostIds = (post.platform_post_ids ?? {}) as Record<string, string>

    for (const platform of Object.keys(platformPostIds)) {
      const platformPostId = platformPostIds[platform]
      if (!platformPostId) continue

      try {
        const token = await getValidToken(post.business_id, platform as 'instagram' | 'facebook')
        if (!token) continue

        let likes = 0, comments = 0, shares = 0, saves = 0
        let reach = 0, impressions = 0, clicks = 0

        if (platform === 'instagram') {
          const url = `${GRAPH}/${platformPostId}?fields=like_count,comments_count,shares,saved,reach,impressions&access_token=${token}`
          const res = await fetch(url)
          if (res.ok) {
            const d = await res.json() as {
              like_count?: number
              comments_count?: number
              shares?: { count?: number }
              saved?: number
              reach?: number
              impressions?: number
            }
            likes = d.like_count ?? 0
            comments = d.comments_count ?? 0
            shares = d.shares?.count ?? 0
            saves = d.saved ?? 0
            reach = d.reach ?? 0
            impressions = d.impressions ?? 0
          }
        } else if (platform === 'facebook') {
          const url = `${GRAPH}/${platformPostId}/insights?metric=post_impressions,post_reach,post_engaged_users,post_clicks&access_token=${token}`
          const res = await fetch(url)
          if (res.ok) {
            const d = await res.json() as { data?: { name: string; values: { value: number }[] }[] }
            for (const metric of d.data ?? []) {
              const val = metric.values?.[0]?.value ?? 0
              if (metric.name === 'post_impressions') impressions = val
              else if (metric.name === 'post_reach') reach = val
              else if (metric.name === 'post_engaged_users') clicks = val
              else if (metric.name === 'post_clicks') clicks = Math.max(clicks, val)
            }
          }
        }

        const engagement_rate = reach > 0
          ? parseFloat(((likes + comments + shares + saves) / reach * 100).toFixed(2))
          : 0

        // Upsert metrics
        const { error: upsertError } = await admin
          .from('post_metrics')
          .upsert(
            {
              post_id: post.id,
              business_id: post.business_id,
              platform,
              likes,
              comments,
              shares,
              saves,
              reach,
              impressions,
              clicks,
              engagement_rate,
              recorded_at: new Date().toISOString(),
            },
            { onConflict: 'post_id,platform' }
          )

        if (upsertError) {
          console.error('[analytics/collect] upsert error:', upsertError)
          errors++
        } else {
          processed++
        }
      } catch (err) {
        console.error('[analytics/collect] error for post', post.id, platform, err)
        errors++
      }
    }
  }

  return NextResponse.json({ processed, errors })
}
