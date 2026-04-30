import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

type ImageStyle = 'moderno' | 'elegante' | 'divertido' | 'minimalista'

interface RequestBody {
  business_id: string
  promotion_type: string
  custom_text?: string
  style: ImageStyle
  example_id?: string
}

const PROMOTION_TO_CATEGORY: Record<string, string> = {
  menu_dia: 'menu',
  oferta_2x1: 'promocion',
  happy_hour: 'promocion',
  sorteo: 'anuncio',
  evento: 'anuncio',
  nuevo_producto: 'flyer',
  navidad: 'flyer',
  san_valentin: 'flyer',
  halloween: 'flyer',
  apertura: 'flyer',
  aniversario: 'flyer',
  black_friday: 'promocion',
}

interface GenerateImageResponse {
  image_url: string
  prompt_used: string
}

// ── Style descriptions ──────────────────────────────────────────
const STYLE_DESCRIPTIONS: Record<ImageStyle, string> = {
  moderno: 'modern, clean, minimalist, contemporary',
  elegante: 'elegant, sophisticated, luxury feel, premium',
  divertido: 'colorful, fun, energetic, playful',
  minimalista: 'ultra minimal, white space, simple composition',
}

// ── Promotion context per type ──────────────────────────────────
const PROMOTION_CONTEXT: Record<string, string> = {
  menu_dia: 'fresh food ingredients, restaurant setting, appetizing',
  oferta_2x1: 'abundance, two products side by side, promotional',
  happy_hour: 'drinks, bar atmosphere, evening lighting',
  sorteo: 'celebration, excitement, gift or prize visual',
  evento: 'venue decoration, event setup, festive atmosphere',
  nuevo_producto: 'product showcase, clean display, hero shot',
  navidad: 'christmas decoration, warm lighting, festive',
  san_valentin: 'romantic, roses, red and pink tones',
  halloween: 'halloween decoration, orange and black, spooky',
  apertura: 'grand opening, ribbon cutting, celebration',
  aniversario: 'celebration, milestone, achievement',
  black_friday: 'deals, shopping, dark dramatic lighting',
  happy_hour_default: 'inviting atmosphere, warm ambient light',
}

const PRODUCT_KEYWORDS = ['plato', 'producto', 'precio', 'menu', 'dish', 'product', 'price']

function buildKnowledgeBlock(
  knowledge: Array<{ title: string; extracted_text: string; type?: string }>
): string {
  if (!knowledge || knowledge.length === 0) return ''

  const imageEntries  = knowledge.filter(k => k.type === 'image')
  const otherEntries  = knowledge.filter(k => k.type !== 'instagram_analysis' && k.type !== 'image' && k.type !== 'video')

  const MAX_CHARS = 6000
  let total = 0
  const parts: string[] = []
  for (const k of otherEntries) {
    const entry = `[${k.title}]: ${k.extracted_text}`
    if (total + entry.length > MAX_CHARS) {
      const remaining = MAX_CHARS - total
      if (remaining > 100) parts.push(entry.slice(0, remaining))
      break
    }
    parts.push(entry)
    total += entry.length
  }

  const sections: string[] = []
  if (parts.length > 0) sections.push(parts.join('\n\n'))
  if (imageEntries.length > 0) {
    sections.push(
      'Imagenes reales del negocio:\n' +
      imageEntries.map(k => `- ${k.title}: ${k.extracted_text}`).join('\n')
    )
  }

  return sections.join('\n\n')
}

