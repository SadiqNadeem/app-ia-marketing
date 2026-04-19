import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMenuSlug } from '@/lib/menu-slug'

interface RequestBody {
  business_id: string
  sections: unknown[]
  show_prices: boolean
  accent_color: string
  is_published: boolean
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

  const { business_id, sections, show_prices, accent_color, is_published } = body

  if (!business_id) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
  }

  // Verify ownership
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // Check if menu exists
  const { data: existing } = await supabase
    .from('menus')
    .select('id, slug')
    .eq('business_id', business_id)
    .maybeSingle()

  if (!existing) {
    // Create with generated slug
    const baseSlug = generateMenuSlug(business.name)
    let slug = baseSlug
    let attempt = 2

    while (true) {
      const { data: collision } = await supabase
        .from('menus')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()

      if (!collision) break
      slug = `${baseSlug}-${attempt}`
      attempt++
    }

    const { data: menu, error: insertError } = await supabase
      .from('menus')
      .insert({
        business_id,
        slug,
        sections: sections ?? [],
        show_prices: show_prices ?? true,
        accent_color: accent_color ?? '#2563EB',
        is_published: is_published ?? false,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[menu/save] Insert error:', insertError)
      return NextResponse.json({ error: 'Error al crear el menu' }, { status: 500 })
    }

    return NextResponse.json({ menu })
  }

  // Update existing
  const { data: menu, error: updateError } = await supabase
    .from('menus')
    .update({
      sections: sections ?? [],
      show_prices: show_prices ?? true,
      accent_color: accent_color ?? '#2563EB',
      is_published: is_published ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single()

  if (updateError) {
    console.error('[menu/save] Update error:', updateError)
    return NextResponse.json({ error: 'Error al guardar el menu' }, { status: 500 })
  }

  return NextResponse.json({ menu })
}
