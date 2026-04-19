import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const AI_CONTEXT_MAX = 2000

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, category')
    .eq('owner_id', user.id)
    .single()
  return NextResponse.json({ business: business ?? null })
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: { ai_context: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { ai_context } = body

  if (typeof ai_context !== 'string') {
    return NextResponse.json({ error: 'Campo ai_context requerido' }, { status: 400 })
  }

  if (ai_context.length > AI_CONTEXT_MAX) {
    return NextResponse.json(
      { error: 'El texto no puede superar los 2000 caracteres' },
      { status: 400 }
    )
  }

  // ── 3. Update business ─────────────────────────────────────────
  const { error } = await supabase
    .from('businesses')
    .update({ ai_context })
    .eq('owner_id', user.id)

  if (error) {
    console.error('[business/context] update error:', error)
    return NextResponse.json({ error: 'Error al guardar la informacion' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
