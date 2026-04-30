import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formulario invalido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim()
  const description = (formData.get('description') as string | null)?.trim() ?? ''
  const styleDescription = (formData.get('style_description') as string | null)?.trim() ?? ''
  const category = (formData.get('category') as string | null) ?? 'flyer'
  const platform = (formData.get('platform') as string | null) ?? null
  const postType = (formData.get('post_type') as string | null) ?? null
  const canvasWidth = parseInt(formData.get('canvas_width') as string ?? '1080', 10) || 1080
  const canvasHeight = parseInt(formData.get('canvas_height') as string ?? '1350', 10) || 1350
  const sortOrder = parseInt(formData.get('sort_order') as string ?? '0', 10) || 0
  const isActive = (formData.get('is_active') as string) !== 'false'

  let businessTypes: string[] = []
  let styleTags: string[] = []
  try { businessTypes = JSON.parse(formData.get('business_types') as string ?? '[]') } catch { /* */ }
  try { styleTags = JSON.parse(formData.get('style_tags') as string ?? '[]') } catch { /* */ }

  if (!title) return NextResponse.json({ error: 'El titulo es requerido' }, { status: 400 })

  let imageUrl = (formData.get('image_url') as string | null) ?? ''

  if (file && file.size > 0) {
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'La imagen no puede superar 8 MB' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `examples/${category}/${Date.now()}_${safeName}`

    const admin = createAdminClient()
    const { error: uploadError } = await admin.storage
      .from('ai-examples')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadError) {
      console.error('[upload-example] storage error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('ai-examples').getPublicUrl(path)
    imageUrl = urlData.publicUrl
  }

  if (!imageUrl) return NextResponse.json({ error: 'Se requiere una imagen' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error: insertError } = await admin
    .from('ai_examples')
    .insert({
      title,
      description: description || styleDescription.slice(0, 150),
      image_url: imageUrl,
      preview_url: imageUrl,
      category,
      style_description: styleDescription,
      business_types: businessTypes,
      style_tags: styleTags,
      is_active: isActive,
      is_template: false,
      sort_order: sortOrder,
      platform,
      post_type: postType,
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[upload-example] insert error:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data.id, image_url: imageUrl })
}
