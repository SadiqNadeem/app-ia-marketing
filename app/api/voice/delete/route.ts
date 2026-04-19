import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { business_id: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const { business_id } = body
  if (!business_id) {
    return NextResponse.json({ error: 'Falta business_id' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, elevenlabs_voice_id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Delete from ElevenLabs if voice exists
  if (business.elevenlabs_voice_id) {
    const elevenKey = process.env.ELEVENLABS_API_KEY
    if (elevenKey) {
      try {
        const elevenRes = await fetch(
          `https://api.elevenlabs.io/v1/voices/${business.elevenlabs_voice_id}`,
          {
            method: 'DELETE',
            headers: { 'xi-api-key': elevenKey },
          }
        )
        if (!elevenRes.ok) {
          console.warn('[voice/delete] ElevenLabs delete returned:', elevenRes.status)
          // Continue anyway — we still clear local data
        }
      } catch (err) {
        console.warn('[voice/delete] ElevenLabs delete error:', err)
        // Continue anyway
      }
    }
  }

  // Clear voice fields in businesses
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('businesses')
    .update({
      elevenlabs_voice_id: null,
      voice_name: null,
      voice_sample_url: null,
      voice_status: 'none',
    })
    .eq('id', business_id)

  if (updateError) {
    console.error('[voice/delete] update error:', updateError)
    return NextResponse.json({ error: 'Error al eliminar la voz' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
