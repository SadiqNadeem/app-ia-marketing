import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { image_url, business_id } = await req.json()
    if (!image_url || !business_id) {
      return NextResponse.json({ error: 'Faltan parametros' }, { status: 400 })
    }

    const apiKey = process.env.REMOVE_BG_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'REMOVE_BG_API_KEY no configurado' }, { status: 500 })
    }

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url,
        size: 'auto',
        format: 'png',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json({ error: `remove.bg error: ${errText}` }, { status: 400 })
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const path = `${business_id}/uploads/nobg_${Date.now()}.png`
    const { data, error } = await supabase.storage
      .from('generated-images')
      .upload(path, buffer, { contentType: 'image/png', upsert: false })

    if (error || !data) {
      return NextResponse.json({ error: 'Error al subir imagen procesada' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage.from('generated-images').getPublicUrl(data.path)
    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('remove-bg error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
