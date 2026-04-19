import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'])
const VIDEO_MIME = new Set(['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'])

const IMAGE_MAX_BYTES = 10 * 1024 * 1024   // 10 MB
const VIDEO_MAX_BYTES = 100 * 1024 * 1024  // 100 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse multipart form ────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud invalido' }, { status: 400 })
  }

  const file = formData.get('file')
  const business_id = String(formData.get('business_id') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const userDescription = String(formData.get('description') ?? '').trim()

  if (!(file instanceof File) || !business_id || !title) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: file, business_id, title' },
      { status: 400 }
    )
  }

  // ── 3. Verify ownership ────────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, category')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const mime = file.type
  const isImage = IMAGE_MIME.has(mime)
  const isVideo = VIDEO_MIME.has(mime) ||
    mime === '' && /\.(mp4|mov|avi|webm|mkv)$/i.test(file.name)

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: 'Formato no soportado. Usa JPG, PNG, GIF, WEBP, MP4, MOV, AVI o WEBM.' },
      { status: 400 }
    )
  }

  // ── 4. Size check ──────────────────────────────────────────────
  const maxBytes = isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES
  if (file.size > maxBytes) {
    const limitMb = maxBytes / 1024 / 1024
    return NextResponse.json(
      { error: `El archivo supera el limite de ${limitMb}MB.` },
      { status: 400 }
    )
  }

  // ── 5. Upload to Supabase Storage (admin bypasses RLS) ─────────
  const admin = createAdminClient()

  // Ensure the bucket exists (creates it if missing)
  const { data: buckets } = await admin.storage.listBuckets()
  const bucketExists = buckets?.some(b => b.name === 'knowledge')
  if (!bucketExists) {
    const { error: bucketError } = await admin.storage.createBucket('knowledge', { public: true })
    if (bucketError) {
      console.error('[upload-media] bucket create error:', bucketError)
      return NextResponse.json({ error: `No se pudo crear el bucket de storage: ${bucketError.message}` }, { status: 500 })
    }
  }

  const fileBuffer = await file.arrayBuffer()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? (isImage ? 'jpg' : 'mp4')
  const folder = isImage ? 'images' : 'videos'
  const storagePath = `${business_id}/${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await admin.storage
    .from('knowledge')
    .upload(storagePath, fileBuffer, { contentType: mime || `${isImage ? 'image' : 'video'}/${ext}`, upsert: false })

  if (uploadError) {
    console.error('[upload-media] storage error:', uploadError)
    return NextResponse.json({ error: `Error al subir el archivo: ${uploadError.message}` }, { status: 500 })
  }

  const { data: urlData } = admin.storage.from('knowledge').getPublicUrl(storagePath)
  const publicUrl = urlData.publicUrl

  // ── 6. IMAGE: analyse with GPT-4o Vision ──────────────────────
  if (isImage) {
    let analysisText = ''
    try {
      const visionRes = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: publicUrl },
              },
              {
                type: 'text',
                text: `Describe detalladamente esta imagen en el contexto de un negocio de tipo ${business.category}. Incluye: que se ve, productos o servicios visibles, ambiente, colores corporativos, texto visible en la imagen, y cualquier informacion util para generar contenido de marketing. Responde en espanol, maximo 200 palabras, sin emojis.`,
              },
            ],
          },
        ],
      })
      analysisText = visionRes.choices[0]?.message?.content?.trim() ?? ''
    } catch (err) {
      console.error('[upload-media] vision error:', err)
      analysisText = `Imagen del negocio: ${title}.`
    }

    const { data: inserted, error: insertError } = await supabase
      .from('business_knowledge')
      .insert({
        business_id,
        type: 'image',
        title,
        original_file_url: publicUrl,
        extracted_text: analysisText,
        file_size_kb: Math.round(file.size / 1024),
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[upload-media] insert error:', insertError)
      return NextResponse.json({ error: 'Error al guardar en la base de datos.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      id: inserted.id,
      extracted_text: analysisText,
      file_url: publicUrl,
      type: 'image',
    })
  }

  // ── 7. VIDEO: save with manual description ─────────────────────
  const extractedText = `Video del negocio: ${title}.${userDescription ? ' ' + userDescription : ''}`

  const { data: inserted, error: insertError } = await supabase
    .from('business_knowledge')
    .insert({
      business_id,
      type: 'video',
      title,
      original_file_url: publicUrl,
      extracted_text: extractedText,
      file_size_kb: Math.round(file.size / 1024),
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[upload-media] insert video error:', insertError)
    return NextResponse.json({ error: 'Error al guardar en la base de datos.' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    id: inserted.id,
    file_url: publicUrl,
    type: 'video',
    needs_description: !userDescription,
  })
}
