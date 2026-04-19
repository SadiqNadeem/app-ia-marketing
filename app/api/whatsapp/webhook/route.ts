import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

// ── GET — Meta webhook verification ───────────────────────────────────────────
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// ── POST — Receive delivery status updates ─────────────────────────────────────
interface MetaStatusUpdate {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  errors?: { message: string }[]
}

interface MetaWebhookBody {
  entry?: {
    changes?: {
      field: string
      value?: {
        statuses?: MetaStatusUpdate[]
      }
    }[]
  }[]
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: MetaWebhookBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const admin = createAdminClient()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue

      for (const status of change.value?.statuses ?? []) {
        const { id: messageId, status: msgStatus } = status

        if (!messageId || !['delivered', 'read', 'failed'].includes(msgStatus)) continue

        // Find the recipient by whatsapp_message_id
        const { data: recipient } = await admin
          .from('whatsapp_campaign_recipients')
          .select('id, campaign_id')
          .eq('whatsapp_message_id', messageId)
          .maybeSingle()

        if (!recipient) continue

        // Update recipient status
        await admin
          .from('whatsapp_campaign_recipients')
          .update({ status: msgStatus, updated_at: new Date().toISOString() })
          .eq('id', recipient.id)

        // Increment the corresponding counter on the campaign
        const counterField =
          msgStatus === 'delivered' ? 'delivered_count'
          : msgStatus === 'read' ? 'read_count'
          : 'failed_count'

        const { data: campaign } = await admin
          .from('whatsapp_campaigns')
          .select(counterField)
          .eq('id', recipient.campaign_id)
          .single()

        if (campaign) {
          const currentCount = (campaign as Record<string, number>)[counterField] ?? 0
          await admin
            .from('whatsapp_campaigns')
            .update({ [counterField]: currentCount + 1 })
            .eq('id', recipient.campaign_id)
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}
