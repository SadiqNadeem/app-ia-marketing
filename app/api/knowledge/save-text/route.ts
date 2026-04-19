import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const MAX_TEXT = 3000

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: { business_id: string; title: string; text: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { business_id, title, text } = body

  if (!business_id || !title || !text) {
    return NextResponse.json({ error: 'Faltan campos: business_id, title, text' }, { status: 400 })
  }

  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: `El texto no puede superar los ${MAX_TEXT} caracteres` }, { status: 400 })
  }

  // ── 3. Verify business ownership ───────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 4. Save to business_knowledge ─────────────────────────────
  const { data: record, error: insertError } = await supabase
    .from('business_knowledge')
    .insert({
      business_id,
      type: 'text',
      title: title.trim(),
      extracted_text: text.trim(),
    })
    .select('id')
    .single()

  if (insertError || !record) {
    console.error('[knowledge/save-text] insert error:', insertError)
    return NextResponse.json({ error: 'Error al guardar el texto' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: record.id })
}
