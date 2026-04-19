import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyTokenExpiring } from '@/lib/notifications'
import type { SocialPlatform } from '@/types'

const GRAPH = 'https://graph.facebook.com/v19.0'
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'

// ── Thresholds ───────────────────────────────────────────────────
const META_THRESHOLD_MS   = 7 * 24 * 60 * 60 * 1000  // 7 days
const TIKTOK_THRESHOLD_MS = 1 * 60 * 60 * 1000        // 1 hour
const GOOGLE_THRESHOLD_MS = 5 * 60 * 1000             // 5 minutes

// ── Shared helper: fetch a connection by id ───────────────────────
async function fetchConn(connectionId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('social_connections')
    .select('id, access_token, refresh_token, token_expires_at')
    .eq('id', connectionId)
    .single()
  return { conn: error ? null : data, admin }
}

// ── Meta (Instagram / Facebook) ──────────────────────────────────
/**
 * Refreshes a Meta token if it expires within 7 days.
 */
export async function refreshMetaToken(connectionId: string): Promise<boolean> {
  const { conn, admin } = await fetchConn(connectionId)
  if (!conn) return false

  // Not yet due for refresh?
  if (conn.token_expires_at) {
    const remaining = new Date(conn.token_expires_at).getTime() - Date.now()
    if (remaining > META_THRESHOLD_MS) return true
  }

  try {
    const url =
      `${GRAPH}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: conn.access_token,
      })

    const res = await fetch(url)
    if (!res.ok) return false
    const data = await res.json()
    if (!data.access_token) return false

    const expiresInSec: number = data.expires_in ?? 60 * 24 * 3600
    const newExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()

    const { error } = await admin
      .from('social_connections')
      .update({ access_token: data.access_token, token_expires_at: newExpiresAt })
      .eq('id', connectionId)

    return !error
  } catch {
    return false
  }
}

// ── TikTok ───────────────────────────────────────────────────────
/**
 * Refreshes a TikTok access_token (24h) using its refresh_token (365d).
 * Triggers when less than 1 hour remains.
 */
export async function refreshTikTokToken(connectionId: string): Promise<boolean> {
  const { conn, admin } = await fetchConn(connectionId)
  if (!conn) return false

  // Not yet due for refresh?
  if (conn.token_expires_at) {
    const remaining = new Date(conn.token_expires_at).getTime() - Date.now()
    if (remaining > TIKTOK_THRESHOLD_MS) return true
  }

  if (!conn.refresh_token) return false

  try {
    const body = new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: conn.refresh_token,
    })

    const res = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) return false
    const data = await res.json()
    if (!data.access_token) return false

    const expiresInSec: number = data.expires_in ?? 86400
    const newExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString()

    const { error } = await admin
      .from('social_connections')
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? conn.refresh_token,
        token_expires_at: newExpiresAt,
      })
      .eq('id', connectionId)

    return !error
  } catch {
    return false
  }
}

// ── Google ───────────────────────────────────────────────────────
/**
 * Refreshes a Google access_token using googleapis.
 * Triggers when less than 5 minutes remain.
 */
export async function refreshGoogleToken(connectionId: string): Promise<boolean> {
  const { conn, admin } = await fetchConn(connectionId)
  if (!conn) return false

  // Not yet due for refresh?
  if (conn.token_expires_at) {
    const remaining = new Date(conn.token_expires_at).getTime() - Date.now()
    if (remaining > GOOGLE_THRESHOLD_MS) return true
  }

  if (!conn.refresh_token) return false

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    )
    oauth2Client.setCredentials({ refresh_token: conn.refresh_token })

    const { credentials } = await oauth2Client.refreshAccessToken()
    if (!credentials.access_token) return false

    const newExpiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString()

    const { error } = await admin
      .from('social_connections')
      .update({
        access_token: credentials.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq('id', connectionId)

    return !error
  } catch {
    return false
  }
}

// ── getValidToken ────────────────────────────────────────────────
/**
 * Returns a valid, refreshed access token for a given business + platform.
 * Covers all 4 platforms: instagram, facebook, tiktok, google.
 * Returns null if no active connection exists or refresh fails.
 */
export async function getValidToken(
  businessId: string,
  platform: SocialPlatform
): Promise<string | null> {
  const admin = createAdminClient()

  // 1. Find active connection
  const { data: conn, error } = await admin
    .from('social_connections')
    .select('id, access_token, is_active, token_expires_at')
    .eq('business_id', businessId)
    .eq('platform', platform)
    .eq('is_active', true)
    .single()

  if (error || !conn) return null

  // 1b. Warn if token expires within 7 days (only for Meta; Google/TikTok auto-refresh)
  if (
    (platform === 'instagram' || platform === 'facebook') &&
    conn.token_expires_at
  ) {
    const remaining = new Date(conn.token_expires_at).getTime() - Date.now()
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
    if (remaining > 0 && remaining < SEVEN_DAYS_MS) {
      // Lookup owner email from businesses table
      admin
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .single()
        .then(async ({ data: biz }) => {
          if (!biz?.owner_id) return
          const { data: authUser } = await admin.auth.admin.getUserById(biz.owner_id)
          const email = authUser?.user?.email
          if (email) {
            notifyTokenExpiring(businessId, platform, email).catch(() => {})
          }
        })
        .catch(() => {})
    }
  }

  // 2. Refresh based on platform
  let refreshed = true

  if (platform === 'instagram' || platform === 'facebook') {
    refreshed = await refreshMetaToken(conn.id)
  } else if (platform === 'tiktok') {
    refreshed = await refreshTikTokToken(conn.id)
  } else if (platform === 'google') {
    refreshed = await refreshGoogleToken(conn.id)
  }

  if (!refreshed) return null

  // 3. Re-fetch to get the possibly updated token
  const { data: fresh, error: freshError } = await admin
    .from('social_connections')
    .select('access_token')
    .eq('id', conn.id)
    .single()

  if (freshError || !fresh) return null
  return fresh.access_token
}
