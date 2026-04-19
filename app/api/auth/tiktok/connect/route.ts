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
  const redirectUri = `${APP_URL}/api/auth/tiktok/callback`
  console.log('[TikTok connect] APP_URL:', APP_URL)
  console.log('[TikTok connect] redirect_uri:', redirectUri)

  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    response_type: 'code',
    scope: 'user.info.basic,user.info.profile,video.list',
    redirect_uri: redirectUri,
    state: JSON.stringify({ business_id: business.id, csrf: crypto.randomUUID() }),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`

  console.log('REDIRECT_URI enviada a TikTok:', redirectUri)
  console.log('URL completa de autorización:', authUrl.toString())

  // ── Redirect and set httpOnly cookie with verifier ─────────────
  const response = NextResponse.redirect(authUrl)
  response.cookies.set('tiktok_cv', codeVerifier, {
    httpOnly: true,
    maxAge: 600, // 10 minutes
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
