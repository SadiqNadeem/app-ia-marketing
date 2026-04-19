import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCanSendWhatsApp } from '@/lib/plans'

interface RequestBody {
  business_id: string
  campaign_name: string
  template_id: string
  template_variables: Record<string, string>
  customer_ids: string[]
  scheduled_at?: string
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

  const { business_id, campaign_name, template_id, template_variables, customer_ids, scheduled_at } = body

  if (!business_id || !campaign_name?.trim() || !template_id || !customer_ids?.length) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // Plan check — Business+ only
  const planCheck = await checkCanSendWhatsApp(business_id)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.reason }, { status: 403 })
  }

  // Fetch template (must be approved)
  const { data: template } = await supabase
    .from('whatsapp_templates')
    .select('*')
    .eq('id', template_id)
    .eq('business_id', business_id)
    .eq('is_approved', true)
    .single()

  if (!template) {
    return NextResponse.json({ error: 'Plantilla no encontrada o no aprobada' }, { status: 400 })
  }

  // Fetch selected customers with phones
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('business_id', business_id)
    .in('id', customer_ids)

  const validCustomers = (customers ?? []).filter(c => c.phone?.trim())
  const skippedCount = customer_ids.length - validCustomers.length

  // Create campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('whatsapp_campaigns')
    .insert({
      business_id,
      name: campaign_name.trim(),
      template_id,
      template_variables: template_variables ?? {},
      recipients_count: validCustomers.length,
      status: 'draft',
      scheduled_at: scheduled_at || null,
    })
    .select()
    .single()

  if (campaignError || !campaign) {
    console.error('[whatsapp/send] campaign insert error:', campaignError)
    return NextResponse.json({ error: 'Error al crear la campana' }, { status: 500 })
  }

  // Insert recipients
  if (validCustomers.length > 0) {
    const recipients = validCustomers.map(c => ({
      campaign_id: campaign.id,
      customer_id: c.id,
      phone: c.phone!.trim(),
      name: c.name || null,
      status: 'pending',
    }))

    // Also add skipped customers with failed status
    const skippedCustomers = (customers ?? [])
      .filter(c => !c.phone?.trim())
      .map(c => ({
        campaign_id: campaign.id,
        customer_id: c.id,
        phone: '',
        name: c.name || null,
        status: 'failed',
        error_message: 'Sin telefono registrado',
      }))

    await supabase.from('whatsapp_campaign_recipients').insert([...recipients, ...skippedCustomers])
  }

  // If scheduled, return early
  if (scheduled_at) {
    return NextResponse.json({ success: true, scheduled: true, campaign_id: campaign.id, skipped: skippedCount })
  }

  // Otherwise, trigger processing
  await supabase
    .from('whatsapp_campaigns')
    .update({ status: 'sending' })
    .eq('id', campaign.id)

  // Call process endpoint internally
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  fetch(`${appUrl}/api/whatsapp/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ campaign_id: campaign.id }),
  }).catch(err => console.error('[whatsapp/send] process trigger error:', err))

  return NextResponse.json({ success: true, campaign_id: campaign.id, skipped: skippedCount })
}
