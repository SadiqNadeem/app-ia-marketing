import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function errRedirect(code: string) {
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?error=${code}`)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const error     = searchParams.get('error')
  const code      = searchParams.get('code')
  const stateParam = searchParams.get('state')

  if (error) return errRedirect('google_denied')
  if (!code || !stateParam) return errRedirect('google_denied')

  // ── Extract business_id from state ───────────────────────────────
  let businessId: string
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64').toString())
    businessId = decoded.business_id
    if (!businessId) throw new Error('missing business_id')
  } catch {
    console.error('[google/callback] invalid state param')
    return errRedirect('google_denied')
  }

  // ── Exchange code for tokens ──────────────────────────────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  console.log('[google/callback] token status:', tokenRes.status, '| has_access_token:', !!tokens.access_token)

  if (!tokens.access_token) {
    console.error('[google/callback] token error:', tokens.error, tokens.error_description)
    return errRedirect('token_failed')
  }

  // ── Check Google Business Profile verification ───────────────────
  let verificationStatus = 'unknown'
  let hasVerifiedLocation = false

  try {
    const accountsRes = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const accountsData = await accountsRes.json()
    const accounts: Array<{ name: string }> = accountsData.accounts ?? []

    if (accounts.length > 0) {
      const accountName = accounts[0].name
      const locationsRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      )
      const locationsData = await locationsRes.json()
      const locations: Array<{ metadata?: { isVerified?: boolean } }> = locationsData.locations ?? []
      hasVerifiedLocation = locations.some((l) => l.metadata?.isVerified === true)
      verificationStatus = hasVerifiedLocation ? 'verified' : 'unverified'
    }
  } catch (bizErr) {
    console.warn('[google/callback] business profile check failed:', bizErr)
  }

  console.log('[google/callback] verification_status:', verificationStatus, '| has_verified_location:', hasVerifiedLocation)

  // ── Upsert with service role (bypasses RLS) ───────────────────────
  const admin = createAdminClient()
  const { error: upsertError } = await admin
    .from('social_connections')
    .upsert(
      {
        business_id: businessId,
        platform: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null,
        platform_user_id: null,
        platform_username: null,
        is_active: true,
        verification_status: verificationStatus,
        has_verified_location: hasVerifiedLocation,
      },
      { onConflict: 'business_id,platform' }
    )

  if (upsertError) {
    console.error('[google/callback] upsert error:', upsertError)
    return errRedirect('save_failed')
  }

  console.log('[google/callback] connection saved for business:', businessId)
  const redirectParam = hasVerifiedLocation ? 'success=google' : 'warning=google_unverified'
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?${redirectParam}`)
}
