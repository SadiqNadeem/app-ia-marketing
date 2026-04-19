import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface SummaryInput {
  by_platform: { platform: string; avg_engagement: number; posts_count: number; total_reach: number }[]
  totals: { total_reach: number; total_impressions: number; avg_engagement: number; posts_count: number }
  best_hours: { hour: number; avg_engagement: number }[]
  top_posts: { content_text: string; engagement_rate: number }[]
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { business_id: string; summary: SummaryInput }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, summary } = body

  if (!business_id || !summary) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify ownership + get business info
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, category')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const platforms = summary.by_platform.map(p => p.platform).join(', ') || 'ninguna'
  const bestHour = summary.best_hours[0]?.hour ?? null
  const bestPlatform = summary.by_platform.sort((a, b) => b.avg_engagement - a.avg_engagement)[0]?.platform ?? 'ninguna'
  const topPost = summary.top_posts[0]
  const topPostText = topPost ? topPost.content_text.slice(0, 120) : null
  const topEngagement = topPost?.engagement_rate ?? 0

  const userPrompt = `Analiza estos datos de rendimiento de los ultimos 30 dias para ${business.name} (${business.category}) y da 3 recomendaciones concretas y accionables:

Metricas:
- Plataformas activas: ${platforms}
- Alcance total: ${summary.totals.total_reach}
- Impresiones totales: ${summary.totals.total_impressions}
- Engagement medio: ${summary.totals.avg_engagement}%
- Posts publicados: ${summary.totals.posts_count}
- Mejor hora de publicacion: ${bestHour !== null ? `${bestHour}:00h` : 'sin datos'}
- Plataforma con mejor engagement: ${bestPlatform}
${topPostText ? `\nTop post (mayor engagement): "${topPostText}" con ${topEngagement}% de engagement` : ''}

Da exactamente 3 recomendaciones en este formato JSON:
{"insights": [{"title": "titulo corto", "description": "explicacion concreta de que hacer y por que (2-3 frases)", "priority": "alta" | "media" | "baja"}]}`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en marketing digital y analisis de datos para negocios locales. Responde siempre en JSON valido, sin texto adicional, sin emojis.',
        },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 800,
      temperature: 0.7,
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(raw) as { insights?: unknown[] }

    if (!Array.isArray(parsed.insights)) {
      return NextResponse.json({ error: 'Respuesta de IA invalida' }, { status: 500 })
    }

    return NextResponse.json({ insights: parsed.insights })
  } catch (err) {
    console.error('[analytics/insights] GPT error:', err)
    return NextResponse.json({ error: 'Error al generar recomendaciones' }, { status: 500 })
  }
}
