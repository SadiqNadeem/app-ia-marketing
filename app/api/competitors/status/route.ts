import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const report_id = searchParams.get('report_id')
  const business_id = searchParams.get('business_id')

  if (!report_id || !business_id) {
    return NextResponse.json({ error: 'Faltan parametros' }, { status: 400 })
  }

  const { data: report, error } = await supabase
    .from('competitor_reports')
    .select('*')
    .eq('id', report_id)
    .eq('business_id', business_id)
    .single()

  if (error || !report) {
    return NextResponse.json({ error: 'Reporte no encontrado' }, { status: 404 })
  }

  return NextResponse.json(report)
}
