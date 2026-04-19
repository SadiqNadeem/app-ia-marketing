import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'
import { createNotification } from '@/lib/notifications'

export type VideoStyle = 'dinamico' | 'elegante' | 'minimalista' | 'energico'
export type VideoPlatform = 'instagram' | 'tiktok' | 'youtube'

export interface VideoInput {
  title: string
  image_urls: string[]
  style: VideoStyle
  platform: VideoPlatform
  duration_seconds: number
  custom_text?: string
  business_name: string
  knowledge_context: string
}

const STYLE_DESCRIPTIONS: Record<VideoStyle, string> = {
  dinamico:    'Dinamico y rapido, con cortes agiles y energia constante',
  elegante:    'Elegante y sofisticado, con transiciones suaves y ritmo pausado',
  minimalista: 'Minimalista y limpio, con espacios en blanco y mensajes directos',
  energico:    'Energico y vibrante, con ritmo alto y mucho impacto visual',
}

interface VideoScript {
  opening_text: string
  voiceover_script: string
  closing_text: string
}

async function updateProject(
  projectId: string,
  fields: Record<string, unknown>
) {
  const admin = createAdminClient()
  await admin
    .from('video_projects')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', projectId)
}

// ── Step 1: Generate script ──────────────────────────────────────────────────

async function generateScript(
  projectId: string,
  input: VideoInput
): Promise<VideoScript> {
  await updateProject(projectId, { status: 'generating_script' })

  const customTextLine = input.custom_text
    ? `Mensaje principal: ${input.custom_text}`
    : ''

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 400,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Eres un experto en guiones para videos cortos de marketing en redes sociales.',
      },
      {
        role: 'user',
        content: `Genera un guion corto para un video de ${input.duration_seconds} segundos para ${input.business_name}.
Estilo: ${input.style}. Plataforma: ${input.platform}.
${customTextLine}
Contexto del negocio: ${input.knowledge_context}

El guion debe tener:
- Texto de apertura (aparece en pantalla los primeros 3 segundos)
- Narracion en voz en off (texto que se lee en ${input.duration_seconds} segundos, natural y directo)
- Texto de cierre con llamada a la accion

Responde en JSON con esta estructura exacta:
{
  "opening_text": "texto de apertura maximo 6 palabras",
  "voiceover_script": "narracion completa para leer en voz alta, sin emojis",
  "closing_text": "llamada a la accion maximo 6 palabras"
}`,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? '{}'
  const script = JSON.parse(raw) as VideoScript

  await updateProject(projectId, {
    script: JSON.stringify(script),
  })

  return script
}

// ── Step 2: Generate voiceover ───────────────────────────────────────────────

async function generateVoiceover(
  projectId: string,
  businessId: string,
  voiceoverText: string
): Promise<string> {
  await updateProject(projectId, { status: 'generating_voiceover' })

  const admin = createAdminClient()

  // Check if business has a cloned ElevenLabs voice
  const { data: business } = await admin
    .from('businesses')
    .select('elevenlabs_voice_id, voice_status')
    .eq('id', businessId)
    .single()

  const hasClonedVoice =
    business?.elevenlabs_voice_id &&
    business?.voice_status === 'ready'

  let buffer: Buffer

  if (hasClonedVoice) {
    // Use ElevenLabs TTS with the cloned voice
    const elevenKey = process.env.ELEVENLABS_API_KEY
    if (!elevenKey) throw new Error('ELEVENLABS_API_KEY no configurada')

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${business!.elevenlabs_voice_id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: voiceoverText,
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
      throw new Error(`ElevenLabs TTS error: ${elevenRes.status} ${errText}`)
    }

    buffer = Buffer.from(await elevenRes.arrayBuffer())
  } else {
    // Fallback: OpenAI TTS
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: voiceoverText,
    })
    buffer = Buffer.from(await mp3Response.arrayBuffer())
  }

  const path = `${businessId}/voiceover/${projectId}.mp3`

  const { error: uploadError } = await admin.storage
    .from('videos')
    .upload(path, buffer, { contentType: 'audio/mpeg', upsert: true })

  if (uploadError) {
    throw new Error(`Error subiendo voiceover: ${uploadError.message}`)
  }

  const { data: { publicUrl } } = admin.storage.from('videos').getPublicUrl(path)

  await updateProject(projectId, { voiceover_url: publicUrl })

  return publicUrl
}

