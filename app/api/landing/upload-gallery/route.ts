import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const MAX_GALLERY = 12

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'FormData invalido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const business_id = formData.get('business_id') as string | null

  if (!file || !business_id) {
    return NextResponse.json({ error: 'file y business_id requeridos' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Solo JPG, PNG o WebP' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'La imagen no puede superar 5MB' }, { status: 400 })
  }

  // Verify ownership and get current gallery
  const { data: business } = await supabase
    .from('businesses')
    .select('id, landing_gallery')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  const currentGallery: string[] = (business.landing_gallery as string[]) ?? []
  if (currentGallery.length >= MAX_GALLERY) {
    return NextResponse.json({ error: `Maximo ${MAX_GALLERY} fotos permitidas` }, { status: 400 })
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${business_id}/gallery/${Date.now()}_${safeFileName}`
  const buffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('generated-images')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[landing/upload-gallery]', uploadError)
    return NextResponse.json({ error: 'Error al subir la imagen' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('generated-images')
    .getPublicUrl(path)

  const newGallery = [...currentGallery, publicUrl]

  const { error: updateError } = await supabase
    .from('businesses')
    .update({ landing_gallery: newGallery })
    .eq('id', business_id)

  if (updateError) {
    console.error('[landing/upload-gallery] update error', updateError)
    return NextResponse.json({ error: 'Error al actualizar la galeria' }, { status: 500 })
  }

  return NextResponse.json({ image_url: publicUrl, gallery: newGallery })
}
