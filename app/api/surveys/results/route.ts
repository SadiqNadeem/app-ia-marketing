import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const survey_id = searchParams.get('survey_id')
  const business_id = searchParams.get('business_id')

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

  // Fetch survey
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, questions, alert_threshold')
    .eq('id', survey_id)
    .eq('business_id', business_id)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  // Fetch all responses
  const { data: responses } = await supabase
    .from('survey_responses')
    .select('id, answers, overall_score, completed, completed_at, sent_at')
    .eq('survey_id', survey_id)

  const allResponses = responses ?? []
  const completedResponses = allResponses.filter(r => r.completed)

  const total_sent = allResponses.length
  const total_completed = completedResponses.length
  const completion_rate = total_sent > 0 ? Math.round((total_completed / total_sent) * 100) : 0

  // Overall average
  const scoresWithValue = completedResponses.filter(r => r.overall_score !== null)
  const overall_avg =
    scoresWithValue.length > 0
      ? Math.round(
          (scoresWithValue.reduce((s, r) => s + (r.overall_score as number), 0) /
            scoresWithValue.length) *
            10
        ) / 10
      : 0

  // Question averages (only rating type)
  const questions = survey.questions as Array<{ id: string; type: string; text: string }>
  const ratingQuestions = questions.filter(q => q.type === 'rating')

  const question_averages = ratingQuestions.map(q => {
    const questionAnswers = completedResponses
      .flatMap(r => (r.answers as Array<{ question_id: string; value: unknown }>) ?? [])
      .filter(a => a.question_id === q.id && typeof a.value === 'number')

    const avg =
      questionAnswers.length > 0
        ? Math.round(
            (questionAnswers.reduce((s, a) => s + (a.value as number), 0) /
              questionAnswers.length) *
              10
          ) / 10
        : 0

    return {
      question_id: q.id,
      question_text: q.text,
      avg_score: avg,
      response_count: questionAnswers.length,
    }
  })

  // Score distribution (1-5)
  const score_distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of scoresWithValue) {
    const rounded = Math.round(r.overall_score as number)
    if (rounded >= 1 && rounded <= 5) {
      score_distribution[rounded] = (score_distribution[rounded] ?? 0) + 1
    }
  }

  // Recent text responses (last 10)
  const textQuestionIds = new Set(
    questions.filter(q => q.type === 'text').map(q => q.id)
  )

  const recent_text_responses: Array<{ text: string; completed_at: string }> = []
  const sortedCompleted = [...completedResponses].sort(
    (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
  )

  for (const r of sortedCompleted) {
    if (recent_text_responses.length >= 10) break
    const textAnswers = (r.answers as Array<{ question_id: string; value: unknown }> ?? []).filter(
      a => textQuestionIds.has(a.question_id) && typeof a.value === 'string' && (a.value as string).trim()
    )
    for (const a of textAnswers) {
      if (recent_text_responses.length >= 10) break
      recent_text_responses.push({
        text: a.value as string,
        completed_at: r.completed_at,
      })
    }
  }

  // Daily scores (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const dailyMap: Record<string, { scores: number[]; count: number }> = {}
  for (const r of completedResponses) {
    if (!r.completed_at || !r.overall_score) continue
    const d = new Date(r.completed_at)
    if (d < thirtyDaysAgo) continue
    const dateKey = d.toISOString().slice(0, 10)
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { scores: [], count: 0 }
    dailyMap[dateKey].scores.push(r.overall_score as number)
    dailyMap[dateKey].count++
  }

  const daily_scores = Object.entries(dailyMap)
    .map(([date, { scores, count }]) => ({
      date,
      avg_score:
        Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
      count,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    total_sent,
    total_completed,
    completion_rate,
    overall_avg,
    question_averages,
    score_distribution,
    recent_text_responses,
    daily_scores,
  })
}
