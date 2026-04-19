import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

type EmailType = 'newsletter' | 'promotion' | 'announcement' | 'seasonal'

interface RequestBody {
  business_id: string
  type: EmailType
  promotion_type?: string
  custom_instructions?: string
}

interface GeneratedEmail {
  subject: string
  preview_text: string
  headline: string
  body: string
  cta_text: string
  cta_url: string
  footer_text: string
}

const TYPE_DESCRIPTIONS: Record<EmailType, string> = {
  newsletter: 'un newsletter con novedades del negocio y contenido de valor para los clientes',
  promotion: 'un email de promocion con una oferta especifica, descuento o evento',
  announcement: 'un comunicado importante (cambio de horario, nueva apertura, novedad relevante)',
  seasonal: 'contenido de temporada relevante para la epoca del ano actual',
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const { business_id, type, promotion_type, custom_instructions } = body

  if (!business_id || !type) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Fetch business and verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, business_type_id, primary_color')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Fetch business type name
  const { data: businessType } = await supabase
    .from('business_types')
    .select('name')
    .eq('id', business.business_type_id)
    .single()

  const businessTypeName = businessType?.name ?? 'negocio local'

  // Fetch business knowledge
  const { data: knowledge } = await supabase
    .from('business_knowledge')
    .select('title, extracted_text')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })
    .limit(5)

  const knowledgeContext = knowledge?.length
    ? knowledge.map(k => `[${k.title}]\n${k.extracted_text}`).join('\n\n').slice(0, 2000)
    : 'Sin informacion adicional disponible.'

  const typeDescription = TYPE_DESCRIPTIONS[type] ?? TYPE_DESCRIPTIONS.newsletter

  let additionalContext = ''
  if (type === 'promotion' && promotion_type) {
    additionalContext += `\nTipo de promocion: ${promotion_type}.`
  }
  if (custom_instructions) {
    additionalContext += `\nInstrucciones adicionales: ${custom_instructions}`
  }

  const systemPrompt = `Eres un experto en email marketing para negocios locales.
Genera el contenido completo de un email de marketing para ${business.name},
un negocio de tipo ${businessTypeName}.

Contexto del negocio:
${knowledgeContext}

El email es de tipo: ${typeDescription}.${additionalContext}

IMPORTANTE:
- No uses emojis en ningun campo
- El asunto debe ser directo, concreto y atractivo
- El cuerpo debe sonar cercano, humano y relevante para clientes locales
- Si cta_url esta vacio, devuelve cadena vacia

Responde UNICAMENTE con JSON valido con esta estructura exacta:
{
  "subject": "asunto del email (maximo 60 caracteres, atractivo y directo)",
  "preview_text": "texto de preview visible en el cliente de email (maximo 90 chars)",
  "headline": "titulo principal del email (maximo 80 chars)",
  "body": "cuerpo principal del email en HTML basico (p, strong, br, ul, li). Maximo 3 parrafos.",
  "cta_text": "texto del boton de llamada a la accion (maximo 30 chars)",
  "cta_url": "",
  "footer_text": "texto del pie del email (breve, ej: horarios, direccion)"
}`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 800,
    temperature: 0.75,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Genera un email de tipo "${type}" para ${business.name}.` },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  let generated: GeneratedEmail
  try {
    generated = JSON.parse(raw) as GeneratedEmail
  } catch {
    return NextResponse.json({ error: 'Error al parsear respuesta de IA' }, { status: 500 })
  }

  return NextResponse.json(generated)
}
