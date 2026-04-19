import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createClient } from '@/lib/supabase/server'
import { checkCanConnectSocial } from '@/lib/plans'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${APP_URL}/api/auth/google/callback`
  )
}

export async function GET(): Promise<NextResponse> {
  // ── Auth check ─────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── Get business_id ────────────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.redirect(new URL('/onboarding', APP_URL))
  }

  // ── Plan limit check ───────────────────────────────────────────
  const { allowed } = await checkCanConnectSocial(business.id)
  if (!allowed) {
    return NextResponse.redirect(new URL('/pricing?reason=limit', APP_URL))
  }

  // ── Build Google OAuth URL ─────────────────────────────────────
  const oauth2Client = getOAuth2Client()

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/business.manage'],
    state: business.id,
  })

  return NextResponse.redirect(authUrl)
}
