import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ParsedPayload {
  messages: Message[]
  businessId: string
  imageFile: File | null
  audioFile: File | null
}

async function parsePayload(request: NextRequest): Promise<ParsedPayload> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const businessId = String(form.get('business_id') ?? '')
    const rawMessages = String(form.get('messages') ?? '[]')

    let messages: Message[] = []
    try {
      const parsed = JSON.parse(rawMessages) as Message[]
      if (Array.isArray(parsed)) {
        messages = parsed
      }
    } catch {
      messages = []
    }

    const imageRaw = form.get('image')
    const audioRaw = form.get('audio')
    const imageFile = imageRaw instanceof File && imageRaw.size > 0 ? imageRaw : null
    const audioFile = audioRaw instanceof File && audioRaw.size > 0 ? audioRaw : null

    return { messages, businessId, imageFile, audioFile }
  }

  const json = await request.json() as { messages?: Message[]; business_id?: string }
  return {
    messages: Array.isArray(json.messages) ? json.messages : [],
    businessId: json.business_id ?? '',
    imageFile: null,
    audioFile: null,
  }
}

function ensureUserMessage(messages: Message[]): Message[] {
  if (messages.length === 0) return [{ role: 'user', content: 'Hola' }]
  return messages
}

export async function POST(request: NextRequest): Promise<Response> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  let payload: ParsedPayload
  try {
    payload = await parsePayload(request)
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud invalido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  const { messages, businessId, imageFile, audioFile } = payload
  if (!businessId) {
    return new Response(JSON.stringify({ error: 'Falta business_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('name, category, plan')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return new Response(JSON.stringify({ error: 'Negocio no encontrado o sin permiso' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const [postsResult, connectionsResult, knowledgeResult] = await Promise.all([
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', firstOfMonth),
    supabase
      .from('social_connections')
      .select('platform')
      .eq('business_id', businessId)
      .eq('is_active', true),
    supabase
      .from('business_knowledge')
      .select('title, extracted_text, type')
      .eq('business_id', businessId)
      .not('type', 'eq', 'instagram_analysis')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const postCount = postsResult.count ?? 0
  const platforms =
    connectionsResult.data?.map((c: { platform: string }) => c.platform) ?? []

  // Build knowledge context for system prompt
  type KnowledgeRow = { title: string; extracted_text: string; type: string }
  const knowledgeRows: KnowledgeRow[] = (knowledgeResult.data ?? []) as KnowledgeRow[]
  const imageEntries = knowledgeRows.filter(k => k.type === 'image')
  const videoEntries = knowledgeRows.filter(k => k.type === 'video')
  const otherEntries = knowledgeRows.filter(k => k.type !== 'image' && k.type !== 'video')

  const knowledgeSections: string[] = []
  if (otherEntries.length > 0) {
    const lines = otherEntries.slice(0, 10).map(k => `- [${k.title}]: ${k.extracted_text.slice(0, 300)}`).join('\n')
    knowledgeSections.push(`Informacion del negocio:\n${lines}`)
  }
  if (imageEntries.length > 0) {
    const lines = imageEntries.map(k => `- ${k.title}: ${k.extracted_text.slice(0, 200)}`).join('\n')
    knowledgeSections.push(`Imagenes del negocio analizadas por IA:\n${lines}`)
  }
  if (videoEntries.length > 0) {
    const lines = videoEntries.map(k => `- ${k.title}: ${k.extracted_text.slice(0, 200)}`).join('\n')
    knowledgeSections.push(`Videos del negocio:\n${lines}`)
  }
  const knowledgeContext = knowledgeSections.length > 0
    ? `\n\n${knowledgeSections.join('\n\n')}`
    : ''

  let audioTranscript = ''
  if (audioFile) {
    try {
      const transcript = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'es',
      })
      audioTranscript = transcript.text?.trim() ?? ''
    } catch (err) {
      console.error('[chat] transcription error:', err)
    }
  }

  let imageDataUrl: string | null = null
  if (imageFile) {
    try {
      const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
      const mime = imageFile.type || 'image/jpeg'
      imageDataUrl = `data:${mime};base64,${imageBuffer.toString('base64')}`
    } catch (err) {
      console.error('[chat] image parse error:', err)
    }
  }

  const safeMessages = ensureUserMessage(messages)
  const messageForModel: ChatCompletionMessageParam[] =
    safeMessages.map((m) => ({ role: m.role, content: m.content }))

  const lastUserIndex = [...messageForModel].map((m) => m.role).lastIndexOf('user')
  if (lastUserIndex >= 0) {
    const baseText = String(messageForModel[lastUserIndex].content ?? '')
    const textParts: string[] = [baseText]

    if (audioTranscript) {
      textParts.push(`Transcripcion de audio del usuario: ${audioTranscript}`)
    }
    if (imageDataUrl) {
      textParts.push('El usuario adjunto una imagen. Analizala y responde en base a ella.')
    }

    const mergedText = textParts.filter(Boolean).join('\n\n')

    if (imageDataUrl) {
      messageForModel[lastUserIndex] = {
        role: 'user',
        content: [
          { type: 'text', text: mergedText || 'Analiza la imagen adjunta' },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      }
    } else {
      messageForModel[lastUserIndex] = {
        role: 'user',
        content: mergedText || baseText || 'Mensaje del usuario',
      }
    }
  }

  const systemPrompt = `Eres el asistente de marketing de ${business.name}, un negocio de tipo ${business.category}.
Responde siempre en espanol, de forma concreta y accionable.
Nunca uses emojis.

Contexto:
- Plan: ${business.plan}
- Redes conectadas: ${platforms.length > 0 ? platforms.join(', ') : 'ninguna'}
- Posts creados este mes: ${postCount}${knowledgeContext}

Si llega audio transcrito o imagen, usalos como contexto principal de la respuesta.`

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: systemPrompt }, ...messageForModel],
      stream: true,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[chat] OpenAI error:', err)
    return new Response(JSON.stringify({ error: 'Error al generar la respuesta. Intentalo de nuevo.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }
}
