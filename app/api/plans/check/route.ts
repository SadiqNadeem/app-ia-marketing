import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCanTranslate, checkCanPublish, checkCanConnectSocial } from '@/lib/plans'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const feature = searchParams.get('feature')
  const business_id = searchParams.get('business_id')

  if (!feature || !business_id) {
    return NextResponse.json({ error: 'Faltan parametros: feature, business_id' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  let result: { allowed: boolean; reason?: string }

  switch (feature) {
    case 'translate':
      result = await checkCanTranslate(business_id)
      break
    case 'publish':
      result = await checkCanPublish(business_id)
      break
    case 'social_connect':
      result = await checkCanConnectSocial(business_id)
      break
    default:
      return NextResponse.json({ error: `Feature desconocida: ${feature}` }, { status: 400 })
  }

  return NextResponse.json(result)
}
