import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const business_id = searchParams.get('business_id')

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

  const [{ data: notifications, error }, { count: unreadCount }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('business_id', business_id)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business_id)
      .eq('read', false),
  ])

  if (error) {
    console.error('[notifications/list] Error:', error)
    return NextResponse.json({ error: 'Error al obtener notificaciones' }, { status: 500 })
  }

  return NextResponse.json({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 })
}
