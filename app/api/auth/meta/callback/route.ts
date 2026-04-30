import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runInstagramImport } from '@/lib/instagram-import'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
const REDIRECT_URI = `${APP_URL}/api/auth/meta/callback`
const GRAPH = 'https://graph.facebook.com/v19.0'

// ── Typed helpers ─────────────────────────────────────────────────
interface TokenResponse {
  access_token: string
  expires_in?: number
  token_type?: string
}

interface FacebookPage {
  id: string
  name: string
  access_token: string
}

interface PagesResponse {
  data: FacebookPage[]
}

interface IgBusinessAccount {
  id: string
}

interface PageWithIg {
  id: string
  instagram_business_account?: IgBusinessAccount
}

interface IgUserInfo {
  id: string
  username: string
  account_type?: string // BUSINESS | MEDIA_CREATOR | PERSONAL
}

// ── Fetch wrapper that throws on non-ok ──────────────────────────
async function gFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) {
    const msg = json?.error?.message ?? `Graph API error ${res.status}`
    throw new Error(msg)
  }
  return json as T
}

// ── Redirect helpers ──────────────────────────────────────────────
function errRedirect(code: string) {
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?error=${code}`)
}

function warnRedirect(code: string) {
  return NextResponse.redirect(`${APP_URL}/dashboard/connections?warning=${code}`)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl
  const error = searchParams.get('error')
  const code = searchParams.get('code')
  const businessId = searchParams.get('state') // state = business_id

  // ── 1. User cancelled ─────────────────────────────────────────
  if (error) return errRedirect('meta_denied')

  if (!code || !businessId) return errRedirect('meta_unknown')

  try {
    // ── 2. Short-lived token ─────────────────────────────────────
    const shortTokenParams = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: REDIRECT_URI,
      code,
    })

    console.log('[meta/callback] code:', code?.slice(0, 12) + '...', '| business_id:', businessId)
    console.log('[meta/callback] redirect_uri used:', REDIRECT_URI)

    let shortToken: TokenResponse
    try {
      const res = await fetch(`${GRAPH}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: shortTokenParams.toString(),
      })
      const json = await res.json()
      console.log('[meta/callback] short-token status:', res.status, '| body:', JSON.stringify(json))
      if (!res.ok) throw new Error(json?.error?.message ?? 'token exchange failed')
      shortToken = json as TokenResponse
    } catch (err) {
      console.error('[meta/callback] short-token error:', err)
      return errRedirect('meta_token')
    }

    // ── 3. Long-lived token (~60 days) ───────────────────────────
    const longTokenUrl =
      `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: shortToken.access_token,
      })

    let longToken: TokenResponse
    try {
      longToken = await gFetch<TokenResponse>(longTokenUrl)
      console.log('[meta/callback] long-token ok, expires_in:', longToken.expires_in)
    } catch (err) {
      console.error('[meta/callback] long-token error:', err)
      return errRedirect('meta_token')
    }

    const longLivedToken = longToken.access_token
    // expires_in is in seconds; default to 60 days if absent
    const expiresInSeconds = longToken.expires_in ?? 60 * 24 * 3600
    const tokenExpiresAt = new Date(
      Date.now() + expiresInSeconds * 1000
    ).toISOString()

    // ── 4. Get Facebook Pages ─────────────────────────────────────
    let pages: PagesResponse
    try {
      pages = await gFetch<PagesResponse>(
        `${GRAPH}/me/accounts?access_token=${longLivedToken}`
      )
      console.log('[meta/callback] pages count:', pages.data?.length ?? 0, '| page ids:', pages.data?.map(p => p.id))
    } catch (err) {
      console.error('[meta/callback] pages fetch error:', err)
      return errRedirect('meta_token')
    }

    const admin = createAdminClient()

    // ── 4b. No pages — Facebook requires a Page to publish ────────
    if (!pages.data || pages.data.length === 0) {
      await admin.from('social_connections').upsert(
        {
          business_id: businessId,
          platform: 'facebook',
          access_token: longLivedToken,
          has_pages: false,
          is_active: false,
        },
        { onConflict: 'business_id,platform' }
      )
      return warnRedirect('facebook_no_pages')
    }

    // ── 4c. Multiple pages — let user choose the Facebook page ────
    if (pages.data.length > 1) {
      // Try to save Instagram using the first page that has an IG account
      const firstPage = pages.data[0]
      try {
        const pageWithIg = await gFetch<PageWithIg>(
          `${GRAPH}/${firstPage.id}?fields=instagram_business_account&access_token=${firstPage.access_token}`
        )
        if (pageWithIg.instagram_business_account?.id) {
          const igAccountId = pageWithIg.instagram_business_account.id
          const igUser = await gFetch<IgUserInfo>(
            `${GRAPH}/${igAccountId}?fields=username,account_type&access_token=${firstPage.access_token}`
          )
          const igAccountType = igUser.account_type ?? 'BUSINESS'
          const isProfessional = ['BUSINESS', 'MEDIA_CREATOR'].includes(igAccountType)
          await admin.from('social_connections').upsert(
            {
              business_id: businessId,
              platform: 'instagram',
              access_token: longLivedToken,
              refresh_token: null,
              token_expires_at: tokenExpiresAt,
              platform_user_id: igAccountId,
              platform_username: igUser.username,
              account_type: igAccountType,
              is_professional: isProfessional,
              is_active: true,
            },
            { onConflict: 'business_id,platform' }
          )
          runInstagramImport(businessId).catch(err =>
            console.error('[meta/callback] instagram import error (multi-page):', err)
          )
        }
      } catch { /* non-critical — continue to FB page selector */ }

      const pagesEncoded = encodeURIComponent(
        JSON.stringify(pages.data.map((p) => ({ id: p.id, name: p.name, token: p.access_token })))
      )
      return NextResponse.redirect(
        `${APP_URL}/dashboard/connections/facebook-pages?pages=${pagesEncoded}&business_id=${businessId}`
      )
    }

    // ── 5. Single page — use it automatically ─────────────────────
    const page = pages.data[0]
    const pageAccessToken = page.access_token
    const pageId = page.id
    const pageName = page.name

    // ── 5a. Get Instagram Business Account ───────────────────────
    let pageWithIg: PageWithIg
    try {
      pageWithIg = await gFetch<PageWithIg>(
        `${GRAPH}/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
      )
      console.log('[meta/callback] pageWithIg:', JSON.stringify(pageWithIg))
    } catch (err) {
      console.error('[meta/callback] pageWithIg fetch error:', err)
      return errRedirect('meta_unknown')
    }

    if (!pageWithIg.instagram_business_account?.id) {
      console.warn('[meta/callback] no instagram_business_account on page', pageId)
      return errRedirect('no_instagram_business')
    }

    const igAccountId = pageWithIg.instagram_business_account.id

    // ── 5b. Get Instagram username + account_type ────────────────
    let igUser: IgUserInfo
    try {
      igUser = await gFetch<IgUserInfo>(
        `${GRAPH}/${igAccountId}?fields=username,account_type&access_token=${pageAccessToken}`
      )
    } catch {
      return errRedirect('meta_unknown')
    }

    const igAccountType = igUser.account_type ?? 'BUSINESS'
    const isProfessional = ['BUSINESS', 'MEDIA_CREATOR'].includes(igAccountType)
    console.log('[meta/callback] IG account_type:', igAccountType, '| isProfessional:', isProfessional)

    // ── 6. Upsert with service role (bypasses RLS) ────────────────
    const fbExpiresAt = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString()

    const upserts = [
      // Instagram connection
      {
        business_id: businessId,
        platform: 'instagram',
        access_token: longLivedToken,
        refresh_token: null,
        token_expires_at: tokenExpiresAt,
        platform_user_id: igAccountId,
        platform_username: igUser.username,
        account_type: igAccountType,
        is_professional: isProfessional,
        is_active: true,
      },
      // Facebook page connection
      {
        business_id: businessId,
        platform: 'facebook',
        access_token: pageAccessToken,
        refresh_token: null,
        token_expires_at: fbExpiresAt,
        platform_user_id: pageId,
        platform_username: pageName,
        has_pages: true,
        is_active: true,
      },
    ]

    const { error: upsertError } = await admin
      .from('social_connections')
      .upsert(upserts, { onConflict: 'business_id,platform' })

    if (upsertError) {
      console.error('[meta/callback] upsert error:', upsertError)
      return errRedirect('meta_unknown')
    }

    // ── 7. Trigger Instagram import in background ─────────────────
    runInstagramImport(businessId).catch(err =>
      console.error('[meta/callback] instagram import error:', err)
    )

    // ── 8. Success (or personal-account warning) ──────────────────
    if (!isProfessional) {
      return NextResponse.redirect(`${APP_URL}/dashboard/connections?success=meta&warning=instagram_personal`)
    }
    return NextResponse.redirect(`${APP_URL}/dashboard/connections?success=meta`)
  } catch (err) {
    console.error('[meta/callback] unexpected error:', err)
    return errRedirect('meta_unknown')
  }
}
