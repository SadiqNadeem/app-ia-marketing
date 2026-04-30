import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { v4: uuidv4 } = require('uuid') as { v4: () => string }
import { notifyTrendAvailable } from '@/lib/notifications'

const BUSINESS_TYPE_NAMES: Record<string, string> = {
  restaurante: 'restaurante',
  peluqueria: 'peluqueria y estetica',
  tienda: 'tienda o comercio',
  gimnasio: 'gimnasio o centro deportivo',
  bar: 'bar o cafeteria',
  otro: 'negocio local',
}

// Returns notable special dates that fall within [monday, sunday]
function getSpecialDatesForWeek(monday: Date, sunday: Date): string {
  const allDates: { month: number; day: number; label: string }[] = [
    { month: 1, day: 1, label: 'Ano Nuevo' },
    { month: 1, day: 6, label: 'Reyes Magos' },
    { month: 2, day: 14, label: 'San Valentin' },
    { month: 3, day: 8, label: 'Dia Internacional de la Mujer' },
    { month: 3, day: 19, label: 'San Jose' },
    { month: 3, day: 20, label: 'Inicio de primavera' },
    { month: 4, day: 23, label: 'Dia del Libro' },
    { month: 5, day: 1, label: 'Dia del Trabajador' },
    { month: 6, day: 21, label: 'Inicio del verano' },
    { month: 8, day: 15, label: 'Asuncion de la Virgen' },
    { month: 9, day: 23, label: 'Inicio del otono' },
    { month: 10, day: 12, label: 'Dia de la Hispanidad' },
    { month: 10, day: 31, label: 'Halloween' },
    { month: 11, day: 1, label: 'Todos los Santos' },
    { month: 12, day: 6, label: 'Dia de la Constitucion' },
    { month: 12, day: 25, label: 'Navidad' },
    { month: 12, day: 31, label: 'Nochevieja' },
  ]

  const matches: string[] = []
  for (let d = new Date(monday); d <= sunday; d.setDate(d.getDate() + 1)) {
    const m = d.getMonth() + 1
    const day = d.getDate()
    for (const sd of allDates) {
      if (sd.month === m && sd.day === day) {
        matches.push(`${sd.label} (${String(day).padStart(2, '0')}/${String(m).padStart(2, '0')})`)
      }
    }
  }
  return matches.length > 0 ? matches.join(', ') : 'ninguna especial'
}

function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function getMondayOfCurrentWeek(): Date {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  monday.setHours(0, 0, 0, 0)
  return monday
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()

  const monday = getMondayOfCurrentWeek()
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const weekStart = monday.toISOString().split('T')[0]

  // Fetch all businesses
  const { data: businesses, error: bizError } = await admin
    .from('businesses')
    .select('id, name, category')

  if (bizError || !businesses) {
    return NextResponse.json({ error: 'Error al obtener negocios' }, { status: 500 })
  }

  const specialDates = getSpecialDatesForWeek(monday, sunday)
  const mondayStr = formatDate(monday)
  const sundayStr = formatDate(sunday)

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const business of businesses) {
    // Check if already generated for this week
    const { data: existing } = await admin
      .from('trends')
      .select('id')
      .eq('business_id', business.id)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (existing) {
      skipped++
      continue
    }

    // Knowledge context (first 1000 chars)
    const { data: knowledge } = await admin
      .from('business_knowledge')
      .select('extracted_text')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(3)

    const knowledgeContext = (knowledge ?? [])
      .map((k) => k.extracted_text)
      .join('\n')
      .slice(0, 1000)

    const businessTypeName = BUSINESS_TYPE_NAMES[business.category] ?? 'negocio local'

    const systemPrompt = `Eres un experto en marketing para negocios locales de tipo ${businessTypeName}.`

    const userPrompt = `Genera 3 ideas de contenido para la semana del ${mondayStr} al ${sundayStr} para ${business.name}, un negocio de tipo ${businessTypeName}.

Contexto del negocio: ${knowledgeContext || 'Sin informacion adicional disponible'}
Fechas especiales esta semana: ${specialDates}

Responde UNICAMENTE con JSON valido:
{
  "suggestions": [
    {
      "id": "uuid-aleatorio",
      "title": "titulo corto maximo 60 chars",
      "reason": "por que es relevante publicar esto esta semana (1 frase)",
      "platform": "instagram",
      "content_text": "texto completo del post sin emojis",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
      "promotion_type": null,
      "used": false
    }
  ]
}`

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1500,
        temperature: 0.85,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })

      const raw = completion.choices[0]?.message?.content?.trim() ?? ''
      let parsed: { suggestions: unknown[] }

      try {
        parsed = JSON.parse(raw)
      } catch {
        console.error(`[trends/generate] Parse error for business ${business.id}`)
        errors++
        continue
      }

      if (!Array.isArray(parsed.suggestions)) {
        errors++
        continue
      }

      // Ensure each suggestion has a valid uuid
      const suggestions = parsed.suggestions.map((s: unknown) => {
        const suggestion = s as Record<string, unknown>
        return {
          ...suggestion,
          id: uuidv4(),
          used: false,
        }
      })

      const { error: insertError } = await admin
        .from('trends')
        .insert({ business_id: business.id, week_start: weekStart, suggestions })

      if (insertError) {
        console.error(`[trends/generate] Insert error for business ${business.id}:`, insertError)
        errors++
        continue
      }

      notifyTrendAvailable(business.id).catch(() => {})
      processed++
    } catch (err) {
      console.error(`[trends/generate] Error for business ${business.id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ processed, skipped, errors })
}
