import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { coupon_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { coupon_id } = body

  if (!coupon_id) {
    return NextResponse.json({ error: 'Falta coupon_id' }, { status: 400 })
  }

  // Verify ownership
  const { data: coupon, error: fetchError } = await supabase
    .from('coupons')
    .select('id, used_count, businesses!inner(owner_id)')
    .eq('id', coupon_id)
    .single()

  if (fetchError || !coupon) {
    return NextResponse.json({ error: 'Cupon no encontrado' }, { status: 404 })
  }

  const biz = coupon.businesses as unknown as { owner_id: string }
  if (biz.owner_id !== user.id) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // If it has redemptions, just deactivate — don't delete to preserve history
  if (coupon.used_count > 0) {
    const { error: updateError } = await supabase
      .from('coupons')
      .update({ is_active: false })
      .eq('id', coupon_id)

    if (updateError) {
      return NextResponse.json({ error: 'Error al desactivar el cupon' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deactivated: true })
  }

  // No redemptions — safe to delete
  const { error: deleteError } = await supabase
    .from('coupons')
    .delete()
    .eq('id', coupon_id)

  if (deleteError) {
    return NextResponse.json({ error: 'Error al eliminar el cupon' }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted: true })
}
