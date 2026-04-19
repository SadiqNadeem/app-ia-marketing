import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

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

  // Verify ownership and get slug
  const { data: menu, error } = await supabase
    .from('menus')
    .select('slug')
    .eq('business_id', business_id)
    .maybeSingle()

  if (error || !menu) {
    return NextResponse.json({ error: 'Menu no encontrado' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const menuUrl = `${appUrl}/menu/${menu.slug}`

  const qrDataUrl = await QRCode.toDataURL(menuUrl, { width: 300, margin: 2 })

  return NextResponse.json({ qr_data_url: qrDataUrl, menu_url: menuUrl })
}
