import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe, PLANS, planFromPriceId } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// Disable caching — webhooks must always be processed fresh
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Read raw body (required for signature verification) ────────
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  // ── Verify webhook signature ───────────────────────────────────
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('[webhook] signature error:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const supabase = createAdminClient()

  // ── Handle events ──────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { business_id, plan } = session.metadata ?? {}

        if (!business_id || !plan) break

        await supabase
          .from('businesses')
          .update({
            plan,
            subscription_id: session.subscription as string,
          })
          .eq('id', business_id)

        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price?.id

        if (!priceId) break

        const newPlan = planFromPriceId(priceId)
        if (!newPlan) break

        await supabase
          .from('businesses')
          .update({ plan: newPlan })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        await supabase
          .from('businesses')
          .update({ plan: 'basic', subscription_id: null })
          .eq('stripe_customer_id', customerId)

        break
      }

      default:
        // Ignore unhandled events
        break
    }
  } catch (err) {
    console.error(`[webhook] error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
