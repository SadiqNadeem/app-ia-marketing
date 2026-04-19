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
    return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
  }

  const { data: reports, error } = await supabase
    .from('competitor_reports')
    .select('id, competitor_handle, competitor_name, competitor_followers, competitor_posts_analyzed, status, raw_data, report_text, key_findings, opportunities, error_message, created_at')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[competitors/list] error:', error)
    return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 })
  }

  return NextResponse.json(reports ?? [])
}
