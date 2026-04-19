import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  business_id: string
  landing_enabled?: boolean
  landing_description?: string
  landing_show_menu?: boolean
  landing_show_reviews?: boolean
  landing_cta_text?: string
  landing_cta_phone?: boolean
  landing_cta_whatsapp?: boolean
  landing_cta_maps?: boolean
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, ...fields } = body

  if (!business_id) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {}
  const allowed = [
    'landing_enabled', 'landing_description', 'landing_show_menu',
    'landing_show_reviews', 'landing_cta_text', 'landing_cta_phone',
    'landing_cta_whatsapp', 'landing_cta_maps',
  ]
  for (const key of allowed) {
    if (key in fields) {
      updateData[key] = (fields as Record<string, unknown>)[key]
    }
  }

  const { data: business, error: updateError } = await supabase
    .from('businesses')
    .update(updateData)
    .eq('id', business_id)
    .select()
    .single()

  if (updateError) {
    console.error('[landing/save]', updateError)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }

  return NextResponse.json({ business })
}
