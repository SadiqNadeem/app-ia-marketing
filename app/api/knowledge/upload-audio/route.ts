import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import { toFile } from 'openai'

const MAX_AUDIO_SIZE = 25 * 1024 * 1024 // 25 MB
const ALLOWED_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/mp4a-latm', 'audio/x-m4a', 'audio/wav', 'audio/webm', 'video/webm', 'audio/ogg']
const ALLOWED_EXTS = ['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg']

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // ── 2. Parse form data ─────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Formulario invalido' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const business_id = formData.get('business_id') as string | null
  const title = formData.get('title') as string | null

  if (!file || !business_id || !title) {
    return NextResponse.json({ error: 'Faltan campos: file, business_id, title' }, { status: 400 })
  }

  const fileName = file.name.toLowerCase()
  const hasValidExt = ALLOWED_EXTS.some((ext) => fileName.endsWith(ext))
  if (!hasValidExt && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Formato de audio no soportado. Usa MP3, MP4, M4A, WAV o WebM.' }, { status: 400 })
  }

  if (file.size > MAX_AUDIO_SIZE) {
    return NextResponse.json({ error: 'El audio no puede superar los 25 MB' }, { status: 400 })
  }

  // ── 3. Verify business ownership ───────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return NextResponse.json({ error: 'Negocio no encontrado o sin permiso' }, { status: 403 })
  }

  // ── 4. Upload audio to storage ─────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${business_id}/audio/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  const { error: uploadError } = await supabase.storage
    .from('knowledge')
    .upload(storagePath, buffer, { contentType: file.type || 'audio/mpeg', upsert: false })

  if (uploadError) {
    console.error('[knowledge/upload-audio] storage error:', uploadError)
    return NextResponse.json({ error: 'Error al subir el audio' }, { status: 500 })
  }

  const { data: urlData } = supabase.storage.from('knowledge').getPublicUrl(storagePath)
  const original_file_url = urlData.publicUrl

  // ── 5. Transcribe with Whisper ────────────────────────────────
  let extractedText = ''
  try {
    const audioFile = await toFile(buffer, file.name || 'audio.mp3', { type: file.type || 'audio/mpeg' })
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'es',
    })
    extractedText = transcription.text.trim()
  } catch (err) {
    console.error('[knowledge/upload-audio] whisper error:', err)
    return NextResponse.json({ error: 'Error al transcribir el audio' }, { status: 500 })
  }

  if (!extractedText) {
    return NextResponse.json({ error: 'No se pudo transcribir el audio. Asegurate de que tenga voz clara.' }, { status: 400 })
  }

  // ── 6. Save to business_knowledge ─────────────────────────────
  const { data: record, error: insertError } = await supabase
    .from('business_knowledge')
    .insert({
      business_id,
      type: 'audio',
      title: title.trim(),
      original_file_url,
      extracted_text: extractedText,
      file_size_kb: Math.round(file.size / 1024),
    })
    .select('id')
    .single()

  if (insertError || !record) {
    console.error('[knowledge/upload-audio] insert error:', insertError)
    return NextResponse.json({ error: 'Error al guardar la transcripcion' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    id: record.id,
    extracted_text: extractedText,
  })
}
