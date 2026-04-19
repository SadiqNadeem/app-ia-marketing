import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${APP_URL}/api/auth/google/callback`
  )
}

function errRedirect(code: string) {
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?error=${code}`)
}

interface GmbAccount {
  name: string
  accountName?: string
  type?: string
}

interface GmbAccountsResponse {
  accounts?: GmbAccount[]
}

interface GmbLocation {
  name: string
  title?: string
}

interface GmbLocationsResponse {
  locations?: GmbLocation[]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const error = searchParams.get('error')
  const code = searchParams.get('code')
  const businessId = searchParams.get('state')

  // ── 1. User cancelled ─────────────────────────────────────────
  if (error) return errRedirect('google_denied')
  if (!code || !businessId) return errRedirect('google_denied')

  const oauth2Client = getOAuth2Client()

  // ── 2. Exchange code for tokens ───────────────────────────────
  let accessToken: string
  let refreshToken: string | null
  let expiryDate: number | null

  try {
    const { tokens } = await oauth2Client.getToken(code)
    if (!tokens.access_token) throw new Error('No access_token in response')
    accessToken = tokens.access_token
    refreshToken = tokens.refresh_token ?? null
    expiryDate = tokens.expiry_date ?? null
  } catch (err) {
    console.error('[google/callback] token exchange error:', err)
    return errRedirect('google_denied')
  }

  oauth2Client.setCredentials({ access_token: accessToken })

  // ── 3. Get Google Business accounts ───────────────────────────
  let accountName: string
  try {
    const res = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) throw new Error(`accounts API ${res.status}`)
    const data: GmbAccountsResponse = await res.json()
    const firstAccount = data.accounts?.[0]
    if (!firstAccount?.name) throw new Error('No accounts found')
    accountName = firstAccount.name // e.g. "accounts/123456789"
  } catch (err) {
    console.error('[google/callback] accounts error:', err)
    return errRedirect('google_denied')
  }

  // ── 4. Get locations (business listings) ──────────────────────
  let locationName: string
  let locationTitle: string

  try {
    const res = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    if (!res.ok) throw new Error(`locations API ${res.status}`)
    const data: GmbLocationsResponse = await res.json()
    const firstLocation = data.locations?.[0]
    if (!firstLocation?.name) throw new Error('No locations found')
    locationName = firstLocation.name   // e.g. "locations/987654321"
    locationTitle = firstLocation.title ?? locationName
  } catch (err) {
    console.error('[google/callback] locations error:', err)
    return errRedirect('google_denied')
  }

  // ── 5. Upsert with service role ───────────────────────────────
  const admin = createAdminClient()
  const tokenExpiresAt = expiryDate
    ? new Date(expiryDate).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString()

  const { error: upsertError } = await admin
    .from('social_connections')
    .upsert(
      {
        business_id: businessId,
        platform: 'google',
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        platform_user_id: locationName,
        platform_username: locationTitle,
        is_active: true,
      },
      { onConflict: 'business_id,platform' }
    )

  if (upsertError) {
    console.error('[google/callback] upsert error:', upsertError)
    return errRedirect('google_denied')
  }

  // ── 6. Redirect to success ────────────────────────────────────
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?success=google`)
}
