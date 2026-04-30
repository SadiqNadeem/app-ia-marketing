import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import { checkCanTranslate } from '@/lib/plans'
import type { SocialPlatform, PromotionType } from '@/types'

type ContentType = 'post' | 'story' | 'promotion' | 'hashtags'
type TargetLanguage = 'en' | 'fr' | 'de' | 'it' | 'pt' | 'ar'

// ── Few-shot examples (JSON format) ───────────────────────────────────────────
// Quality depends on examples, not on the model.

const EXAMPLES: Array<{ role: 'user' | 'assistant'; content: string }> = [
  {
    role: 'user',
    content: 'Genera un post de instagram para La Trattoria de Roma.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      caption: 'Los domingos en La Trattoria de Roma saben diferente.\n\nPasta fresca hecha a mano. Recetas de siempre.\n\nReserva tu mesa este domingo.',
      hashtags: ['#latrattoria', '#pasta', '#restauranteitaliano', '#comiditalia', '#domingos', '#pastafresca'],
      cta: 'Reserva tu mesa este domingo. Enlace en bio.',
      image_prompt: 'Close-up of handmade Italian pasta on rustic wooden table, warm candlelight, professional food photography, appetizing',
      variations: [
        {
          caption: 'Pasta fresca. Recetas de siempre.\n\nEsta semana en La Trattoria de Roma: carbonara, amatriciana y cacio e pepe. Autentico sabor italiano.',
          hashtags: ['#trattoria', '#italianfood', '#pastafresca', '#restaurante'],
          cta: 'Haz tu reserva esta semana.',
          image_prompt: 'Steaming bowl of carbonara on rustic Italian table, cozy restaurant ambiance, warm lighting',
        },
      ],
    }),
  },
  {
    role: 'user',
    content: 'Genera el texto completo de una promocion de tipo "Oferta 2x1" para FitZone. Incluye titulo, descripcion y llamada a la accion.',
  },
  {
    role: 'assistant',
    content: JSON.stringify({
      caption: 'ENTRENA CON UN AMIGO, PAGA UNO\n\nEste mes en FitZone: membresia 2x1. Sala, clases y cardio incluidos.\n\nOferta hasta el 30 de abril. Plazas limitadas.',
      hashtags: ['#fitzone', '#gym', '#oferta2x1', '#fitness', '#entrena', '#gimasio'],
      cta: 'Visita la recepcion hoy para activar la oferta.',
      image_prompt: 'Two athletic friends high-fiving in modern gym, energetic fitness atmosphere, motivational photography',
      variations: [
        {
          caption: 'Tu amigo entrena gratis este mes.\n\nTrae a alguien a FitZone y los dos acceden a todo el centro por el precio de uno.',
          hashtags: ['#fitzone', '#fitness', '#2x1', '#gym'],
          cta: 'Plazas limitadas. Activa en recepcion.',
          image_prompt: 'Two people working out together in bright modern gym, positive energy, fitness promotion',
        },
      ],
    }),
  },
]

// ── JSON output schema (appended to user prompt for non-hashtag types) ─────────

const OUTPUT_TEMPLATE = `Devuelve SOLO JSON valido con esta estructura exacta. Sin texto fuera del JSON:
{"caption":"texto del post max 300 chars con \\n para saltos","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"],"cta":"llamada a la accion corta y directa","image_prompt":"image description in English, professional ad style, no text no logos","variations":[{"caption":"...","hashtags":["..."],"cta":"...","image_prompt":"..."}]}`

// ── Structured AI response ─────────────────────────────────────────────────────

interface AiContent {
  caption: string
  hashtags: string[]
  cta: string
  image_prompt: string
  variations: Array<{ caption: string; hashtags: string[]; cta: string; image_prompt: string }>
}

function parseAiJson(raw: string): AiContent | null {
  try {
    // Strip markdown code fences if model wraps the JSON
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
    const parsed = JSON.parse(clean)
    if (typeof parsed.caption !== 'string' || !parsed.caption.trim()) return null
    return {
      caption: parsed.caption.slice(0, 300),
      hashtags: Array.isArray(parsed.hashtags)
        ? (parsed.hashtags as unknown[]).filter((h): h is string => typeof h === 'string').slice(0, 15)
        : [],
      cta: typeof parsed.cta === 'string' ? parsed.cta : '',
      image_prompt: typeof parsed.image_prompt === 'string' ? parsed.image_prompt.slice(0, 900) : '',
      variations: Array.isArray(parsed.variations)
        ? (parsed.variations as Record<string, unknown>[]).slice(0, 3).map((v) => ({
            caption:      (typeof v.caption      === 'string' ? v.caption      : '').slice(0, 300),
            hashtags:     Array.isArray(v.hashtags) ? (v.hashtags as unknown[]).filter((h): h is string => typeof h === 'string').slice(0, 15) : [],
            cta:          typeof v.cta          === 'string' ? v.cta          : '',
            image_prompt: (typeof v.image_prompt === 'string' ? v.image_prompt : '').slice(0, 900),
          }))
        : [],
    }
  } catch {
    return null
  }
}

