import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { survey_id: string; is_active: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { survey_id, is_active } = body

  // Verify survey belongs to user's business
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, business_id')
    .eq('id', survey_id)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', survey.business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  await supabase
    .from('surveys')
    .update({ is_active })
    .eq('id', survey_id)

  return NextResponse.json({ success: true })
}
