import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { post_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { post_id } = body

  if (!post_id) {
    return NextResponse.json({ error: 'Falta post_id' }, { status: 400 })
  }

  // Verify post is a suggestion and belongs to user's business
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, business_id, businesses!inner(owner_id)')
    .eq('id', post_id)
    .eq('is_suggestion', true)
    .single()

  if (fetchError || !post) {
    return NextResponse.json(
      { error: 'Sugerencia no encontrada o sin permiso' },
      { status: 403 }
    )
  }

  const business = post.businesses as unknown as { owner_id: string }
  if (business.owner_id !== user.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { error: deleteError } = await supabase
    .from('posts')
    .delete()
    .eq('id', post_id)

  if (deleteError) {
    console.error('[calendar/discard] Delete error:', deleteError)
    return NextResponse.json({ error: 'Error al descartar la sugerencia' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
