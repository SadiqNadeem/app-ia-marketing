import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCanGenerateVideo } from '@/lib/plans'
import { generateVideo, type VideoStyle, type VideoPlatform } from '@/lib/video-generator'

interface RequestBody {
  business_id: string
  title: string
  image_urls: string[]
  style: VideoStyle
  platform: VideoPlatform
  duration_seconds: 15 | 30
  custom_text?: string
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

  const { business_id, title, image_urls, style, platform, duration_seconds, custom_text } = body

  if (!business_id || !title || !image_urls?.length) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (image_urls.length < 3 || image_urls.length > 10) {
    return NextResponse.json({ error: 'Sube entre 3 y 10 fotos' }, { status: 400 })
  }

  // Plan check
  const planCheck = await checkCanGenerateVideo(business_id)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.reason }, { status: 403 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, business_type_id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Fetch knowledge context
  const { data: knowledge } = await supabase
    .from('business_knowledge')
    .select('title, extracted_text')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })
    .limit(3)

  const knowledgeContext = knowledge?.length
    ? knowledge.map(k => `[${k.title}]\n${k.extracted_text}`).join('\n\n').slice(0, 1500)
    : 'Sin informacion adicional.'

  const admin = createAdminClient()

  // Create project record
  const { data: project, error: insertError } = await admin
    .from('video_projects')
    .insert({
      business_id,
      title,
      status: 'draft',
      input_images: image_urls,
      style: style ?? 'dinamico',
      platform: platform ?? 'instagram',
      duration_seconds: duration_seconds ?? 15,
    })
    .select('id')
    .single()

  if (insertError || !project) {
    console.error('[video/create] insert error:', insertError)
    return NextResponse.json({ error: 'Error al crear el proyecto' }, { status: 500 })
  }

  const projectId = project.id

  // Launch generation asynchronously — no await
  generateVideo(projectId, business_id, {
    title,
    image_urls,
    style: style ?? 'dinamico',
    platform: platform ?? 'instagram',
    duration_seconds: duration_seconds ?? 15,
    custom_text,
    business_name: business.name,
    knowledge_context: knowledgeContext,
  }).catch(err => {
    console.error('[video/create] generateVideo error:', err)
  })

  return NextResponse.json({ success: true, project_id: projectId })
}
