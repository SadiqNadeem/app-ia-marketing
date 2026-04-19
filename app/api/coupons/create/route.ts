import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateCouponCode } from '@/lib/coupon-code'

interface RequestBody {
  business_id: string
  title: string
  description?: string
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  max_uses?: number
  expires_at?: string
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
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { business_id, title, description, discount_type, discount_value, max_uses, expires_at } = body

  // Validate
  if (!business_id || !title?.trim() || !discount_type || discount_value === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (discount_value <= 0) {
    return NextResponse.json({ error: 'El valor del descuento debe ser mayor que 0' }, { status: 400 })
  }
  if (discount_type === 'percentage' && discount_value > 100) {
    return NextResponse.json({ error: 'El porcentaje no puede superar 100' }, { status: 400 })
  }

  // Verify business ownership
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // Generate unique code (retry up to 3 times in case of collision)
  let code = generateCouponCode()
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .eq('code', code)
      .maybeSingle()
    if (!existing) break
    code = generateCouponCode()
  }

  const insertData: Record<string, unknown> = {
    business_id,
    title: title.trim(),
    description: description?.trim() || null,
    discount_type,
    discount_value,
    code,
    max_uses: max_uses ?? null,
    expires_at: expires_at || null,
  }

  const { data: coupon, error: insertError } = await supabase
    .from('coupons')
    .insert(insertData)
    .select()
    .single()

  if (insertError) {
    console.error('[coupons/create] Insert error:', insertError)
    return NextResponse.json({ error: 'Error al crear el cupon' }, { status: 500 })
  }

  return NextResponse.json({ success: true, coupon })
}
