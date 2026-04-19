import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Period = '7d' | '30d' | '90d'

function periodToDate(period: Period): string {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('business_id')
  const period = (searchParams.get('period') ?? '30d') as Period

  if (!businessId) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()
  const since = periodToDate(period)

  // ── 1. Platform totals ─────────────────────────────────────────
  const { data: platformTotals } = await admin.rpc('analytics_platform_totals', {
    p_business_id: businessId,
    p_since: since,
  }).catch(() => ({ data: null }))

  // Fallback: raw query if RPC not available
  let byPlatform: {
    platform: string
    total_likes: number
    total_comments: number
    total_shares: number
    total_reach: number
    total_impressions: number
    avg_engagement: number
    posts_count: number
  }[] = []

  if (platformTotals) {
    byPlatform = platformTotals
  } else {
    const { data } = await admin
      .from('post_metrics')
      .select('platform, likes, comments, shares, reach, impressions, engagement_rate')
      .eq('business_id', businessId)
      .gte('recorded_at', since)

    if (data) {
      const map: Record<string, typeof byPlatform[0]> = {}
      for (const row of data) {
        if (!map[row.platform]) {
          map[row.platform] = {
            platform: row.platform,
            total_likes: 0, total_comments: 0, total_shares: 0,
            total_reach: 0, total_impressions: 0,
            avg_engagement: 0, posts_count: 0,
          }
        }
        const p = map[row.platform]
        p.total_likes += row.likes ?? 0
        p.total_comments += row.comments ?? 0
        p.total_shares += row.shares ?? 0
        p.total_reach += row.reach ?? 0
        p.total_impressions += row.impressions ?? 0
        p.avg_engagement += row.engagement_rate ?? 0
        p.posts_count++
      }
      byPlatform = Object.values(map).map(p => ({
        ...p,
        avg_engagement: p.posts_count > 0 ? parseFloat((p.avg_engagement / p.posts_count).toFixed(2)) : 0,
      }))
    }
  }

  // ── 2. Daily evolution ─────────────────────────────────────────
  const { data: metricsRaw } = await admin
    .from('post_metrics')
    .select('recorded_at, reach, impressions, engagement_rate')
    .eq('business_id', businessId)
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })

  const dailyMap: Record<string, { reach: number; impressions: number; engagement: number; count: number }> = {}

  for (const row of metricsRaw ?? []) {
    const day = row.recorded_at.slice(0, 10)
    if (!dailyMap[day]) dailyMap[day] = { reach: 0, impressions: 0, engagement: 0, count: 0 }
    dailyMap[day].reach += row.reach ?? 0
    dailyMap[day].impressions += row.impressions ?? 0
    dailyMap[day].engagement += row.engagement_rate ?? 0
    dailyMap[day].count++
  }

  const dailyEvolution = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, v]) => ({
      day,
      reach: v.reach,
      impressions: v.impressions,
      engagement: parseFloat((v.count > 0 ? v.engagement / v.count : 0).toFixed(2)),
    }))

  // ── 3. Top 5 posts by engagement ───────────────────────────────
  const { data: topPostsRaw } = await admin
    .from('post_metrics')
    .select('post_id, likes, comments, reach, engagement_rate, platform, posts(id, content_text, image_url, published_at)')
    .eq('business_id', businessId)
    .gte('recorded_at', since)
    .order('engagement_rate', { ascending: false })
    .limit(5)

  const topPosts = (topPostsRaw ?? []).map(row => {
    const post = Array.isArray(row.posts) ? row.posts[0] : row.posts
    return {
      id: row.post_id,
      content_text: (post as { content_text?: string } | null)?.content_text ?? '',
      image_url: (post as { image_url?: string } | null)?.image_url ?? null,
      published_at: (post as { published_at?: string } | null)?.published_at ?? null,
      likes: row.likes,
      comments: row.comments,
      reach: row.reach,
      engagement_rate: row.engagement_rate,
      platform: row.platform,
    }
  })

  // ── 4. Best hour to post ───────────────────────────────────────
  const { data: hourRaw } = await admin
    .from('post_metrics')
    .select('engagement_rate, posts(published_at)')
    .eq('business_id', businessId)
    .gte('recorded_at', since)

  const hourMap: Record<number, { total: number; count: number }> = {}
  for (const row of hourRaw ?? []) {
    const post = Array.isArray(row.posts) ? row.posts[0] : row.posts
    const publishedAt = (post as { published_at?: string } | null)?.published_at
    if (!publishedAt) continue
    const hour = new Date(publishedAt).getHours()
    if (!hourMap[hour]) hourMap[hour] = { total: 0, count: 0 }
    hourMap[hour].total += row.engagement_rate ?? 0
    hourMap[hour].count++
  }

  const bestHours = Object.entries(hourMap)
    .map(([hour, v]) => ({
      hour: parseInt(hour),
      avg_engagement: parseFloat((v.count > 0 ? v.total / v.count : 0).toFixed(2)),
    }))
    .sort((a, b) => b.avg_engagement - a.avg_engagement)

  // ── Totals ─────────────────────────────────────────────────────
  const totals = byPlatform.reduce(
    (acc, p) => ({
      total_reach: acc.total_reach + p.total_reach,
      total_impressions: acc.total_impressions + p.total_impressions,
      posts_count: acc.posts_count + p.posts_count,
    }),
    { total_reach: 0, total_impressions: 0, posts_count: 0 }
  )

  const allEngagements = (metricsRaw ?? []).map(r => r.engagement_rate ?? 0)
  const avg_engagement = allEngagements.length > 0
    ? parseFloat((allEngagements.reduce((s, v) => s + v, 0) / allEngagements.length).toFixed(2))
    : 0

  return NextResponse.json({
    by_platform: byPlatform,
    daily_evolution: dailyEvolution,
    top_posts: topPosts,
    best_hours: bestHours,
    totals: { ...totals, avg_engagement },
    has_data: (metricsRaw?.length ?? 0) > 0,
  })
}
