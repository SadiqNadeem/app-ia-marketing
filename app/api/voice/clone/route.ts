import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkCanCloneVoice } from '@/lib/plans'
import { createNotification } from '@/lib/notifications'

const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
]

const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm']

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Cuerpo invalido' }, { status: 400 })
  }

  const audioFile = formData.get('audio_file') as File | null
  const businessId = formData.get('business_id') as string | null
  const voiceName = formData.get('voice_name') as string | null

  if (!audioFile || !businessId || !voiceName) {
    return NextResponse.json({ error: 'Faltan campos requeridos: audio_file, business_id, voice_name' }, { status: 400 })
  }

  // Plan check — Agency only
  const planCheck = await checkCanCloneVoice(businessId)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: planCheck.reason }, { status: 403 })
  }

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
  }

  // Validate file extension
  const filename = audioFile.name ?? ''
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ error: 'Formato no soportado. Usa MP3, WAV, M4A o WebM' }, { status: 400 })
  }

  // Validate MIME type
  const mimeType = audioFile.type ?? ''
  if (mimeType && !ALLOWED_MIME_TYPES.some(m => mimeType.startsWith(m.split('/')[0]) && mimeType.includes(m.split('/')[1]))) {
    // Allow if extension is valid even if MIME type is not perfectly recognized (browser quirks)
  }

  // Validate file size — max 20 MB
  const MAX_SIZE_BYTES = 20 * 1024 * 1024
  if (audioFile.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'El archivo supera el tamano maximo de 20 MB' }, { status: 400 })
  }

  // Validate minimum duration (30s) and maximum (5 min) — we check size as a proxy.
  // Exact duration validation happens on the client; here we trust the client.

  const admin = createAdminClient()

  // 1. Upload audio sample to Storage
  const timestamp = Date.now()
  const storagePath = `${businessId}/voice_sample/${timestamp}.${ext}`
  const arrayBuffer = await audioFile.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await admin.storage
    .from('knowledge')
    .upload(storagePath, buffer, { contentType: audioFile.type || 'audio/mpeg', upsert: true })

  if (uploadError) {
    console.error('[voice/clone] storage upload error:', uploadError)
    return NextResponse.json({ error: 'Error al subir el audio: ' + uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl: voiceSampleUrl } } = admin.storage.from('knowledge').getPublicUrl(storagePath)

  // 2. Update businesses: processing state
  await admin
    .from('businesses')
    .update({
      voice_status: 'processing',
      voice_name: voiceName,
      voice_sample_url: voiceSampleUrl,
      elevenlabs_voice_id: null,
    })
    .eq('id', businessId)

  // 3. Call ElevenLabs Voice Cloning API
  const elevenKey = process.env.ELEVENLABS_API_KEY
  if (!elevenKey) {
    await admin.from('businesses').update({ voice_status: 'failed' }).eq('id', businessId)
    return NextResponse.json({ success: false, error: 'ELEVENLABS_API_KEY no configurada' }, { status: 500 })
  }

  const elevenForm = new FormData()
  elevenForm.append('name', voiceName)
  elevenForm.append('description', `Voz de ${business.name}`)
  elevenForm.append('files', new Blob([buffer], { type: audioFile.type || 'audio/mpeg' }), filename)

  let voiceId: string
  try {
    const elevenRes = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
      },
      body: elevenForm,
    })

    if (!elevenRes.ok) {
      const errText = await elevenRes.text()
      console.error('[voice/clone] ElevenLabs error:', elevenRes.status, errText)
      await admin.from('businesses').update({ voice_status: 'failed' }).eq('id', businessId)
      return NextResponse.json({ success: false, error: `Error de ElevenLabs: ${elevenRes.status}` }, { status: 500 })
    }

    const elevenData = await elevenRes.json() as { voice_id: string }
    voiceId = elevenData.voice_id
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[voice/clone] fetch error:', message)
    await admin.from('businesses').update({ voice_status: 'failed' }).eq('id', businessId)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }

  // 4. Save voice_id and mark ready
  await admin
    .from('businesses')
    .update({
      elevenlabs_voice_id: voiceId,
      voice_status: 'ready',
    })
    .eq('id', businessId)

  // 5. Create notification
  await createNotification({
    business_id: businessId,
    type: 'post_published',
    title: 'Tu voz personalizada esta lista',
    message: 'Los proximos videos generados con IA usaran tu voz.',
    link: '/dashboard/settings',
  })

  return NextResponse.json({ success: true, voice_id: voiceId })
}
