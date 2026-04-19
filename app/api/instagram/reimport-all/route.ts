import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runInstagramImport } from '@/lib/instagram-import'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Get all businesses with active Instagram connections
  const { data: connections } = await admin
    .from('social_connections')
    .select('business_id')
    .eq('platform', 'instagram')
    .eq('is_active', true)

  if (!connections || connections.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processed = 0

  // Run imports in the background without awaiting each one serially
  const promises = connections.map(async ({ business_id }) => {
    try {
      const result = await runInstagramImport(business_id)
      if (result.success) processed++
    } catch (err) {
      console.error(`[reimport-all] Error for business ${business_id}:`, err)
    }
  })

  await Promise.allSettled(promises)

  return NextResponse.json({ processed })
}
