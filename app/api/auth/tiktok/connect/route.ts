import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { checkCanConnectSocial } from '@/lib/plans'

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://earthling-rotunda-copilot.ngrok-free.dev'

/** 64 random bytes as base64url — safe for PKCE */
function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url')
}

/** SHA-256 of verifier, base64url-encoded — the PKCE challenge */
function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
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

  // ── PKCE pair ──────────────────────────────────────────────────
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // ── Build TikTok auth URL ──────────────────────────────────────
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/tiktok`

  // Include verifier in state so the callback can use it
  // regardless of which domain handles the redirect
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    response_type: 'code',
    scope: 'user.info.basic,user.info.profile,video.list',
    redirect_uri: redirectUri,
    state: JSON.stringify({
      business_id: business.id,
      csrf: crypto.randomUUID(),
      cv: codeVerifier,
    }),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

  return NextResponse.redirect(authUrl)
}