async function generateImage(
  prompt: string,
  businessId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  if (!prompt.trim()) return null
  try {
    const res = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 1000),
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    })
    const tempUrl = res.data[0]?.url
    if (!tempUrl) return null

    const imgRes = await fetch(tempUrl)
    if (!imgRes.ok) return null
    const buffer = await imgRes.arrayBuffer()

    const storagePath = `${businessId}/${Date.now()}_gen.png`
    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: false })
    if (uploadError) return null

    return supabase.storage.from('generated-images').getPublicUrl(storagePath).data.publicUrl
  } catch {
    return null
  }
}

interface RequestBody {
  business_id: string
  type: ContentType
  platform: SocialPlatform
  promotion_type?: PromotionType
  custom_instructions?: string
  auto_translate_languages?: TargetLanguage[]
}

interface GenerateResponse {
  // Structured fields
  caption: string
  hashtags: string[]
  cta: string
  image_url: string | null
  image_prompt: string
  variations: AiContent['variations']
  // Legacy field kept for any existing consumers
  text: string
  translations?: Partial<Record<TargetLanguage, string>>
}

const LANGUAGE_NAMES: Record<TargetLanguage, string> = {
  en: 'ingles',
  fr: 'frances',
  de: 'aleman',
  it: 'italiano',
  pt: 'portugues',
  ar: 'arabe',
}

async function translateText(text: string, lang: TargetLanguage): Promise<string> {
  const langName = LANGUAGE_NAMES[lang]
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 600,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `Eres un traductor experto en marketing digital. Traduce el siguiente texto de espanol a ${langName} manteniendo exactamente el mismo tono, estilo y llamada a la accion del original. Si el texto tiene hashtags, traducelos o adaptalos al idioma destino. Responde UNICAMENTE con el texto traducido, sin explicaciones ni comentarios.`,
      },
      { role: 'user', content: text },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() ?? ''
}

const PLATFORM_TONE: Record<SocialPlatform, string> = {
  instagram: 'visual, aspiracional, con saltos de linea, maximo 2200 caracteres',
  facebook: 'cercano y directo, puede ser mas largo, incluye llamada a la accion clara',
  tiktok: 'informal, energico, frases cortas, lenguaje joven',
  whatsapp: 'muy directo, personal, como si fuera un mensaje de un amigo',
  google: 'profesional, informativo, orientado a busqueda local',
}

const PROMOTION_LABELS: Record<string, string> = {
  oferta_2x1: 'Oferta 2x1',
  menu_dia: 'Menu del dia',
  happy_hour: 'Happy Hour',
  sorteo: 'Sorteo',
  evento: 'Evento especial',
  nuevo_producto: 'Nuevo producto',
  black_friday: 'Black Friday',
  navidad: 'Navidad',
  san_valentin: 'San Valentin',
  halloween: 'Halloween',
  apertura: 'Gran apertura',
  aniversario: 'Aniversario',
}

function buildSystemPrompt(
  name: string,
  category: string,
  platform: SocialPlatform,
  knowledgeBlock: string,
  instagramAnalysis?: string,
  qualityExamples?: string[],
  globalExamples?: Array<{ title: string; category: string; style_description: string }>
): string {
  const igSection = instagramAnalysis?.trim()
    ? `\n\nAnalisis del estilo de comunicacion de este negocio en redes sociales:\n${instagramAnalysis}\n\nIMPORTANTE: Cuando generes contenido, replica este estilo de comunicacion. Manten el tono, la longitud y el tipo de llamadas a la accion que ya funcionan para este negocio.`
    : ''

  const contextSection = knowledgeBlock.trim()
    ? `\n\n${knowledgeBlock}`
    : ''

  const examplesSection = qualityExamples && qualityExamples.length > 0
    ? `\n\nEjemplos de alta calidad:\n${qualityExamples.map((e, i) => `[${i + 1}] ${e}`).join('\n\n')}\n\nEstudia el estilo, tono y estructura de estos ejemplos. Aplicalos al negocio actual.`
    : ''

  const globalExamplesSection = globalExamples && globalExamples.length > 0
    ? `\n\nEjemplos de referencia de diseno y estilo para este tipo de negocio:\n${globalExamples.map(e => `- ${e.title} (${e.category}): ${e.style_description}`).join('\n')}\n\nCuando generes contenido, ten en cuenta estos estilos de referencia para que el resultado sea visualmente coherente y profesional.`
    : ''

  return `Eres un experto en marketing digital para negocios locales. Escribes contenido concreto, directo y profesional. Nunca generas contenido generico.

Negocio: ${name}
Categoria: ${category}
Tono segun plataforma (${platform}): ${PLATFORM_TONE[platform]}

Reglas estrictas:
- Maximo 120 palabras
- Estilo directo: frases cortas, sin relleno
- Cero emojis
- Cero frases genericas como "descubre", "el lugar perfecto", "no te pierdas"
- Responde solo con el contenido final, sin explicaciones ni metadatos${igSection}${contextSection}${examplesSection}${globalExamplesSection}`
}

