import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { AiExampleType } from '@/types'

const MAX_CONTENT = 2000

// ── GET /api/ai-knowledge ──────────────────────────────────────────────────────
// Returns all examples, optionally filtered by ?type=post|flyer|campana

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get('type') as AiExampleType | null

  let query = supabase
    .from('ai_knowledge')
    .select('id, type, content, created_at')
    .order('created_at', { ascending: false })

  if (type) query = query.eq('type', type)

  const { data, error } = await query

  if (error) {
    console.error('[ai-knowledge] GET error:', error)
    return NextResponse.json({ error: 'Error al obtener ejemplos' }, { status: 500 })
  }

  return NextResponse.json({ examples: data ?? [] })
}

// ── POST /api/ai-knowledge ─────────────────────────────────────────────────────
// Body: { type: AiExampleType, content: string }

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { type: AiExampleType; content: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { type, content } = body
  const validTypes: AiExampleType[] = ['post', 'flyer', 'campana']

  if (!type || !validTypes.includes(type)) {
    return NextResponse.json({ error: 'Tipo invalido. Usa: post, flyer, campana' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'El contenido no puede estar vacio' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json({ error: `Maximo ${MAX_CONTENT} caracteres` }, { status: 400 })
  }

  const { data: record, error: insertError } = await supabase
    .from('ai_knowledge')
    .insert({ type, content: content.trim() })
    .select('id')
    .single()

  if (insertError || !record) {
    console.error('[ai-knowledge] POST error:', insertError)
    return NextResponse.json({ error: 'Error al guardar el ejemplo' }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: record.id })
}

// ── DELETE /api/ai-knowledge?id=xxx ───────────────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const id = request.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Falta el parametro id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ai_knowledge')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[ai-knowledge] DELETE error:', error)
    return NextResponse.json({ error: 'Error al eliminar el ejemplo' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
