import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { text, platform, business_type } = body as {
    text?: string
    platform?: string
    business_type?: string
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 })
  }

  const plat = platform ?? 'instagram'
  const btype = business_type ?? 'negocio'

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 100,
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: `Genera 10 hashtags relevantes para este post de ${plat} de un negocio de tipo ${btype}. Texto del post: '${text.trim()}'. Devuelve solo los hashtags separados por espacios, sin explicacion. Los hashtags deben ser en espanol salvo que el texto este en otro idioma. Mezcla hashtags populares con hashtags de nicho especificos del sector.`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  const hashtags = raw
    .split(/\s+/)
    .map((h) => h.trim())
    .filter((h) => h.startsWith('#') && h.length > 1)
    .slice(0, 10)

  return NextResponse.json({ hashtags })
}
