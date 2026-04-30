import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

interface RequestBody {
  example_id: string
  business_name: string
  main_text: string
  secondary_text?: string
  cta_text?: string
  format: '1:1' | '9:16' | '16:9'
  primary_color: string
  include_logo: boolean
  business_id: string
}

const FORMAT_TO_SIZE: Record<string, '1024x1024' | '1024x1792' | '1792x1024'> = {
  '1:1':  '1024x1024',
  '9:16': '1024x1792',
  '16:9': '1792x1024',
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
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const {
    example_id, business_name, main_text, secondary_text,
    cta_text, format, primary_color, business_id,
  } = body

  if (!example_id || !business_name || !main_text || !business_id) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: example_id, business_name, main_text, business_id' },
      { status: 400 }
    )
  }

  // 1. Obtener el ejemplo y el negocio en paralelo
  const [{ data: example, error: exError }, { data: business, error: bizError }] = await Promise.all([
    supabase
      .from('ai_examples')
      .select('style_description, category, style_tags, image_url')
      .eq('id', example_id)
      .eq('is_active', true)
      .single(),
    supabase
      .from('businesses')
      .select('name, category, primary_color, logo_url')
      .eq('id', business_id)
      .eq('owner_id', user.id)
      .single(),
  ])

  if (exError || !example) {
    return NextResponse.json({ error: 'Ejemplo no encontrado' }, { status: 404 })
  }
  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // 2. Construir prompt
  const tagsStr = (example.style_tags ?? []).join(', ')
  const secondaryLine = secondary_text ? `- Secondary text: ${secondary_text}` : ''
  const ctaLine = cta_text ? `- Call to action: ${cta_text}` : ''

  const prompt = [
    `Professional ${example.category} design for ${business_name}, a ${business.category} business.`,
    ``,
    `Style reference: ${example.style_description}`,
    ``,
    `Content to include:`,
    `- Business name: ${business_name}`,
    `- Main text/offer: ${main_text}`,
    secondaryLine,
    ctaLine,
    `- Brand color: ${primary_color || business.primary_color || '#2563EB'}`,
    ``,
    `Style tags to apply: ${tagsStr}`,
    ``,
    `IMPORTANT: Create a professional, visually striking design that matches the reference style but with the new business content. The text must be clearly readable. High quality, commercial design. No watermarks.`,
  ].filter(Boolean).join('\n')

  // 3. Llamar a DALL-E 3
  const size = FORMAT_TO_SIZE[format] ?? '1024x1024'
  let tempImageUrl: string
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size,
      quality: 'hd',
      style: 'vivid',
      n: 1,
    })
    tempImageUrl = response.data[0]?.url ?? ''
    if (!tempImageUrl) throw new Error('DALL-E did not return an image URL')
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (errMsg.includes('content_policy') || errMsg.includes('safety')) {
      return NextResponse.json(
        { error: 'El contenido no pudo generarse. Intenta con otras instrucciones.' },
        { status: 400 }
      )
    }
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 429) {
      return NextResponse.json(
        { error: 'Limite de solicitudes alcanzado. Espera unos segundos.' },
        { status: 429 }
      )
    }
    console.error('[generate/flyer] DALL-E error:', err)
    return NextResponse.json({ error: 'Error al generar la imagen. Intentalo de nuevo.' }, { status: 500 })
  }

  // 4. Descargar imagen
  let imageBuffer: ArrayBuffer
  try {
    const imgRes = await fetch(tempImageUrl)
    if (!imgRes.ok) throw new Error(`Fetch failed: ${imgRes.status}`)
    imageBuffer = await imgRes.arrayBuffer()
  } catch (err) {
    console.error('[generate/flyer] download error:', err)
    return NextResponse.json({ error: 'Error al descargar la imagen generada.' }, { status: 500 })
  }

  // 5. Subir al bucket generated-images
  const storagePath = `${business_id}/flyers/${Date.now()}.png`
  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(storagePath, imageBuffer, { contentType: 'image/png', upsert: false })

  if (uploadError) {
    console.error('[generate/flyer] storage error:', uploadError)
    return NextResponse.json({ error: 'Error al guardar la imagen.' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('generated-images').getPublicUrl(storagePath)
  const imageUrl = urlData.publicUrl

  // 6. Guardar en content_library (best-effort, no falla el request si hay error)
  await supabase.from('content_library').insert({
    business_id,
    type: 'image',
    file_url: imageUrl,
  }).then(({ error }) => {
    if (error) console.warn('[generate/flyer] content_library insert skipped:', error.message)
  })

  return NextResponse.json({ success: true, image_url: imageUrl })
}