// ── Step 3: Generate video with Runway ML ────────────────────────────────────

async function generateRunwayVideo(
  projectId: string,
  businessId: string,
  input: VideoInput,
  script: VideoScript
): Promise<string> {
  await updateProject(projectId, { status: 'generating_video' })

  const admin = createAdminClient()
  const runwayKey = process.env.RUNWAY_API_KEY

  if (!runwayKey) {
    throw new Error('RUNWAY_API_KEY no configurada')
  }

  const styleDesc = STYLE_DESCRIPTIONS[input.style]
  const promptText = `${script.opening_text}. ${styleDesc}. Professional marketing video for ${input.business_name}.`

  // Runway Gen-3 Alpha Turbo — image to video
  const initRes = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${runwayKey}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
    },
    body: JSON.stringify({
      model: 'gen3a_turbo',
      promptImage: input.image_urls[0],
      promptText,
      duration: Math.min(input.duration_seconds, 10),
      ratio: '768:1344', // vertical for Reels/TikTok
      watermark: false,
    }),
  })

  if (!initRes.ok) {
    const errText = await initRes.text()
    throw new Error(`Runway init failed: ${initRes.status} ${errText}`)
  }

  const task = await initRes.json() as { id: string }
  const taskId = task.id

  await updateProject(projectId, { runway_task_id: taskId })

  // Poll until done (max 3 minutes, every 5 seconds)
  const maxAttempts = 36 // 36 * 5s = 180s
  let videoUrl = ''

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 5000))

    const statusRes = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${runwayKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    })

    const statusData = await statusRes.json() as {
      status: string
      output?: string[]
      failure?: string
    }

    if (statusData.status === 'SUCCEEDED') {
      videoUrl = statusData.output?.[0] ?? ''
      break
    }

    if (statusData.status === 'FAILED') {
      throw new Error(statusData.failure ?? 'Runway video generation failed')
    }
    // Still running — continue polling
  }

  if (!videoUrl) {
    throw new Error('Tiempo de espera agotado al generar el video')
  }

  // Download the video from Runway's temporary URL and upload to our storage
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    throw new Error('No se pudo descargar el video de Runway')
  }

  const videoBuffer = Buffer.from(await videoRes.arrayBuffer())
  const storagePath = `${businessId}/video/${projectId}.mp4`

  const { error: uploadError } = await admin.storage
    .from('videos')
    .upload(storagePath, videoBuffer, { contentType: 'video/mp4', upsert: true })

  if (uploadError) {
    throw new Error(`Error subiendo video: ${uploadError.message}`)
  }

  const { data: { publicUrl: storedVideoUrl } } = admin.storage
    .from('videos')
    .getPublicUrl(storagePath)

  return storedVideoUrl
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function generateVideo(
  projectId: string,
  businessId: string,
  input: VideoInput
): Promise<void> {
  const admin = createAdminClient()

  try {
    // Step 1 — Script
    const script = await generateScript(projectId, input)

    // Step 2 — Voiceover
    await generateVoiceover(projectId, businessId, script.voiceover_script)

    // Step 3 — Video
    const videoUrl = await generateRunwayVideo(projectId, businessId, input, script)

    // Step 4 — Complete
    await updateProject(projectId, {
      status: 'completed',
      video_url: videoUrl,
    })

    // Add to content library
    await admin
      .from('content_library')
      .insert({
        business_id: businessId,
        type: 'video',
        file_url: videoUrl,
        title: input.title,
      })
      .throwOnError()
      .then(() => {}) // fire-and-forget — don't fail the whole flow

    // Notification
    await createNotification({
      business_id: businessId,
      type: 'post_published',
      title: 'Tu video esta listo',
      message: `El video "${input.title}" se ha generado correctamente`,
      link: '/dashboard/video',
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[video-generator] error:', message)
    await updateProject(projectId, {
      status: 'failed',
      error_message: message,
    })
  }
}
