import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { SocialPlatform } from '@/types'

interface RequestBody {
  platform: SocialPlatform
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // ── Auth check ─────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── Parse body ─────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { platform } = body
  if (!platform) {
    return NextResponse.json({ error: 'Falta el campo platform' }, { status: 400 })
  }

  // ── Get the user's business ────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // ── Delete the social connection ───────────────────────────────
  // RLS policies allow the owner to delete their own connections,
  // so the regular (anon-key) client is sufficient here.
  const { error: deleteError } = await supabase
    .from('social_connections')
    .delete()
    .eq('business_id', business.id)
    .eq('platform', platform)

  if (deleteError) {
    console.error('[disconnect] delete error:', deleteError)
    return NextResponse.json(
      { error: 'Error al desconectar la plataforma' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
