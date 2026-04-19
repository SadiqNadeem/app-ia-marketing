import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RequestBody {
  business_id: string
  notification_id?: string
  mark_all?: boolean
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
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

  const { business_id, notification_id, mark_all } = body

  if (!business_id) {
    return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
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

  if (mark_all) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('business_id', business_id)
      .eq('read', false)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }
  } else if (notification_id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notification_id)
      .eq('business_id', business_id)

    if (error) {
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }
  } else {
    return NextResponse.json({ error: 'Falta notification_id o mark_all' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
