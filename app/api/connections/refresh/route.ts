import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  // Connections expiring within the next 7 days
  const threshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: connections } = await supabase
    .from('social_connections')
    .select('*')
    .lt('expires_at', threshold)
    .eq('is_valid', true)
    .not('refresh_token', 'is', null)

  if (!connections?.length) return NextResponse.json({ refreshed: 0 })

  let refreshed = 0

  for (const conn of connections) {
    try {
      let newTokens: Record<string, unknown> | null = null

      if (conn.platform === 'google') {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: conn.refresh_token,
            grant_type: 'refresh_token',
          }),
        })
        newTokens = await res.json()
      }

      if (conn.platform === 'facebook') {
        const res = await fetch(
          `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.META_APP_ID}&client_secret=${process.env.META_APP_SECRET}&fb_exchange_token=${conn.access_token}`
        )
        newTokens = await res.json()
      }

      if (conn.platform === 'instagram') {
        const res = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${conn.access_token}`
        )
        newTokens = await res.json()
      }

      if (conn.platform === 'tiktok') {
        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_key: process.env.TIKTOK_CLIENT_KEY!,
            client_secret: process.env.TIKTOK_CLIENT_SECRET!,
            grant_type: 'refresh_token',
            refresh_token: conn.refresh_token,
          }),
        })
        const body = await res.json()
        newTokens = body.data ?? null
      }

      if (newTokens?.access_token) {
        const expiresIn = typeof newTokens.expires_in === 'number' ? newTokens.expires_in : null
        await supabase
          .from('social_connections')
          .update({
            access_token: newTokens.access_token,
            refresh_token: (newTokens.refresh_token as string | undefined) ?? conn.refresh_token,
            expires_at: expiresIn
              ? new Date(Date.now() + expiresIn * 1000).toISOString()
              : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            last_refreshed_at: new Date().toISOString(),
            is_valid: true,
            error_message: null,
            error_count: 0,
          })
          .eq('id', conn.id)
        refreshed++
      } else {
        await supabase
          .from('social_connections')
          .update({
            is_valid: false,
            error_message: 'Token caducado. El usuario debe volver a conectar la cuenta.',
            error_count: (conn.error_count ?? 0) + 1,
          })
          .eq('id', conn.id)
      }
    } catch {
      await supabase
        .from('social_connections')
        .update({
          is_valid: false,
          error_message: 'Error al renovar el token.',
          error_count: (conn.error_count ?? 0) + 1,
        })
        .eq('id', conn.id)
    }
  }

  return NextResponse.json({ refreshed })
}
