import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCanAnalyzeCompetitors } from '@/lib/plans'
import { analyzeCompetitor } from '@/lib/competitor-analyzer'

interface RequestBody {
  business_id: string
  competitor_handle: string
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

  const { business_id, competitor_handle } = body

  if (!business_id || !competitor_handle?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Clean handle: remove @ and spaces
  const cleanHandle = competitor_handle.trim().replace(/^@/, '').trim()

  if (!cleanHandle) {
    return NextResponse.json({ error: 'El usuario de Instagram no es valido' }, { status: 400 })
  }

  // Plan check
  const planCheck = await checkCanAnalyzeCompetitors(business_id)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.reason }, { status: 403 })
  }

  // Verify ownership and get business handle
  const { data: business } = await supabase
    .from('businesses')
    .select('id, instagram_handle')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Cannot analyze own handle
  const ownHandle = (business.instagram_handle ?? '').replace(/^@/, '').toLowerCase()
  if (ownHandle && ownHandle === cleanHandle.toLowerCase()) {
    return NextResponse.json({ error: 'No puedes analizar tu propio perfil' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Create report record
  const { data: report, error: insertError } = await admin
    .from('competitor_reports')
    .insert({
      business_id,
      competitor_handle: cleanHandle,
      status: 'analyzing',
    })
    .select('id')
    .single()

  if (insertError || !report) {
    console.error('[competitors/analyze] insert error:', insertError)
    return NextResponse.json({ error: 'Error al crear el reporte' }, { status: 500 })
  }

  // Launch analysis asynchronously
  analyzeCompetitor(report.id, business_id, cleanHandle).catch(err => {
    console.error('[competitors/analyze] async error:', err)
  })

  return NextResponse.json({ success: true, report_id: report.id })
}
