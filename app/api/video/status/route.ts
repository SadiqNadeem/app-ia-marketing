import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const project_id = searchParams.get('project_id')
  const business_id = searchParams.get('business_id')

  if (!project_id || !business_id) {
    return NextResponse.json({ error: 'project_id y business_id requeridos' }, { status: 400 })
  }

  const { data: project } = await supabase
    .from('video_projects')
    .select('id, status, script, voiceover_url, video_url, error_message, updated_at')
    .eq('id', project_id)
    .eq('business_id', business_id)
    .single()

  if (!project) {
    return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }

  return NextResponse.json(project)
}
