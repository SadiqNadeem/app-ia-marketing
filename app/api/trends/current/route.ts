import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getMondayOfCurrentWeek(): string {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1)
  return monday.toISOString().split('T')[0]
}

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

  const { data: trends, error } = await supabase
    .from('trends')
    .select('*')
    .eq('business_id', business_id)
    .eq('week_start', weekStart)
    .maybeSingle()

  if (error) {
    console.error('[trends/current] Error:', error)
    return NextResponse.json({ error: 'Error al obtener tendencias' }, { status: 500 })
  }

  return NextResponse.json({ trends: trends ?? null })
}
