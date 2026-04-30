import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCanConnectSocial } from '@/lib/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET() {
  // ── Auth check ────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── Get business_id ───────────────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.redirect(new URL('/onboarding', APP_URL))
  }

  // ── Plan limit check ──────────────────────────────────────────────
  const { allowed } = await checkCanConnectSocial(business.id)
  if (!allowed) {
    return NextResponse.redirect(new URL('/pricing?reason=limit', APP_URL))
  }

  // ── Build Google OAuth URL — pass business_id in state ────────────
  const state = Buffer.from(JSON.stringify({ business_id: business.id })).toString('base64')

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/business.manage',
      'openid',
      'email',
      'profile',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )
}
