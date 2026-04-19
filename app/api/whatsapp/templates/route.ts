import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const { data: templates, error } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[whatsapp/templates GET]', error)
    return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 })
  }

  return NextResponse.json({ templates: templates ?? [] })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: {
    name: string
    meta_template_name: string
    category?: string
    language?: string
    header_text?: string
    body_text: string
    footer_text?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { name, meta_template_name, category, language, header_text, body_text, footer_text } = body

  if (!name?.trim() || !meta_template_name?.trim() || !body_text?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Extract variable placeholders {{1}}, {{2}}, etc.
  const varMatches = [...body_text.matchAll(/\{\{(\d+)\}\}/g)]
  const variables = [...new Set(varMatches.map(m => m[1]))].sort()

  const { data: template, error } = await supabase
    .from('whatsapp_templates')
    .insert({
      business_id: business.id,
      name: name.trim(),
      meta_template_name: meta_template_name.trim(),
      category: category ?? 'MARKETING',
      language: language ?? 'es',
      header_text: header_text?.trim() || null,
      body_text: body_text.trim(),
      footer_text: footer_text?.trim() || null,
      variables,
      is_approved: false,
    })
    .select()
    .single()

  if (error) {
    console.error('[whatsapp/templates POST]', error)
    return NextResponse.json({ error: 'Error al crear la plantilla' }, { status: 500 })
  }

  return NextResponse.json({ success: true, template })
}
