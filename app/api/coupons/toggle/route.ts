import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { coupon_id: string; is_active: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { coupon_id, is_active } = body

  if (!coupon_id || is_active === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify ownership via RLS join
  const { data: coupon, error: fetchError } = await supabase
    .from('coupons')
    .select('id, businesses!inner(owner_id)')
    .eq('id', coupon_id)
    .single()

  if (fetchError || !coupon) {
    return NextResponse.json({ error: 'Cupon no encontrado' }, { status: 404 })
  }

  const biz = coupon.businesses as unknown as { owner_id: string }
  if (biz.owner_id !== user.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('coupons')
    .update({ is_active })
    .eq('id', coupon_id)

  if (updateError) {
    return NextResponse.json({ error: 'Error al actualizar el cupon' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
