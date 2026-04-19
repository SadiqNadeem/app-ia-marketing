import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runInstagramImport } from '@/lib/instagram-import'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { business_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id } = body
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

  const result = await runInstagramImport(business_id)

  if (!result.success) {
    if (result.error === 'no_instagram_connected') {
      return NextResponse.json({ error: 'no_instagram_connected' }, { status: 400 })
    }
    return NextResponse.json({ error: result.error ?? 'Error al importar' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    posts_analyzed: result.posts_analyzed,
    analysis_preview: result.analysis_preview,
  })
}
