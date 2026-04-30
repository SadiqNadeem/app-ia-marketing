import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

interface RequestBody {
  business_id: string
  prompt: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────
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
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, prompt } = body

  if (!business_id || !prompt?.trim()) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: business_id, prompt' },
      { status: 400 }
    )
  }

  // ── 3. Verify ownership ────────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  // ── 4. Call DALL-E 3 ───────────────────────────────────────────
  let tempUrl: string
  try {
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.trim(),
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    })
    tempUrl = response.data?.[0]?.url ?? ''
    if (!tempUrl) throw new Error('No image URL returned')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('content_policy') || msg.includes('safety')) {
      return NextResponse.json(
        { error: 'Contenido no permitido. Cambia el prompt e intenta de nuevo.' },
        { status: 400 }
      )
    }
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
    console.error('[regenerate-image] DALL-E error:', err)
    return NextResponse.json(
      { error: 'Error al generar la imagen. Intentalo de nuevo.' },
      { status: 500 }
    )
  }

  // ── 5. Download from OpenAI temp URL ──────────────────────────
  let imageBuffer: ArrayBuffer
  try {
    const imgRes = await fetch(tempUrl)
    if (!imgRes.ok) throw new Error(`Fetch failed: ${imgRes.status}`)
    imageBuffer = await imgRes.arrayBuffer()
  } catch (err) {
    console.error('[regenerate-image] download error:', err)
    return NextResponse.json({ error: 'Error al descargar la imagen.' }, { status: 500 })
  }

  // ── 6. Upload to Supabase Storage ──────────────────────────────
  const storagePath = `${business_id}/${Date.now()}.png`
  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(storagePath, imageBuffer, { contentType: 'image/png', upsert: false })

  if (uploadError) {
    console.error('[regenerate-image] storage error:', uploadError)
    return NextResponse.json({ error: 'Error al guardar la imagen.' }, { status: 500 })
  }

  // ── 7. Return public URL ───────────────────────────────────────
  const { data: urlData } = supabase.storage
    .from('generated-images')
    .getPublicUrl(storagePath)

  return NextResponse.json({ image_url: urlData.publicUrl })
}
