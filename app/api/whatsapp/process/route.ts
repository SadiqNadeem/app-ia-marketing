import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { campaign_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { campaign_id } = body
  if (!campaign_id) {
    return NextResponse.json({ error: 'campaign_id requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch campaign + template
  const { data: campaign } = await admin
    .from('whatsapp_campaigns')
    .select('*, whatsapp_templates(*)')
    .eq('id', campaign_id)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: 'Campana no encontrada' }, { status: 404 })
  }

  const template = campaign.whatsapp_templates as {
    meta_template_name: string
    language: string
    variables: string[]
  } | null

  if (!template) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 400 })
  }

  // Fetch pending recipients
  const { data: recipients } = await admin
    .from('whatsapp_campaign_recipients')
    .select('id, phone, name')
    .eq('campaign_id', campaign_id)
    .eq('status', 'pending')

  const list = recipients ?? []

  let sentCount = 0
  let failedCount = 0

  for (const recipient of list) {
    try {
      const variables: string[] = template.variables ?? []
      const tvars = (campaign.template_variables ?? {}) as Record<string, string>

      const bodyParameters = variables.map((_v, i) => ({
        type: 'text',
        text: tvars[String(i + 1)] || '',
      }))

      const payload = {
        messaging_product: 'whatsapp',
        to: recipient.phone,
        type: 'template',
        template: {
          name: template.meta_template_name,
          language: { code: template.language ?? 'es' },
          components: bodyParameters.length > 0
            ? [{ type: 'body', parameters: bodyParameters }]
            : [],
        },
      }

      const res = await fetch(
        `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(payload),
        }
      )

      const responseData = await res.json() as { messages?: { id: string }[]; error?: { message: string } }

      if (res.ok && responseData.messages?.[0]?.id) {
        await admin
          .from('whatsapp_campaign_recipients')
          .update({ status: 'sent', whatsapp_message_id: responseData.messages[0].id, updated_at: new Date().toISOString() })
          .eq('id', recipient.id)

        await admin
          .from('whatsapp_campaigns')
          .update({ sent_count: campaign.sent_count + sentCount + 1 })
          .eq('id', campaign_id)

        sentCount++
      } else {
        const errMsg = responseData.error?.message ?? 'Error desconocido de Meta'
        await admin
          .from('whatsapp_campaign_recipients')
          .update({ status: 'failed', error_message: errMsg, updated_at: new Date().toISOString() })
          .eq('id', recipient.id)

        failedCount++
      }
    } catch (err) {
      console.error('[whatsapp/process] send error for recipient', recipient.id, err)

      await admin
        .from('whatsapp_campaign_recipients')
        .update({ status: 'failed', error_message: 'Error de red', updated_at: new Date().toISOString() })
        .eq('id', recipient.id)

      failedCount++
    }

    // Rate limit: 100ms between messages
    await delay(100)
  }

  // Final campaign update
  const { data: finalCampaign } = await admin
    .from('whatsapp_campaigns')
    .update({
      status: failedCount === list.length && list.length > 0 ? 'failed' : 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
      failed_count: failedCount,
    })
    .eq('id', campaign_id)
    .select('business_id, name')
    .single()

  // Notify business owner
  if (finalCampaign?.business_id) {
    await createNotification({
      business_id: finalCampaign.business_id,
      type: 'post_published',
      title: 'Campana de WhatsApp enviada',
      message: `La campana "${finalCampaign.name}" ha finalizado: ${sentCount} enviados, ${failedCount} fallidos.`,
      link: '/dashboard/campaigns',
    })
  }

  return NextResponse.json({ success: true, sent: sentCount, failed: failedCount })
}
