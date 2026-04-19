import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getMondayOfCurrentWeek(): string {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  return monday.toISOString().split('T')[0]
}

interface TrendSuggestion {
  id: string
  title: string
  reason: string
  platform: string
  content_text: string
  hashtags: string[]
  promotion_type: string | null
  used: boolean
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { business_id: string; trend_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, trend_id } = body

  if (!business_id || !trend_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
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

  const weekStart = getMondayOfCurrentWeek()

  // Fetch the trends record
  const { data: trendsRecord, error: fetchError } = await supabase
    .from('trends')
    .select('id, suggestions')
    .eq('business_id', business_id)
    .eq('week_start', weekStart)
    .single()

  if (fetchError || !trendsRecord) {
    return NextResponse.json({ error: 'No se encontraron tendencias para esta semana' }, { status: 404 })
  }

  const suggestions = trendsRecord.suggestions as TrendSuggestion[]
  const idx = suggestions.findIndex((s) => s.id === trend_id)

  if (idx === -1) {
    return NextResponse.json({ error: 'Sugerencia no encontrada' }, { status: 404 })
  }

  const suggestion = suggestions[idx]

  // Mark suggestion as used
  const updatedSuggestions = suggestions.map((s, i) =>
    i === idx ? { ...s, used: true } : s
  )

  const { error: updateError } = await supabase
    .from('trends')
    .update({ suggestions: updatedSuggestions })
    .eq('id', trendsRecord.id)

  if (updateError) {
    console.error('[trends/use] Update error:', updateError)
    return NextResponse.json({ error: 'Error al actualizar la sugerencia' }, { status: 500 })
  }

  // Create post from suggestion
  const { data: newPost, error: postError } = await supabase
    .from('posts')
    .insert({
      business_id,
      content_text: suggestion.content_text,
      platforms: [suggestion.platform],
      status: 'draft',
      promotion_type: suggestion.promotion_type ?? null,
      is_suggestion: false,
      title: suggestion.title,
      hashtags: suggestion.hashtags,
      image_url: null,
      video_url: null,
      scheduled_at: null,
      published_at: null,
      suggestion_date: null,
    })
    .select('id')
    .single()

  if (postError || !newPost) {
    console.error('[trends/use] Post insert error:', postError)
    return NextResponse.json({ error: 'Error al crear el borrador' }, { status: 500 })
  }

  return NextResponse.json({ success: true, post_id: newPost.id })
}
