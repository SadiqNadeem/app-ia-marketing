import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

interface RequestBody {
  business_id: string
  month: number
  year: number
}

interface Suggestion {
  day: number
  platform: string
  promotion_type: string | null
  title: string
  content_text: string
  hashtags: string[]
}

const MONTH_NAMES: Record<number, string> = {
  1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril',
  5: 'mayo', 6: 'junio', 7: 'julio', 8: 'agosto',
  9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
}

const SPECIAL_DATES: Record<number, string> = {
  1: 'Ano Nuevo (dia 1), Reyes Magos (dia 6), San Anton (dia 17)',
  2: 'San Valentin (dia 14), Carnaval (variable segun ano)',
  3: 'Dia Internacional de la Mujer (dia 8), San Jose (dia 19), Inicio de primavera (dia 20)',
  4: 'Semana Santa (variable), Dia del Libro (dia 23)',
  5: 'Dia del Trabajador (dia 1), Dia de la Madre (segundo domingo del mes)',
  6: 'Dia del Padre (tercer domingo del mes), Inicio del verano (dia 21)',
  7: 'Pleno verano, temporada de vacaciones',
  8: 'Verano y vacaciones, Asuncion de la Virgen (dia 15)',
  9: 'Vuelta al cole, Inicio del otono (dia 23)',
  10: 'Dia de la Hispanidad (dia 12), Halloween (dia 31)',
  11: 'Todos los Santos (dia 1), Black Friday (ultimo viernes del mes)',
  12: 'Dia de la Constitucion (dia 6), Navidad (dia 25), Nochevieja (dia 31)',
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
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { business_id, month, year } = body

  if (!business_id || !month || !year) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: business_id, month, year' },
      { status: 400 }
    )
  }

  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'Mes invalido' }, { status: 400 })
  }

  // Fetch business (verifies ownership)
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('name, category, primary_color')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json(
      { error: 'Negocio no encontrado o sin permiso' },
      { status: 403 }
    )
  }

  // Fetch knowledge context
  const { data: knowledge } = await supabase
    .from('business_knowledge')
    .select('title, extracted_text')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })

  const knowledgeContext = buildKnowledgeContext(knowledge ?? [])
  const monthName = MONTH_NAMES[month]
  const specialDates = SPECIAL_DATES[month]
  const businessTypeName = BUSINESS_TYPE_NAMES[business.category] ?? 'negocio local'

  const systemPrompt = `Eres un experto en marketing digital para negocios locales.
Vas a crear un plan de contenido para el mes de ${monthName} de ${year} para ${business.name}, un negocio de tipo ${businessTypeName}.

${knowledgeContext ? `Contexto del negocio:\n${knowledgeContext}\n` : ''}
Fechas especiales del mes: ${specialDates}

Genera exactamente 20 ideas de publicaciones para este mes.
Distribuye las publicaciones de forma logica a lo largo del mes, aprovechando las fechas especiales cuando sea relevante para el negocio.

Responde UNICAMENTE con un JSON valido con este formato exacto, sin texto adicional:
{
  "suggestions": [
    {
      "day": 3,
      "platform": "instagram",
      "promotion_type": "menu_dia",
      "title": "titulo corto de la idea",
      "content_text": "texto completo del post listo para publicar",
      "hashtags": ["hashtag1", "hashtag2"]
    }
  ]
}

Reglas para el JSON:
- day: numero del dia del mes (entre 1 y ${new Date(year, month, 0).getDate()} para este mes)
- platform: uno de instagram, facebook, tiktok
- promotion_type: uno de oferta_2x1, menu_dia, happy_hour, sorteo, evento, nuevo_producto, black_friday, navidad, san_valentin, halloween, apertura, aniversario — o null si no aplica
- title: maximo 50 caracteres, descriptivo
- content_text: texto real del post, adaptado al negocio y la plataforma, sin emojis
- hashtags: entre 5 y 10 hashtags relevantes sin el simbolo #
- Los 20 posts deben estar ordenados por day de menor a mayor
- Varia las plataformas: no todos pueden ser de instagram`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera el plan de 20 publicaciones para ${monthName} de ${year}.` },
      ],
    })

    const raw = completion.choices[0]?.message?.content?.trim() ?? ''
    let parsed: { suggestions: Suggestion[] }

    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Error al parsear la respuesta de IA' }, { status: 500 })
    }

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
      return NextResponse.json({ error: 'La IA no devolvio sugerencias validas' }, { status: 500 })
    }

    // Build posts to insert
    const postsToInsert = parsed.suggestions.map((s: Suggestion) => {
      const day = Math.min(Math.max(1, s.day), new Date(year, month, 0).getDate())
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

      return {
        business_id,
        content_text: s.content_text ?? '',
        platforms: [s.platform],
        status: 'draft',
        is_suggestion: true,
        suggestion_date: dateStr,
        promotion_type: s.promotion_type ?? null,
        title: (s.title ?? '').slice(0, 50),
        hashtags: Array.isArray(s.hashtags) ? s.hashtags : [],
        image_url: null,
        video_url: null,
        scheduled_at: null,
        published_at: null,
      }
    })

    const { error: insertError } = await supabase
      .from('posts')
      .insert(postsToInsert)

    if (insertError) {
      console.error('[calendar/generate] Insert error:', insertError)
      return NextResponse.json(
        { error: 'Error al guardar las sugerencias' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: postsToInsert.length,
      month,
      year,
    })
  } catch (err: unknown) {
    console.error('[calendar/generate] Error:', err)
    return NextResponse.json(
      { error: 'Error al generar el plan. Intentalo de nuevo.' },
      { status: 500 }
    )
  }
}
