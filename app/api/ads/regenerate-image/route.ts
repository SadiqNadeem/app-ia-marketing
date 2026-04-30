import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'

interface RequestBody {
  ad_id: string
  business_id: string
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

  const { ad_id, business_id } = body
  if (!ad_id || !business_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('name, category, primary_color')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Get the ad
  const { data: ad } = await supabase
    .from('ad_creatives')
    .select('id, platform, objective')
    .eq('id', ad_id)
    .eq('business_id', business_id)
    .single()

  if (!ad) {
    return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 })
  }

  // Objective context
  const objectiveContext: Record<string, string> = {
    awareness:  'brand awareness, professional business presentation',
    traffic:    'inviting location, welcoming atmosphere, foot traffic',
    leads:      'professional consultation, trust building, clean office',
    sales:      'product showcase, compelling offer, purchase intent',
    engagement: 'community, social interaction, lifestyle',
  }

  const platformContext = ad.platform === 'meta'
    ? 'square format social media ad, Facebook Instagram style'
    : 'display advertising, professional and clean'

  const dallePrompt = (
    `Professional paid advertising visual for ${business.name}, a ${business.category} business. ` +
    `${platformContext}. Context: ${objectiveContext[ad.objective] ?? 'professional marketing'}. ` +
    `High quality commercial photography, clean composition, ` +
    `vibrant colors inspired by ${business.primary_color ?? '#2563EB'}. ` +
    `No text, no logos, no watermarks, no people.`
  )

  try {
    const imageRes = await openai.images.generate({
      model: 'dall-e-3',
      prompt: dallePrompt,
      size: '1024x1024',
      quality: 'standard',
      n: 1,
    })

    const tempUrl = (imageRes.data ?? [])[0]?.url
    if (!tempUrl) throw new Error('No image URL returned')

    const imgBuffer = await fetch(tempUrl).then(r => r.arrayBuffer())
    const storagePath = `${business_id}/ads/${Date.now()}.png`

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(storagePath, imgBuffer, { contentType: 'image/png', upsert: false })

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('generated-images')
      .getPublicUrl(storagePath)

    const imageUrl = urlData.publicUrl

    // Update record
    const admin = createAdminClient()
    await admin.from('ad_creatives').update({ image_url: imageUrl }).eq('id', ad_id)

    return NextResponse.json({ image_url: imageUrl })
  } catch (err) {
    console.error('[ads/regenerate-image] error:', err)
    return NextResponse.json({ error: 'Error al regenerar la imagen' }, { status: 500 })
  }
}
