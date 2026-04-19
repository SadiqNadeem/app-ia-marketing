import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: responseRecord } = await admin
    .from('survey_responses')
    .select('id, completed, survey_id, business_id')
    .eq('token', token)
    .single()

  if (!responseRecord) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  if (responseRecord.completed) {
    return NextResponse.json({ error: 'Ya completada' }, { status: 410 })
  }

  // Fetch survey (only public fields)
  const { data: survey } = await admin
    .from('surveys')
    .select('id, name, questions')
    .eq('id', responseRecord.survey_id)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  // Fetch business (only public fields)
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, logo_url, primary_color, slug, landing_enabled')
    .eq('id', responseRecord.business_id)
    .single()

  return NextResponse.json({
    survey: {
      id: survey.id,
      name: survey.name,
      questions: survey.questions,
    },
    business: {
      id: business?.id,
      name: business?.name ?? '',
      logo_url: business?.logo_url ?? null,
      primary_color: business?.primary_color ?? '#2563EB',
      slug: business?.slug ?? null,
      landing_enabled: business?.landing_enabled ?? false,
    },
  })
}
