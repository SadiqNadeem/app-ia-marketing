import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getValidToken } from '@/lib/tokens'

interface RequestBody {
  business_id: string
  review_id: string
  reply_text: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { business_id, review_id, reply_text } = body

  if (!business_id || !review_id || !reply_text?.trim()) {
    return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // ── 3. Verify business ownership ──────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ success: false, error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 4. Get valid Google token ──────────────────────────────────
  const token = await getValidToken(business_id, 'google')
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Conecta tu cuenta de Google Business primero' },
      { status: 403 }
    )
  }

  // ── 5. Get location_name ───────────────────────────────────────
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('social_connections')
    .select('platform_user_id')
    .eq('business_id', business_id)
    .eq('platform', 'google')
    .eq('is_active', true)
    .single()

  if (!conn?.platform_user_id) {
    return NextResponse.json(
      { success: false, error: 'Conexion de Google no encontrada' },
      { status: 403 }
    )
  }

  const locationName = conn.platform_user_id

  // ── 6. Publish reply to Google My Business ────────────────────
  try {
    const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews/${review_id}/reply`

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ comment: reply_text.trim() }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      console.error('[reviews/publish-reply] GMB error:', res.status, errBody)
      return NextResponse.json(
        { success: false, error: `Error de Google Business (${res.status}). Verifica los permisos.` },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[reviews/publish-reply] fetch error:', err)
    return NextResponse.json(
      { success: false, error: 'Error de conexion con Google Business' },
      { status: 502 }
    )
  }
}
