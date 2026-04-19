import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripe, PLANS } from '@/lib/stripe'
import type { PlanKey } from '@/lib/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────
  let plan: PlanKey
  try {
    const body = await request.json()
    plan = body.plan
    if (!plan || !(plan in PLANS)) {
      return NextResponse.json({ error: 'Plan invalido' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  // ── Get business ───────────────────────────────────────────────
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, stripe_customer_id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // ── Get or create Stripe customer ──────────────────────────────
  let customerId = business.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: business.name,
      email: user.email,
      metadata: { business_id: business.id },
    })
    customerId = customer.id

    const admin = createAdminClient()
    await admin
      .from('businesses')
      .update({ stripe_customer_id: customerId })
      .eq('id', business.id)
  }

  // ── Create Checkout Session ────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: PLANS[plan].priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard?success=upgraded`,
    cancel_url: `${APP_URL}/pricing`,
    metadata: { business_id: business.id, plan },
  })

  return NextResponse.json({ url: session.url })
}
