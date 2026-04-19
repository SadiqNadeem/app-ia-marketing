import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/tokens'

interface LocationMetadata {
  newReviewUri?: string
  mapsUri?: string
}

interface LocationResponse {
  name?: string
  metadata?: LocationMetadata
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Validate business_id ───────────────────────────────────────
  const businessId = request.nextUrl.searchParams.get('business_id')
  if (!businessId) {
    return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
  }

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 3. Get Google token ───────────────────────────────────────────
  const token = await getValidToken(businessId, 'google')
  if (!token) {
    return NextResponse.json(
      { error: 'Conecta tu cuenta de Google Business primero' },
      { status: 403 }
    )
  }

  // ── 4. Get location name ──────────────────────────────────────────
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('social_connections')
    .select('platform_user_id')
    .eq('business_id', businessId)
    .eq('platform', 'google')
    .eq('is_active', true)
    .single()

  if (!conn?.platform_user_id) {
    return NextResponse.json(
      { error: 'Conexion de Google no encontrada' },
      { status: 403 }
    )
  }

  const locationName = conn.platform_user_id // e.g. "locations/987654321"

  // ── 5. Fetch location metadata from Google Business Information ───
  try {
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,metadata`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[reviews/review-link] GMB API error:', res.status, errBody)
      return NextResponse.json(
        { error: 'No se pudo obtener el enlace de Google. Intentalo de nuevo.' },
        { status: 502 }
      )
    }

    const data: LocationResponse = await res.json()
    const reviewUrl = data.metadata?.newReviewUri

    if (!reviewUrl) {
      return NextResponse.json(
        { error: 'Google no devolvio un enlace de resena para esta ubicacion.' },
        { status: 404 }
      )
    }

    return NextResponse.json({ url: reviewUrl })
  } catch (err) {
    console.error('[reviews/review-link] fetch error:', err)
    return NextResponse.json(
      { error: 'Error de conexion con Google Business' },
      { status: 502 }
    )
  }
}