// Maps ContentType to AiExampleType for DB lookup
const CONTENT_TO_EXAMPLE_TYPE: Partial<Record<ContentType, string>> = {
  post:      'post',
  story:     'post',
  promotion: 'campana',
}

async function fetchAiExamples(
  supabase: Awaited<ReturnType<typeof createClient>>,
  type: ContentType
): Promise<string[]> {
  const exampleType = CONTENT_TO_EXAMPLE_TYPE[type]
  if (!exampleType) return []

  const { data } = await supabase
    .from('ai_knowledge')
    .select('content')
    .eq('type', exampleType)
    .order('created_at', { ascending: false })
    .limit(5)

  return (data ?? []).map((r: { content: string }) => r.content)
}

async function fetchGlobalExamples(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessType: string
): Promise<Array<{ title: string; category: string; style_description: string }>> {
  const { data } = await supabase
    .from('ai_examples')
    .select('title, category, style_description')
    .eq('is_active', true)
    .or(`business_types.cs.{"${businessType}"},business_types.eq.{}`)
    .order('sort_order', { ascending: true })
    .limit(5)

  return data ?? []
}

function buildKnowledgeBlock(
  knowledge: Array<{ title: string; extracted_text: string; type?: string }>
): { block: string; instagramAnalysis: string | undefined } {
  if (!knowledge || knowledge.length === 0) return { block: '', instagramAnalysis: undefined }

  const instagramEntry = knowledge.find(k => k.type === 'instagram_analysis')
  const imageEntries  = knowledge.filter(k => k.type === 'image')
  const videoEntries  = knowledge.filter(k => k.type === 'video')
  const otherKnowledge = knowledge.filter(
    k => k.type !== 'instagram_analysis' && k.type !== 'image' && k.type !== 'video'
  )

  const MAX_CHARS = 6000
  let total = 0
  const parts: string[] = []
  for (const k of otherKnowledge) {
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

  if (parts.length > 0) {
    sections.push(`Base de conocimiento del negocio:\n${parts.join('\n\n')}`)
  }

  if (imageEntries.length > 0) {
    const imgLines = imageEntries.map(k => `- ${k.title}: ${k.extracted_text}`).join('\n')
    sections.push(`Imagenes del negocio analizadas por IA:\n${imgLines}\nUsa estas descripciones para hacer el contenido mas visual y especifico.`)
  }

  if (videoEntries.length > 0) {
    const vidLines = videoEntries.map(k => `- ${k.title}: ${k.extracted_text}`).join('\n')
    sections.push(`Videos del negocio disponibles:\n${vidLines}`)
  }

  const block = sections.length > 0
    ? `${sections.join('\n\n')}\n\nUsa esta informacion para generar contenido especifico, real y autentico sobre este negocio.`
    : ''

  return { block, instagramAnalysis: instagramEntry?.extracted_text }
}

function buildUserPrompt(
  type: ContentType,
  name: string,
  platform: SocialPlatform,
  promotionType?: string,
  customInstructions?: string
): string {
  const extra = customInstructions ? ` ${customInstructions}` : ''
  const promoLabel = promotionType ? PROMOTION_LABELS[promotionType] ?? promotionType : ''

  switch (type) {
    case 'post':
      return `Genera un post de ${platform} para ${name}${promoLabel ? ` que sea un ${promoLabel}` : ''}.${extra}\n\n${OUTPUT_TEMPLATE}`
    case 'story':
      return `Genera el texto para una historia de ${platform} para ${name}. Maximo 3 lineas.${extra}\n\n${OUTPUT_TEMPLATE}`
    case 'promotion':
      return `Genera el texto completo de una promocion de tipo "${promoLabel}" para ${name}. Incluye titulo, descripcion y llamada a la accion.${extra}\n\n${OUTPUT_TEMPLATE}`
    case 'hashtags':
      return `Genera 15 hashtags relevantes para ${name} en ${platform}. Mezcla hashtags populares y de nicho. Solo devuelve los hashtags separados por espacios, sin ningun otro texto.`
  }
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#\w+/g)
  return matches ?? []
}

function extractCta(text: string): string {
  const sentences = text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  return sentences[sentences.length - 1] ?? ''
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

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

  const { business_id, type, platform, promotion_type, custom_instructions, auto_translate_languages } = body

  if (!business_id || !type || !platform) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: business_id, type, platform' },
      { status: 400 }
    )
  }

  // ── 3. Fetch business (verifies ownership via RLS) ─────────────
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

  // ── 4. Fetch knowledge + AI examples in parallel ───────────────
  const [{ data: knowledge }, aiExamples, globalExamples] = await Promise.all([
    supabase
      .from('business_knowledge')
      .select('title, extracted_text, type')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false }),
    fetchAiExamples(supabase, type),
    fetchGlobalExamples(supabase, business.category),
  ])

  // ── 5. Build prompts ───────────────────────────────────────────
  const { block: knowledgeBlock, instagramAnalysis } = buildKnowledgeBlock(knowledge ?? [])
  const systemPrompt = buildSystemPrompt(business.name, business.category, platform, knowledgeBlock, instagramAnalysis, aiExamples, globalExamples)
  const userPrompt = buildUserPrompt(type, business.name, platform, promotion_type, custom_instructions)

  // ── 6. Call OpenAI ─────────────────────────────────────────────
  try {
    const isHashtags = type === 'hashtags'
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: isHashtags ? 150 : 900,
      temperature: 0.75,
      ...(isHashtags ? {} : { response_format: { type: 'json_object' as const } }),
      messages: [
        { role: 'system', content: systemPrompt },
        ...EXAMPLES,
        { role: 'user', content: userPrompt },
      ],
    })

    const rawText = completion.choices[0]?.message?.content?.trim() ?? ''

    // ── 7. Hashtags: keep plain-text path ─────────────────────────
    if (isHashtags) {
      return NextResponse.json({
        caption: rawText,
        text: rawText,
        hashtags: extractHashtags(rawText),
        cta: '',
        image_url: null,
        image_prompt: '',
        variations: [],
      } satisfies GenerateResponse)
    }

    // ── 8. Parse structured JSON ───────────────────────────────────
    const parsed = parseAiJson(rawText)
    if (!parsed) {
      return NextResponse.json(
        { error: 'La IA no genero el formato esperado. Intentalo de nuevo.' },
        { status: 502 }
      )
    }

    // ── 9. Generate image in parallel with translation ─────────────
    const imagePromise = generateImage(parsed.image_prompt, business_id, supabase)

    const response: GenerateResponse = {
      caption:      parsed.caption,
      text:         parsed.caption,
      hashtags:     parsed.hashtags,
      cta:          parsed.cta,
      image_url:    null,
      image_prompt: parsed.image_prompt,
      variations:   parsed.variations,
    }

    // ── 10. Auto-translate caption if requested ────────────────────
    if (
      Array.isArray(auto_translate_languages) &&
      auto_translate_languages.length > 0 &&
      auto_translate_languages.length <= 4
    ) {
      const { allowed } = await checkCanTranslate(business_id)
      if (allowed) {
        try {
          const results = await Promise.all(
            auto_translate_languages.map((lang) =>
              translateText(parsed.caption, lang).then((t) => ({ lang, t }))
            )
          )
          const translations: Partial<Record<TargetLanguage, string>> = {}
          for (const { lang, t } of results) translations[lang] = t
          response.translations = translations
        } catch {
          // Translation failure is non-fatal
        }
      }
    }

    // ── 11. Await image (non-fatal) ────────────────────────────────
    response.image_url = await imagePromise

    return NextResponse.json(response)
  } catch (err: unknown) {
    // OpenAI rate limit
    if (
      err instanceof Error &&
      'status' in err &&
      (err as { status: number }).status === 429
    ) {
      return NextResponse.json(
        { error: 'Limite de solicitudes alcanzado. Espera unos segundos y vuelve a intentarlo.' },
        { status: 429 }
      )
    }

    console.error('[generate/text] OpenAI error:', err)
    return NextResponse.json(
      { error: 'Error al generar el texto. Intentalo de nuevo.' },
      { status: 500 }
    )
  }
}
