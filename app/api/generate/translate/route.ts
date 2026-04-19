import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import { checkCanTranslate } from '@/lib/plans'

type TargetLanguage = 'en' | 'fr' | 'de' | 'it' | 'pt' | 'ar'

interface RequestBody {
  business_id: string
  text: string
  source_language: 'es'
  target_languages: TargetLanguage[]
}

const LANGUAGE_NAMES: Record<TargetLanguage, string> = {
  en: 'ingles',
  fr: 'frances',
  de: 'aleman',
  it: 'italiano',
  pt: 'portugues',
  ar: 'arabe',
}

const VALID_LANGUAGES = new Set<string>(['en', 'fr', 'de', 'it', 'pt', 'ar'])

async function translateToLanguage(text: string, lang: TargetLanguage): Promise<string> {
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
      {
        role: 'user',
        content: text,
      },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() ?? ''
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

  const { business_id, text, target_languages } = body

  if (!business_id || !text?.trim()) {
    return NextResponse.json({ error: 'Faltan campos requeridos: business_id, text' }, { status: 400 })
  }

  if (!Array.isArray(target_languages) || target_languages.length === 0) {
    return NextResponse.json({ error: 'target_languages debe tener al menos 1 idioma' }, { status: 400 })
  }

  if (target_languages.length > 4) {
    return NextResponse.json({ error: 'No puedes traducir a mas de 4 idiomas a la vez' }, { status: 400 })
  }

  const invalidLangs = target_languages.filter((l) => !VALID_LANGUAGES.has(l))
  if (invalidLangs.length > 0) {
    return NextResponse.json({ error: `Idiomas no validos: ${invalidLangs.join(', ')}` }, { status: 400 })
  }

  // Verify business ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // Plan check
  const { allowed, reason } = await checkCanTranslate(business_id)
  if (!allowed) {
    return NextResponse.json({ error: reason }, { status: 403 })
  }

  try {
    const results = await Promise.all(
      target_languages.map((lang) =>
        translateToLanguage(text, lang).then((translated) => ({ lang, translated }))
      )
    )

    const translations: Partial<Record<TargetLanguage, string>> = {}
    for (const { lang, translated } of results) {
      translations[lang] = translated
    }

    return NextResponse.json({ translations })
  } catch (err) {
    console.error('[generate/translate] OpenAI error:', err)
    return NextResponse.json({ error: 'Error al traducir. Intentalo de nuevo.' }, { status: 500 })
  }
}
