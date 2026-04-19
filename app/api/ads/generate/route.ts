import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCanGenerateAds } from '@/lib/plans'
import { openai } from '@/lib/openai'

type Platform = 'meta' | 'google'
type Objective = 'awareness' | 'traffic' | 'leads' | 'sales' | 'engagement'

interface RequestBody {
  business_id: string
  platform: Platform
  objective: Objective
  target_audience: string
  budget_daily: number
  promotion_type?: string
  custom_instructions?: string
}

const OBJECTIVE_LABELS: Record<Objective, string> = {
  awareness:   'Reconocimiento de marca',
  traffic:     'Trafico al local o web',
  leads:       'Captacion de leads',
  sales:       'Ventas',
  engagement:  'Interaccion y engagement',
}

function buildMetaSystemPrompt(
  name: string,
  businessTypeName: string,
  knowledgeContext: string,
  objective: Objective,
  targetAudience: string,
  budgetDaily: number,
  promotionType?: string,
  customInstructions?: string
): string {
  return `Eres un experto en publicidad de pago en Meta Ads (Facebook e Instagram).
Genera dos variantes A/B de un anuncio de Meta para ${name} (${businessTypeName}).

Limites de Meta Ads:
- Titular (headline): maximo 30 caracteres
- Descripcion: maximo 30 caracteres
- Texto principal (body): maximo 125 caracteres para la primera linea visible
- CTA: uno de estos exactos: Comprar ahora / Mas informacion / Contactar / Reservar / Registrarse

Contexto del negocio: ${knowledgeContext || 'Sin informacion adicional.'}
Objetivo del anuncio: ${OBJECTIVE_LABELS[objective]}
Publico objetivo: ${targetAudience}
Presupuesto diario: ${budgetDaily} EUR/dia
${promotionType ? `Tipo de promocion: ${promotionType}` : ''}
${customInstructions ? `Instrucciones adicionales: ${customInstructions}` : ''}

Responde en JSON con dos variantes A/B:
{
  "variants": [
    {
      "variant": "A",
      "headline": "titular maximo 30 chars",
      "description": "descripcion maximo 30 chars",
      "body_text": "texto principal maximo 125 chars",
      "cta": "Mas informacion",
      "rationale": "por que esta variante podria funcionar mejor"
    },
    {
      "variant": "B",
      "headline": "titular alternativo maximo 30 chars",
      "description": "descripcion alternativa maximo 30 chars",
      "body_text": "texto alternativo maximo 125 chars",
      "cta": "Contactar",
      "rationale": "enfoque diferente de esta variante"
    }
  ],
  "audience_suggestion": "descripcion detallada de la segmentacion recomendada en Meta",
  "budget_recommendation": "consejo sobre presupuesto y duracion de la campana",
  "expected_results": "que resultados esperar con este presupuesto en este sector"
}`
}

function buildGoogleSystemPrompt(
  name: string,
  businessTypeName: string,
  knowledgeContext: string,
  objective: Objective,
  targetAudience: string,
  budgetDaily: number,
  promotionType?: string,
  customInstructions?: string
): string {
  return `Eres un experto en publicidad de pago en Google Ads.
Genera dos variantes A/B de un anuncio de busqueda de Google para ${name} (${businessTypeName}).

Limites de Google Ads:
- Titular: maximo 30 caracteres (se muestran 3 titulares a la vez)
- Descripcion: maximo 90 caracteres (se muestran 2 descripciones)
- Keywords: 10 palabras clave relevantes

Contexto del negocio: ${knowledgeContext || 'Sin informacion adicional.'}
Objetivo del anuncio: ${OBJECTIVE_LABELS[objective]}
Publico objetivo: ${targetAudience}
Presupuesto diario: ${budgetDaily} EUR/dia
${promotionType ? `Tipo de promocion: ${promotionType}` : ''}
${customInstructions ? `Instrucciones adicionales: ${customInstructions}` : ''}

Responde en JSON con dos variantes A/B:
{
  "variants": [
    {
      "variant": "A",
      "headline_1": "titular 1 maximo 30 chars",
      "headline_2": "titular 2 maximo 30 chars",
      "headline_3": "titular 3 maximo 30 chars",
      "description_1": "descripcion 1 maximo 90 chars",
      "description_2": "descripcion 2 maximo 90 chars",
      "keywords": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
      "rationale": "por que esta variante podria funcionar mejor"
    },
    {
      "variant": "B",
      "headline_1": "titular alternativo 1",
      "headline_2": "titular alternativo 2",
      "headline_3": "titular alternativo 3",
      "description_1": "descripcion alternativa 1",
      "description_2": "descripcion alternativa 2",
      "keywords": ["kw alternativa 1", "kw alternativa 2"],
      "rationale": "enfoque diferente de esta variante"
    }
  ],
  "match_type_recommendation": "que tipo de concordancia usar (amplia, frase, exacta)",
  "negative_keywords": ["kw negativa 1", "kw negativa 2", "kw negativa 3"],
  "budget_recommendation": "consejo sobre presupuesto y duracion de la campana",
  "expected_results": "que resultados esperar con este presupuesto en este sector"
}`
}

