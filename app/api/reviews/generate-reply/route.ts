import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

interface RequestBody {
  business_id: string
  review_id: string
  star_rating: string
  comment: string
  reviewer_name?: string
}

const STAR_TO_NUM: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
}

const BUSINESS_TYPE_NAMES: Record<string, string> = {
  restaurante: 'restaurante',
  peluqueria: 'peluqueria y estetica',
  tienda: 'tienda o comercio',
  gimnasio: 'gimnasio o centro deportivo',
  bar: 'bar o cafeteria',
  otro: 'negocio local',
}

function buildKnowledgeContext(
  knowledge: Array<{ title: string; extracted_text: string }>
): string {
  if (!knowledge || knowledge.length === 0) return ''
  const MAX_CHARS = 3000
  let total = 0
  const parts: string[] = []
  for (const k of knowledge) {
    const entry = `[${k.title}]: ${k.extracted_text}`
    if (total + entry.length > MAX_CHARS) {
      const remaining = MAX_CHARS - total
      if (remaining > 100) parts.push(entry.slice(0, remaining))
      break
    }
    parts.push(entry)
    total += entry.length
  }
  return parts.join('\n\n')
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { business_id, star_rating, comment, reviewer_name } = body

  if (!business_id || !star_rating) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // ── 3. Fetch business ─────────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('name, category')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 4. Fetch knowledge context ────────────────────────────────
  const { data: knowledge } = await supabase
    .from('business_knowledge')
    .select('title, extracted_text')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })

  const knowledgeContext = buildKnowledgeContext(knowledge ?? [])
  const stars = STAR_TO_NUM[star_rating] ?? 3
  const businessTypeName = BUSINESS_TYPE_NAMES[business.category] ?? 'negocio local'
  const reviewerName = reviewer_name ?? 'el cliente'
  const reviewText = comment?.trim() ? `'${comment}'` : '(sin comentario de texto)'

  // ── 5. Build prompts ──────────────────────────────────────────
  const systemPrompt = `Eres el responsable de comunicacion de ${business.name}, un negocio de tipo ${businessTypeName}.
Tu tarea es responder a resenas de Google de forma profesional, cercana y autentica.

${knowledgeContext ? `Contexto del negocio:\n${knowledgeContext}\n` : ''}
Reglas para responder resenas:
- Resenas de 5 estrellas: agradece con entusiasmo, menciona algun detalle especifico del comentario, invita a volver
- Resenas de 4 estrellas: agradece, reconoce el comentario positivo, menciona que seguireis mejorando
- Resenas de 3 estrellas: agradece el tiempo en dejar la resena, reconoce los puntos de mejora con humildad, explica que tomareis medidas
- Resenas de 1-2 estrellas: pide disculpas sinceramente, muestra empatia, ofrece solucion concreta, invita a contactar directamente para resolver el problema
- Tono: profesional pero cercano, nunca defensivo ni agresivo
- Longitud: entre 3 y 6 lineas, no demasiado largo
- Personaliza la respuesta segun el contenido del comentario, no uses respuestas genericas
- Nunca uses emojis
- Responde siempre en el mismo idioma en que esta escrita la resena`

  const userPrompt = `Resena de ${reviewerName} con ${stars} estrella${stars !== 1 ? 's' : ''}:
${reviewText}

Genera una respuesta apropiada para esta resena.`

  // ── 6. Call OpenAI ────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    })

    const reply = completion.choices[0]?.message?.content?.trim() ?? ''
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    console.error('[reviews/generate-reply] OpenAI error:', err)
    return NextResponse.json(
      { error: 'Error al generar la respuesta. Intentalo de nuevo.' },
      { status: 500 }
    )
  }
}
