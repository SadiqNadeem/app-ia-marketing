import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'

interface RequestBody {
  business_id: string
  text: string
  voice_id?: string
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

  const { business_id, text, voice_id } = body

  if (!business_id || !text) {
    return NextResponse.json({ error: 'Faltan campos requeridos: business_id, text' }, { status: 400 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, elevenlabs_voice_id, voice_status')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  const admin = createAdminClient()
  const timestamp = Date.now()
  const storagePath = `${business_id}/voiceover/${timestamp}.mp3`

  const resolvedVoiceId = voice_id ?? business.elevenlabs_voice_id
  const hasClonedVoice = resolvedVoiceId && business.voice_status === 'ready'

  let audioBuffer: Buffer

  if (hasClonedVoice) {
    // Use ElevenLabs TTS with cloned voice
    const elevenKey = process.env.ELEVENLABS_API_KEY
    if (!elevenKey) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY no configurada' }, { status: 500 })
    }

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!elevenRes.ok) {
      const errText = await elevenRes.text()
      console.error('[voice/generate] ElevenLabs TTS error:', elevenRes.status, errText)
      return NextResponse.json({ error: `Error de ElevenLabs: ${elevenRes.status}` }, { status: 500 })
    }

    audioBuffer = Buffer.from(await elevenRes.arrayBuffer())
  } else {
    // Fallback to OpenAI TTS
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: text,
    })
    audioBuffer = Buffer.from(await mp3Response.arrayBuffer())
  }

  // Upload to Storage bucket "videos"
  const { error: uploadError } = await admin.storage
    .from('videos')
    .upload(storagePath, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

  if (uploadError) {
    console.error('[voice/generate] upload error:', uploadError)
    return NextResponse.json({ error: 'Error al subir el audio: ' + uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl: audioUrl } } = admin.storage.from('videos').getPublicUrl(storagePath)

  return NextResponse.json({ audio_url: audioUrl })
}
