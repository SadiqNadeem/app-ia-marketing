import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const business_id = request.nextUrl.searchParams.get('business_id')

  if (!business_id) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, slug, logo_url, primary_color, category, phone, address, landing_enabled, landing_description, landing_gallery, landing_show_menu, landing_show_reviews, landing_cta_text, landing_cta_phone, landing_cta_whatsapp, landing_cta_maps')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (error || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ business })
}
