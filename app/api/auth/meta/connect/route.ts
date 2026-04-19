import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCanConnectSocial } from '@/lib/plans'

const META_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_read_engagement',
  'pages_show_list',
  'business_management',
].join(',')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(): Promise<NextResponse> {
  // ── 0. Guard: credentials must be present ──────────────────────
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    console.error('[meta/connect] META_APP_ID or META_APP_SECRET is not set')
    return NextResponse.redirect(
      new URL('/dashboard/connections?error=meta_not_configured', APP_URL)
    )
  }

  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Get business_id ─────────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.redirect(
      new URL('/onboarding', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }

  // ── Plan limit check ───────────────────────────────────────────
  const { allowed } = await checkCanConnectSocial(business.id)
  if (!allowed) {
    return NextResponse.redirect(
      new URL('/pricing?reason=limit', process.env.NEXT_PUBLIC_APP_URL!)
    )
  }

  // ── 3. Build Meta OAuth URL ────────────────────────────────────
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri,
    scope: META_SCOPES,
    response_type: 'code',
    state: business.id,
  })

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
