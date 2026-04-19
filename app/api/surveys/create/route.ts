import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Question {
  id: string
  type: 'rating' | 'text'
  text: string
  required: boolean
}

interface RequestBody {
  business_id: string
  name: string
  questions: Question[]
  alert_threshold?: number
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
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, name, questions, alert_threshold = 3.0 } = body

  if (!business_id || !name?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (!Array.isArray(questions) || questions.length < 1) {
    return NextResponse.json({ error: 'Minimo 1 pregunta requerida' }, { status: 400 })
  }

  if (questions.length > 5) {
    return NextResponse.json({ error: 'Maximo 5 preguntas permitidas' }, { status: 400 })
  }

  const hasRating = questions.some(q => q.type === 'rating')
  if (!hasRating) {
    return NextResponse.json({ error: 'Al menos 1 pregunta de tipo valoracion es requerida' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  const { data: survey, error: insertError } = await supabase
    .from('surveys')
    .insert({
      business_id,
      name: name.trim(),
      questions,
      alert_threshold,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[surveys/create] Insert error:', insertError)
    return NextResponse.json({ error: 'Error al crear la encuesta' }, { status: 500 })
  }

  return NextResponse.json({ success: true, survey })
}
