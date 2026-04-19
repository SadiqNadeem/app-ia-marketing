import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const business_id = searchParams.get('business_id')

  if (!business_id) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
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

  const { data: surveys, error } = await supabase
    .from('surveys')
    .select('id, name, questions, is_active, alert_threshold, created_at')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Error al obtener encuestas' }, { status: 500 })
  }

  // Attach quick metrics for each survey
  const surveyIds = (surveys ?? []).map(s => s.id)

  const { data: allResponses } = await supabase
    .from('survey_responses')
    .select('survey_id, completed, overall_score')
    .in('survey_id', surveyIds.length > 0 ? surveyIds : ['__none__'])

  const metricsMap: Record<string, { sent: number; completed: number; scores: number[] }> = {}
  for (const r of allResponses ?? []) {
    if (!metricsMap[r.survey_id]) metricsMap[r.survey_id] = { sent: 0, completed: 0, scores: [] }
    metricsMap[r.survey_id].sent++
    if (r.completed) {
      metricsMap[r.survey_id].completed++
      if (r.overall_score !== null) metricsMap[r.survey_id].scores.push(r.overall_score)
    }
  }

  const surveysWithMetrics = (surveys ?? []).map(s => {
    const m = metricsMap[s.id] ?? { sent: 0, completed: 0, scores: [] }
    const avg =
      m.scores.length > 0
        ? Math.round((m.scores.reduce((a, b) => a + b, 0) / m.scores.length) * 10) / 10
        : null
    return { ...s, metrics: { sent: m.sent, completed: m.completed, avg_score: avg } }
  })

  return NextResponse.json({ surveys: surveysWithMetrics })
}
