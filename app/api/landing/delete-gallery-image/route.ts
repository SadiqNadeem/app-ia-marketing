import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { business_id: string; image_url: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id, image_url } = body

  if (!business_id || !image_url) {
    return NextResponse.json({ error: 'business_id e image_url requeridos' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, landing_gallery')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // Remove from gallery array
  const currentGallery: string[] = (business.landing_gallery as string[]) ?? []
  const newGallery = currentGallery.filter((url) => url !== image_url)

  const { error: updateError } = await supabase
    .from('businesses')
    .update({ landing_gallery: newGallery })
    .eq('id', business_id)

  if (updateError) {
    console.error('[landing/delete-gallery-image]', updateError)
    return NextResponse.json({ error: 'Error al actualizar la galeria' }, { status: 500 })
  }

  // Extract storage path from URL and delete from storage
  try {
    const url = new URL(image_url)
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/generated-images\/(.+)$/)
    if (pathMatch) {
      await supabase.storage.from('generated-images').remove([pathMatch[1]])
    }
  } catch {
    // If storage delete fails, gallery is already updated — not critical
  }

  return NextResponse.json({ success: true, gallery: newGallery })
}
