import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const business_id = searchParams.get('business_id')

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

  const { data: entry } = await supabase
    .from('business_knowledge')
    .select('extracted_text, created_at')
    .eq('business_id', business_id)
    .eq('type', 'instagram_analysis')
    .single()

  if (!entry) {
    return NextResponse.json({ analysis: null })
  }

  return NextResponse.json({
    analysis: entry.extracted_text,
    updated_at: entry.created_at,
  })
}
