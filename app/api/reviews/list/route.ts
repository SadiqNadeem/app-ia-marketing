import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/tokens'

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Verify business ownership ──────────────────────────────
  const businessId = request.nextUrl.searchParams.get('business_id')
  if (!businessId) {
    return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
  }

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 3. Get valid Google token ──────────────────────────────────
  const token = await getValidToken(businessId, 'google')
  if (!token) {
    return NextResponse.json(
      { error: 'no_google_connected', message: 'Conecta tu cuenta de Google Business primero' },
      { status: 403 }
    )
  }

  // ── 4. Get location_name from social_connections ──────────────
  const admin = createAdminClient()
  const { data: conn, error: connError } = await admin
    .from('social_connections')
    .select('platform_user_id')
    .eq('business_id', businessId)
    .eq('platform', 'google')
    .eq('is_active', true)
    .single()

  if (connError || !conn?.platform_user_id) {
    return NextResponse.json(
      { error: 'no_google_connected', message: 'Conecta tu cuenta de Google Business primero' },
      { status: 403 }
    )
  }

  const locationName = conn.platform_user_id // e.g. "locations/987654321"

  // ── 5. Call Google My Business API ───────────────────────────
  let reviews: unknown[] = []
  try {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${locationName}/reviews`)
    url.searchParams.set('pageSize', '50')
    url.searchParams.set('orderBy', 'updateTime desc')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[reviews/list] GMB API error:', res.status, errBody)
      return NextResponse.json(
        { error: 'Error al obtener resenas de Google Business', details: res.status },
        { status: 502 }
      )
    }

    const data = await res.json()
    reviews = data.reviews ?? []
  } catch (err) {
    console.error('[reviews/list] fetch error:', err)
    return NextResponse.json({ error: 'Error de conexion con Google Business' }, { status: 502 })
  }

  return NextResponse.json({
    reviews,
    totalCount: reviews.length,
  })
}
