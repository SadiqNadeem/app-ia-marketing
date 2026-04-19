import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  post_id: string
  scheduled_at?: string
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
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { post_id, scheduled_at } = body

  if (!post_id) {
    return NextResponse.json({ error: 'Falta post_id' }, { status: 400 })
  }

  // Verify post belongs to user's business
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, business_id, businesses!inner(owner_id)')
    .eq('id', post_id)
    .eq('is_suggestion', true)
    .single()

  if (fetchError || !post) {
    return NextResponse.json(
      { error: 'Post no encontrado o sin permiso' },
      { status: 403 }
    )
  }

  const business = post.businesses as unknown as { owner_id: string }
  if (business.owner_id !== user.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const updateData: Record<string, unknown> = {
    is_suggestion: false,
    status: scheduled_at ? 'scheduled' : 'draft',
  }

  if (scheduled_at) {
    updateData.scheduled_at = scheduled_at
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update(updateData)
    .eq('id', post_id)

  if (updateError) {
    console.error('[calendar/approve] Update error:', updateError)
    return NextResponse.json({ error: 'Error al aprobar el post' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
