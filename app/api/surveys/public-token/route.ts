import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { survey_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { survey_id } = body

  if (!survey_id) {
    return NextResponse.json({ error: 'survey_id requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the survey exists and is active
  const { data: survey } = await admin
    .from('surveys')
    .select('id, business_id, is_active')
    .eq('id', survey_id)
    .eq('is_active', true)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no disponible' }, { status: 404 })
  }

  // Create a new response token
  const token = nanoid(32)

  const { error: insertError } = await admin
    .from('survey_responses')
    .insert({
      survey_id,
      business_id: survey.business_id,
      customer_id: null,
      token,
      completed: false,
    })

  if (insertError) {
    console.error('[surveys/public-token] insert error:', insertError)
    return NextResponse.json({ error: 'Error al generar enlace' }, { status: 500 })
  }

  return NextResponse.json({ token })
}
