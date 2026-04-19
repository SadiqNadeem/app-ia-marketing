import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import crypto from 'crypto'
import { createNotification } from '@/lib/notifications'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

// Placeholder used in stored html_content and plain_text
const UNSUBSCRIBE_PLACEHOLDER = '__UNSUBSCRIBE_URL__'

interface RequestBody {
  business_id: string
  campaign_id: string
  customer_ids: string[]
  scheduled_at?: string
}

function generateUnsubscribeToken(businessId: string, email: string): string {
  const salt = process.env.RESEND_WEBHOOK_SECRET ?? 'unsubscribe-salt'
  return crypto.createHmac('sha256', salt).update(`${businessId}:${email}`).digest('hex')
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
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, campaign_id, customer_ids, scheduled_at } = body

  if (!business_id || !campaign_id || !customer_ids?.length) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify business ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Fetch campaign and verify it belongs to this business and is draft
  const { data: campaign } = await supabase
    .from('email_campaigns')
    .select('id, name, subject, html_content, plain_text, status')
    .eq('id', campaign_id)
    .eq('business_id', business_id)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'Campana no encontrada' }, { status: 404 })
  }

  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'La campana ya fue enviada o esta en proceso' }, { status: 400 })
  }

  // If scheduling: just save scheduled_at and return
  if (scheduled_at) {
    await supabase
      .from('email_campaigns')
      .update({ scheduled_at })
      .eq('id', campaign_id)

    return NextResponse.json({ success: true, scheduled: true })
  }

  // Fetch selected customers with emails
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email')
    .eq('business_id', business_id)
    .in('id', customer_ids)
    .not('email', 'is', null)

  if (!customers?.length) {
    return NextResponse.json({ error: 'Ningun cliente tiene email' }, { status: 400 })
  }

  // Fetch unsubscribed emails for this business
  const { data: unsubscribed } = await supabase
    .from('email_unsubscribes')
    .select('email')
    .eq('business_id', business_id)

  const unsubscribedEmails = new Set((unsubscribed ?? []).map(u => u.email.toLowerCase()))

  // Filter valid recipients
  const validCustomers = customers.filter(
    c => c.email && !unsubscribedEmails.has(c.email.toLowerCase())
  )

  if (!validCustomers.length) {
    return NextResponse.json({ error: 'Todos los clientes se han dado de baja' }, { status: 400 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Update campaign to sending
  await admin
    .from('email_campaigns')
    .update({ status: 'sending', recipients_count: validCustomers.length })
    .eq('id', campaign_id)

  let sent = 0
  let failed = 0

  for (const customer of validCustomers) {
    if (!customer.email) { failed++; continue }

    const token = generateUnsubscribeToken(business_id, customer.email)
    const unsubscribeUrl = `${appUrl}/unsubscribe?business=${business_id}&email=${encodeURIComponent(customer.email)}&token=${token}`

    // Replace placeholder with actual per-recipient URL
    const html = (campaign.html_content ?? '').replace(
      new RegExp(UNSUBSCRIBE_PLACEHOLDER, 'g'),
      unsubscribeUrl
    )
    const text = (campaign.plain_text ?? '').replace(
      new RegExp(UNSUBSCRIBE_PLACEHOLDER, 'g'),
      unsubscribeUrl
    )

    try {
      await getResend().emails.send({
        from: `${business.name} <notificaciones@marketingia.app>`,
        to: customer.email,
        subject: campaign.subject,
        html,
        text,
      })
      sent++
    } catch (err) {
      console.error('[email/send] error sending to', customer.email, err)
      failed++
    }
  }

  // Update campaign status
  await admin
    .from('email_campaigns')
    .update({
      status: sent > 0 ? 'sent' : 'failed',
      sent_count: sent,
      sent_at: new Date().toISOString(),
    })
    .eq('id', campaign_id)

  // Notification
  if (sent > 0) {
    await createNotification({
      business_id,
      type: 'post_published',
      title: 'Email enviado',
      message: `Email enviado a ${sent} cliente${sent !== 1 ? 's' : ''}`,
      link: '/dashboard/emails',
    })
  }

  return NextResponse.json({ success: true, sent, failed })
}