function buildDallePrompt(
  name: string,
  category: string,
  primaryColor: string,
  style: ImageStyle,
  promotionType: string,
  knowledgeText: string,
  exampleStyleDescription?: string
): string {
  const styleDesc = STYLE_DESCRIPTIONS[style]
  const promotionCtx =
    PROMOTION_CONTEXT[promotionType] ?? PROMOTION_CONTEXT['nuevo_producto']

  const contextLower = knowledgeText.toLowerCase()
  const hasProductMentions = PRODUCT_KEYWORDS.some((kw) => contextLower.includes(kw))
  const contextHint =
    hasProductMentions && knowledgeText.trim()
      ? ` Products and setting inspired by: ${knowledgeText.trim().slice(0, 200)}.`
      : ''

  const exampleHint = exampleStyleDescription
    ? ` Design reference style: ${exampleStyleDescription.slice(0, 300)}.`
    : ''

  return (
    `Professional marketing photo for a ${category} business called ${name}. ` +
    `Style: ${styleDesc}. ` +
    `Context: ${promotionCtx}.${contextHint}${exampleHint} ` +
    `High quality, commercial photography style, clean background, ` +
    `vibrant colors inspired by ${primaryColor}. ` +
    `No text, no logos, no people, no watermarks.`
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const { business_id, promotion_type, style, example_id } = body

  if (!business_id || !promotion_type || !style) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: business_id, promotion_type, style' },
      { status: 400 }
    )
  }

  // ── 3. Fetch business (ownership verified by RLS + explicit filter) ──
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('name, category, primary_color')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json(
      { error: 'Negocio no encontrado o sin permiso' },
      { status: 403 }
    )
  }

  // ── 4. Fetch knowledge + optional example style ────────────────
  const exampleCategory = PROMOTION_TO_CATEGORY[promotion_type] ?? 'flyer'

  const [{ data: knowledge }, exampleData] = await Promise.all([
    supabase
      .from('business_knowledge')
      .select('title, extracted_text, type')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false }),
    example_id
      ? supabase.from('ai_examples').select('style_description').eq('id', example_id).eq('is_active', true).single()
      : supabase
          .from('ai_examples')
          .select('style_description')
          .eq('is_active', true)
          .eq('category', exampleCategory)
          .or(`business_types.cs.{"${business.category}"},business_types.eq.{}`)
          .order('sort_order', { ascending: true })
          .limit(1)
          .single(),
  ])

  const exampleStyleDescription: string | undefined =
    (exampleData.data as { style_description?: string } | null)?.style_description ?? undefined

  const knowledgeText = buildKnowledgeBlock(knowledge ?? [])

  const prompt = buildDallePrompt(
    business.name,
    business.category,
    business.primary_color,
    style,
    promotion_type,
    knowledgeText,
    exampleStyleDescription
  )

  // ── 5. Call DALL-E 3 ───────────────────────────────────────────
  let tempImageUrl: string
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    })
    tempImageUrl = response.data?.[0]?.url ?? ''
    if (!tempImageUrl) throw new Error('DALL-E did not return an image URL')
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)

    // Content policy rejection
    if (errMsg.includes('content_policy') || errMsg.includes('safety')) {
      return NextResponse.json(
        {
          error:
            'El contenido solicitado no pudo generarse, intenta con otras instrucciones',
        },
        { status: 400 }
      )
    }

    // Rate limit
    if (
      err instanceof Error &&
      'status' in err &&
      (err as { status: number }).status === 429
    ) {
      return NextResponse.json(
        { error: 'Limite de solicitudes alcanzado. Espera unos segundos.' },
        { status: 429 }
      )
    }

    console.error('[generate/image] DALL-E error:', err)
    return NextResponse.json(
      { error: 'Error al generar la imagen. Intentalo de nuevo.' },
      { status: 500 }
    )
  }

  // ── 6. Download image from OpenAI temp URL ─────────────────────
  let imageBuffer: ArrayBuffer
  try {
    const imgRes = await fetch(tempImageUrl)
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`)
    imageBuffer = await imgRes.arrayBuffer()
  } catch (err) {
    console.error('[generate/image] download error:', err)
    return NextResponse.json(
      { error: 'Error al descargar la imagen generada.' },
      { status: 500 }
    )
  }

  // ── 7. Upload to Supabase Storage ──────────────────────────────
  const storagePath = `${business_id}/${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(storagePath, imageBuffer, {
      contentType: 'image/png',
      upsert: false,
    })

  if (uploadError) {
    console.error('[generate/image] storage upload error:', uploadError)
    return NextResponse.json(
      { error: 'Error al guardar la imagen. Intentalo de nuevo.' },
      { status: 500 }
    )
  }

  // ── 8. Get public URL and return ───────────────────────────────
  const { data: urlData } = supabase.storage
    .from('generated-images')
    .getPublicUrl(storagePath)

  const result: GenerateImageResponse = {
    image_url: urlData.publicUrl,
    prompt_used: prompt,
  }

  return NextResponse.json(result)
}
