import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'

interface Keyword {
  word: string
  count: number
}

interface InsightsResult {
  summary: string
  keywords: Keyword[]
  top_issues: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { survey_id: string; business_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { survey_id, business_id } = body

  if (!survey_id || !business_id) {
    return NextResponse.json({ error: 'Faltan parametros' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Fetch survey questions
  const { data: survey } = await admin
    .from('surveys')
    .select('questions')
    .eq('id', survey_id)
    .eq('business_id', business_id)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  // Fetch completed responses
  const { data: responses } = await admin
    .from('survey_responses')
    .select('answers, overall_score, completed_at')
    .eq('survey_id', survey_id)
    .eq('completed', true)

  if (!responses || responses.length === 0) {
    return NextResponse.json({ error: 'Sin respuestas suficientes para analizar' }, { status: 400 })
  }

  // Extract text answers
  const questions = survey.questions as Array<{ id: string; type: string; text: string }>
  const textQuestionIds = new Set(questions.filter(q => q.type === 'text').map(q => q.id))
  const textAnswers: string[] = []

  for (const r of responses) {
    const answers = r.answers as Array<{ question_id: string; value: unknown }> ?? []
    for (const a of answers) {
      if (textQuestionIds.has(a.question_id) && typeof a.value === 'string' && a.value.trim()) {
        textAnswers.push(a.value.trim())
      }
    }
  }

  if (textAnswers.length === 0) {
    return NextResponse.json({ error: 'No hay respuestas de texto para analizar' }, { status: 400 })
  }

  const scores = responses
    .filter(r => r.overall_score !== null)
    .map(r => r.overall_score as number)

  const avgScore = scores.length > 0
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null

  // Call GPT-4o
  const prompt = `Analiza las siguientes respuestas de clientes a una encuesta de satisfaccion.
Nota media de valoracion: ${avgScore !== null ? `${avgScore}/5` : 'no disponible'}
Total de respuestas completadas: ${responses.length}

Respuestas de texto de los clientes:
${textAnswers.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

Devuelve un JSON con exactamente esta estructura:
{
  "summary": "Resumen ejecutivo de 2-3 frases sobre el estado general del feedback",
  "keywords": [{"word": "palabra", "count": numero}],
  "top_issues": ["Problema o punto de mejora 1", "Problema o punto de mejora 2", "Problema o punto de mejora 3"],
  "sentiment": "positive | neutral | negative"
}

Reglas:
- keywords: las 6 palabras mas repetidas o significativas (excluye articulos, preposiciones y palabras vacias)
- top_issues: maximos 3 problemas o areas de mejora concretas, o [] si el feedback es todo positivo
- sentiment: "positive" si mayoria satisfechos, "negative" si mayoria insatisfechos, "neutral" en caso intermedio
- Todo en espanol
- Solo JSON, sin markdown ni texto adicional`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: 'Eres un analista experto en feedback de clientes. Devuelves siempre JSON valido.',
        },
        { role: 'user', content: prompt },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as InsightsResult

    return NextResponse.json({
      summary: parsed.summary ?? '',
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
      top_issues: Array.isArray(parsed.top_issues) ? parsed.top_issues.slice(0, 3) : [],
      sentiment: parsed.sentiment ?? 'neutral',
      response_count: responses.length,
      text_count: textAnswers.length,
    })
  } catch (err) {
    console.error('[surveys/insights] GPT error:', err)
    return NextResponse.json({ error: 'Error al generar insights' }, { status: 500 })
  }
}
