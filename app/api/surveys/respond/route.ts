import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

interface Answer {
  question_id: string
  value: number | string
}

interface RequestBody {
  token: string
  answers: Answer[]
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { token, answers } = body

  if (!token || !Array.isArray(answers)) {
    return NextResponse.json({ error: 'Datos requeridos faltantes' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Find the response record
  const { data: responseRecord } = await admin
    .from('survey_responses')
    .select('id, survey_id, business_id, completed')
    .eq('token', token)
    .single()

  if (!responseRecord) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  if (responseRecord.completed) {
    return NextResponse.json({ error: 'Esta encuesta ya fue completada' }, { status: 400 })
  }

  // Fetch the survey to get questions (for rating type detection) and threshold
  const { data: survey } = await admin
    .from('surveys')
    .select('questions, alert_threshold, business_id')
    .eq('id', responseRecord.survey_id)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  // Calculate overall score from rating answers
  const questions = survey.questions as Array<{ id: string; type: string }>
  const ratingQuestionIds = new Set(
    questions.filter(q => q.type === 'rating').map(q => q.id)
  )

  const ratingAnswers = answers.filter(
    a => ratingQuestionIds.has(a.question_id) && typeof a.value === 'number'
  )

  let overallScore: number | null = null
  if (ratingAnswers.length > 0) {
    const sum = ratingAnswers.reduce((acc, a) => acc + (a.value as number), 0)
    overallScore = Math.round((sum / ratingAnswers.length) * 10) / 10
  }

  // Update the response record
  const { error: updateError } = await admin
    .from('survey_responses')
    .update({
      answers,
      overall_score: overallScore,
      completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq('token', token)

  if (updateError) {
    console.error('[surveys/respond] update error:', updateError)
    return NextResponse.json({ error: 'Error al guardar las respuestas' }, { status: 500 })
  }

  // Alert if score is below threshold
  if (overallScore !== null && overallScore < survey.alert_threshold) {
    // Get owner email
    const { data: businessWithOwner } = await admin
      .from('businesses')
      .select('id, name, owner_id, users:owner_id(email)')
      .eq('id', responseRecord.business_id)
      .single()

    const ownerEmail = (businessWithOwner?.users as { email?: string } | null)?.email

    await createNotification({
      business_id: responseRecord.business_id,
      type: 'review_negative',
      title: 'Encuesta con nota baja',
      message: `Un cliente ha valorado su experiencia con ${overallScore}/5. Revisa los detalles.`,
      link: '/dashboard/surveys',
      sendEmail: !!ownerEmail,
      userEmail: ownerEmail,
    })
  }

  return NextResponse.json({ success: true })
}
