import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { business_id, page_id, page_name, page_token } = await req.json()

  if (!business_id || !page_id || !page_token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('social_connections').upsert(
    {
      business_id,
      platform: 'facebook',
      access_token: page_token,
      platform_user_id: page_id,
      platform_username: page_name,
      has_pages: true,
      is_active: true,
    },
    { onConflict: 'business_id,platform' }
  )

  if (error) {
    console.error('[facebook-select-page] upsert error:', error)
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
