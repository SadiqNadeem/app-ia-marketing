import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const business_id = request.nextUrl.searchParams.get('business_id')

  if (!business_id) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: menu, error } = await supabase
    .from('menus')
    .select('*')
    .eq('business_id', business_id)
    .maybeSingle()

  if (error) {
    console.error('[menu/get]', error)
    return NextResponse.json({ error: 'Error al obtener el menu' }, { status: 500 })
  }

  return NextResponse.json({ menu: menu ?? null })
}
