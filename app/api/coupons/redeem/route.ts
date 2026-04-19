import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyCouponRedeemed } from '@/lib/notifications'

interface RequestBody {
  code: string
  business_id: string
  customer_id?: string
  notes?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { code, business_id, customer_id, notes } = body

  if (!code || !business_id) {
    return NextResponse.json({ success: false, error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify business ownership
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ success: false, error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // Find coupon by code
  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .single()

  if (couponError || !coupon) {
    return NextResponse.json({ success: false, error: 'Cupon no encontrado' }, { status: 404 })
  }

  // Verify belongs to this business
  if (coupon.business_id !== business_id) {
    return NextResponse.json({ success: false, error: 'Este cupon no pertenece a tu negocio' }, { status: 403 })
  }

  // Check active
  if (!coupon.is_active) {
    return NextResponse.json({ success: false, error: 'Este cupon ya no esta activo' })
  }

  // Check expiry
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ success: false, error: 'Este cupon ha expirado' })
  }

  // Check max uses
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return NextResponse.json({ success: false, error: 'Este cupon ha alcanzado el limite de usos' })
  }

  // Insert redemption
  const { error: redemptionError } = await supabase
    .from('coupon_redemptions')
    .insert({
      coupon_id: coupon.id,
      business_id,
      customer_id: customer_id || null,
      notes: notes || null,
    })

  if (redemptionError) {
    console.error('[coupons/redeem] Redemption insert error:', redemptionError)
    return NextResponse.json({ success: false, error: 'Error al registrar el canje' }, { status: 500 })
  }

  // Increment used_count and optionally deactivate
  const newUsedCount = coupon.used_count + 1
  const shouldDeactivate = coupon.max_uses !== null && newUsedCount >= coupon.max_uses

  const { error: updateError } = await supabase
    .from('coupons')
    .update({
      used_count: newUsedCount,
      ...(shouldDeactivate ? { is_active: false } : {}),
    })
    .eq('id', coupon.id)

  if (updateError) {
    console.error('[coupons/redeem] Update count error:', updateError)
  }

  // Notify (non-blocking)
  notifyCouponRedeemed(business_id, coupon.title).catch(() => {})

  return NextResponse.json({
    success: true,
    message: 'Cupon canjeado correctamente',
    coupon: {
      title: coupon.title,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      code: coupon.code,
    },
  })
}
