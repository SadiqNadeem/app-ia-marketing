import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createAdminClient } from '@/lib/supabase/admin'

// Resend sends webhooks via svix — verify signature before processing

interface ResendWebhookPayload {
  type: string
  data: {
    email_id?: string
    to?: string[]
    tags?: { name: string; value: string }[]
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.RESEND_WEBHOOK_SECRET

  if (!secret) {
    console.error('[email/webhook] RESEND_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // Read raw body for signature verification
  const rawBody = await request.text()

  const svixId = request.headers.get('svix-id') ?? ''
  const svixTimestamp = request.headers.get('svix-timestamp') ?? ''
  const svixSignature = request.headers.get('svix-signature') ?? ''

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  let payload: ResendWebhookPayload
  try {
    const wh = new Webhook(secret)
    payload = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ResendWebhookPayload
  } catch (err) {
    console.error('[email/webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Extract campaign_id from tags if present (we tag emails with campaign_id when sending)
  const tags = payload.data?.tags ?? []
  const campaignTag = tags.find(t => t.name === 'campaign_id')
  const campaignId = campaignTag?.value

  const emailTo = payload.data?.to?.[0]?.toLowerCase()

  switch (payload.type) {
    case 'email.opened': {
      if (campaignId) {
        await admin.rpc('increment_email_metric', {
          p_campaign_id: campaignId,
          p_field: 'open_count',
        })
      }
      break
    }

    case 'email.clicked': {
      if (campaignId) {
        await admin.rpc('increment_email_metric', {
          p_campaign_id: campaignId,
          p_field: 'click_count',
        })
      }
      break
    }

    case 'email.bounced': {
      if (campaignId) {
        await admin.rpc('increment_email_metric', {
          p_campaign_id: campaignId,
          p_field: 'bounce_count',
        })
      }
      break
    }

    case 'email.unsubscribed': {
      if (campaignId) {
        await admin.rpc('increment_email_metric', {
          p_campaign_id: campaignId,
          p_field: 'unsubscribe_count',
        })
      }

      // Insert into email_unsubscribes if we can find the business
      if (emailTo && campaignId) {
        const { data: campaign } = await admin
          .from('email_campaigns')
          .select('business_id')
          .eq('id', campaignId)
          .single()

        if (campaign) {
          // Ignore unique constraint error (already unsubscribed)
          await admin
            .from('email_unsubscribes')
            .upsert(
              { business_id: campaign.business_id, email: emailTo },
              { onConflict: 'business_id,email', ignoreDuplicates: true }
            )
        }
      }
      break
    }

    default:
      // Unknown event type — ignore
      break
  }

  return NextResponse.json({ received: true })
}