function buildAdImagePrompt(
  name: string,
  category: string,
  platform: Platform,
  objective: Objective,
  primaryColor: string
): string {
  const objectiveContext: Record<Objective, string> = {
    awareness:  'brand awareness, professional business presentation',
    traffic:    'inviting location, welcoming atmosphere, foot traffic',
    leads:      'professional consultation, trust building, clean office',
    sales:      'product showcase, compelling offer, purchase intent',
    engagement: 'community, social interaction, lifestyle',
  }

  const platformContext = platform === 'meta'
    ? 'square format social media ad, Facebook Instagram style'
    : 'display advertising, professional and clean'

  return (
    `Professional paid advertising visual for ${name}, a ${category} business. ` +
    `${platformContext}. Context: ${objectiveContext[objective]}. ` +
    `High quality commercial photography, clean composition, ` +
    `vibrant colors inspired by ${primaryColor}. ` +
    `No text, no logos, no watermarks, no people.`
  )
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

  const { business_id, platform, objective, target_audience, budget_daily, promotion_type, custom_instructions } = body

  if (!business_id || !platform || !objective || !target_audience || !budget_daily) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Plan check
  const planCheck = await checkCanGenerateAds(business_id)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.reason }, { status: 403 })
  }

  // Verify ownership and get business data
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, category, primary_color, business_type_id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Get business type name
  const admin = createAdminClient()
  const { data: businessType } = business.business_type_id
    ? await admin.from('business_types').select('name').eq('id', business.business_type_id).single()
    : { data: null }

  // Get knowledge context
  const { data: knowledge } = await supabase
    .from('business_knowledge')
    .select('title, extracted_text')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })
    .limit(3)

  const knowledgeContext = knowledge?.length
    ? knowledge.map(k => `[${k.title}]\n${k.extracted_text}`).join('\n\n').slice(0, 1200)
    : ''

  // Build system prompt
  const systemPrompt = platform === 'meta'
    ? buildMetaSystemPrompt(business.name, businessType?.name ?? business.category, knowledgeContext, objective, target_audience, budget_daily, promotion_type, custom_instructions)
    : buildGoogleSystemPrompt(business.name, businessType?.name ?? business.category, knowledgeContext, objective, target_audience, budget_daily, promotion_type, custom_instructions)

  // Call GPT-4o
  let parsed: Record<string, unknown>
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      max_tokens: 1200,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Genera el anuncio ahora.' },
      ],
    })
    parsed = JSON.parse(completion.choices[0].message.content ?? '{}')
  } catch (err) {
    console.error('[ads/generate] GPT-4o error:', err)
    return NextResponse.json({ error: 'Error al generar el copy del anuncio' }, { status: 500 })
  }

  // Generate image with DALL-E 3
  let imageUrl = ''
  try {
    const dallePrompt = buildAdImagePrompt(
      business.name,
      business.category,
      platform,
      objective,
      business.primary_color ?? '#2563EB'
    )

    const imageRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    })

    const tempUrl = imageRes.data[0]?.url
    if (tempUrl) {
      const imgBuffer = await fetch(tempUrl).then(r => r.arrayBuffer())
      const storagePath = `${business_id}/ads/${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: false })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('generated-images')
          .getPublicUrl(storagePath)
        imageUrl = urlData.publicUrl
      }
    }
  } catch (err) {
    console.error('[ads/generate] DALL-E error (non-fatal):', err)
    // Image failure is non-fatal; proceed without image
  }

  // Insert ad_creative
  const { data: adCreative, error: insertError } = await admin
    .from('ad_creatives')
    .insert({
      business_id,
      platform,
      objective,
      target_audience,
      budget_daily,
      variants: parsed.variants ?? [],
      image_url: imageUrl || null,
      status: 'ready',
    })
    .select()
    .single()

  if (insertError || !adCreative) {
    console.error('[ads/generate] insert error:', insertError)
    return NextResponse.json({ error: 'Error al guardar el anuncio' }, { status: 500 })
  }

  // Merge extra fields from parsed into response
  return NextResponse.json({
    ...adCreative,
    audience_suggestion:       parsed.audience_suggestion,
    budget_recommendation:     parsed.budget_recommendation,
    expected_results:          parsed.expected_results,
    match_type_recommendation: parsed.match_type_recommendation,
    negative_keywords:         parsed.negative_keywords,
  })
}
