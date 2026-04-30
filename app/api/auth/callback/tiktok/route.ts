import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_USER_URL  = 'https://open.tiktokapis.com/v2/user/info/'
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL!

function errRedirect(code: string) {
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?error=${code}`)
}

interface TikTokTokenResponse {
  access_token:       string
  refresh_token:      string
  open_id:            string
  expires_in:         number
  refresh_expires_in: number
  scope:              string
  token_type:         string
}

interface TikTokUserResponse {
  data: { user: { display_name?: string; username?: string } }
  error?: { code: string; message: string }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const error    = searchParams.get('error')
  const code     = searchParams.get('code')
  const rawState = searchParams.get('state')

  if (error) return errRedirect('tiktok_denied')
  if (!code || !rawState) return errRedirect('tiktok_denied')

  // ── Parse state (contains business_id and PKCE verifier) ─────
  let businessId: string
  let codeVerifier: string
  try {
    const state = JSON.parse(rawState)
    businessId  = state.business_id
    codeVerifier = state.cv
    if (!businessId || !codeVerifier) throw new Error('missing fields')
  } catch {
    return errRedirect('tiktok_denied')
  }

  // ── Exchange code for tokens ──────────────────────────────────
  let tokenData: TikTokTokenResponse
  try {
    const body = new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      code,
      grant_type:    'authorization_code',
      redirect_uri:  `${process.env.NEXTAUTH_URL}/api/auth/callback/tiktok`,
      code_verifier: codeVerifier,
    })

    const res  = await fetch(TIKTOK_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    })
    const json = await res.json()
    if (!res.ok || !json.access_token) {
      console.error('[tiktok/callback] token error:', json)
      return errRedirect('tiktok_denied')
    }
    tokenData = json as TikTokTokenResponse
  } catch (err) {
    console.error('[tiktok/callback] token fetch error:', err)
    return errRedirect('tiktok_denied')
  }

  // ── Get user info ─────────────────────────────────────────────
  let username = tokenData.open_id
  try {
    const userRes = await fetch(`${TIKTOK_USER_URL}?fields=display_name,username`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    if (userRes.ok) {
      const userData: TikTokUserResponse = await userRes.json()
      const u = userData.data?.user
      username = u?.username ?? u?.display_name ?? tokenData.open_id
    }
  } catch { /* non-critical */ }

  // ── Upsert with service role ──────────────────────────────────
  const admin = createAdminClient()
  const { error: upsertError } = await admin
    .from('social_connections')
    .upsert(
      {
        business_id:      businessId,
        platform:         'tiktok',
        access_token:     tokenData.access_token,
        refresh_token:    tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        platform_user_id: tokenData.open_id,
        platform_username: username,
        is_active:        true,
      },
      { onConflict: 'business_id,platform' }
    )

  if (upsertError) {
    console.error('[tiktok/callback] upsert error:', upsertError)
    return errRedirect('tiktok_denied')
  }

  return NextResponse.redirect(`${APP_URL}/dashboard/connections?success=tiktok`)
}
