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
  const category = formData.get('category') as string | null

  if (!file || !category) {
    return NextResponse.json({ error: 'Faltan campos requeridos: file, category' }, { status: 400 })
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'La imagen no puede superar 5 MB' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `examples/${category}/${Date.now()}_${safeName}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('ai-examples')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[upload-example-image] storage error:', uploadError)
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data } = admin.storage.from('ai-examples').getPublicUrl(path)

  return NextResponse.json({ url: data.publicUrl })
}
