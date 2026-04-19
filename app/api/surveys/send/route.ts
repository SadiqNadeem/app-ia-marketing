import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { nanoid } from 'nanoid'

function getResend() { return new Resend(process.env.RESEND_API_KEY) }

interface RequestBody {
  survey_id: string
  business_id: string
  customer_ids: string[]
  channel: 'email' | 'whatsapp'
}

function buildSurveyEmailHtml(
  customerName: string,
  businessName: string,
  questionCount: number,
  surveyUrl: string
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;border:1px solid #E5E7EB;overflow:hidden">
    <div style="background:#2563EB;padding:20px 32px">
      <p style="margin:0;color:#ffffff;font-size:16px;font-weight:600">${businessName}</p>
    </div>
    <div style="padding:32px">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#111827">
        Tu opinion nos importa
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#374151;line-height:1.6">
        Hola ${customerName}, gracias por visitarnos.<br>
        Te invitamos a responder una encuesta breve de ${questionCount} preguntas.
      </p>
      <div style="text-align:center">
        <a href="${surveyUrl}"
           style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:15px;font-weight:500">
          Responder encuesta
        </a>
      </div>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #E5E7EB;background:#F7F8FA">
      <p style="margin:0;font-size:12px;color:#4B5563;text-align:center">
        Si no deseas responder, ignora este mensaje.
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken = process.env.META_ACCESS_TOKEN

  if (!phoneNumberId || !accessToken) return false

  const cleanPhone = phone.replace(/\D/g, '')

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { body: message },
      }),
    }
  )

  return res.ok
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

  const { survey_id, business_id, customer_ids, channel } = body

  if (!survey_id || !business_id || !customer_ids?.length || !channel) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify survey belongs to business
  const { data: survey } = await supabase
    .from('surveys')
    .select('id, name, questions, business_id')
    .eq('id', survey_id)
    .eq('business_id', business_id)
    .single()

  if (!survey) {
    return NextResponse.json({ error: 'Encuesta no encontrada' }, { status: 404 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // Fetch customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, email, phone')
    .eq('business_id', business_id)
    .in('id', customer_ids)

  if (!customers?.length) {
    return NextResponse.json({ error: 'No se encontraron clientes' }, { status: 400 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const questionCount = (survey.questions as unknown[]).length

  let sent = 0
  let failed = 0

  for (const customer of customers) {
    const token = nanoid(32)
    const surveyUrl = `${appUrl}/encuesta/${token}`

    // Insert response record
    const { error: insertError } = await admin
      .from('survey_responses')
      .insert({
        survey_id,
        business_id,
        customer_id: customer.id,
        token,
        completed: false,
      })

    if (insertError) {
      console.error('[surveys/send] insert error:', insertError)
      failed++
      continue
    }

    const customerName = customer.name || 'Cliente'

    if (channel === 'email') {
      if (!customer.email) { failed++; continue }
      try {
        await getResend().emails.send({
          from: 'Publify <notificaciones@marketingia.app>',
          to: customer.email,
          subject: `Tu opinion nos importa — ${business.name}`,
          html: buildSurveyEmailHtml(customerName, business.name, questionCount, surveyUrl),
        })
        sent++
      } catch (err) {
        console.error('[surveys/send] email error:', err)
        failed++
      }
    } else if (channel === 'whatsapp') {
      if (!customer.phone) { failed++; continue }
      const message = `Hola ${customerName}, gracias por visitarnos en ${business.name}. Te invitamos a darnos tu opinion en este enlace: ${surveyUrl}`
      const ok = await sendWhatsAppMessage(customer.phone, message)
      if (ok) { sent++ } else { failed++ }
    }
  }

  return NextResponse.json({ success: true, sent, failed })
}

