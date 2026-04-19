import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { openai } from '@/lib/openai'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface RequestBody {
  messages: Message[]
  business_id: string
}

const INTERVIEW_COMPLETE_MARKER = '[ENTREVISTA_COMPLETADA]'

export async function POST(request: NextRequest): Promise<Response> {
  // ── 1. Auth check ──────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'No autenticado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  // ── 2. Parse body ──────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Cuerpo de la solicitud invalido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  const { messages, business_id } = body
  if (!messages || !business_id) {
    return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  // ── 3. Fetch business data ─────────────────────────────────────
  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('name, category')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (bizError || !business) {
    return new Response(JSON.stringify({ error: 'Negocio no encontrado o sin permiso' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    })
  }

  // ── 4. Get existing knowledge titles ──────────────────────────
  const { data: existingDocs } = await supabase
    .from('business_knowledge')
    .select('title, type')
    .eq('business_id', business_id)
    .order('created_at', { ascending: false })

  const docSummary = existingDocs && existingDocs.length > 0
    ? existingDocs.map((d) => `"${d.title}" (${d.type})`).join(', ')
    : 'ninguno todavia'

  // ── 5. Build system prompt ─────────────────────────────────────
  const systemPrompt = `Eres un consultor de marketing experto que esta haciendo una entrevista estructurada al dueno de ${business.name}, un negocio de tipo ${business.category}.
Tu objetivo es extraer toda la informacion relevante sobre el negocio para que la IA pueda generar contenido de marketing mas preciso y personalizado.

Documentos que el negocio ya ha proporcionado: ${docSummary}

Haz UNA sola pregunta a la vez. Cuando el dueno responda, profundiza si la respuesta es vaga o pasa a la siguiente pregunta relevante.

Temas que debes cubrir (en orden de importancia, sin repetir lo que ya esta en los documentos):
1. Productos o servicios principales y sus precios
2. Que diferencia a este negocio de la competencia
3. Horarios de apertura y dias festivos
4. Publico objetivo (edad, perfil, zona geografica)
5. Tono de comunicacion que prefiere (formal, cercano, divertido, elegante)
6. Promociones o eventos recurrentes que hace el negocio
7. Historia del negocio o valores que quiere transmitir
8. Canales de venta (local, delivery, online, telefono)

Cuando sientas que tienes suficiente informacion sobre todos los temas, termina la entrevista con este mensaje exacto seguido del resumen:
${INTERVIEW_COMPLETE_MARKER}
A continuacion escribe un resumen completo de toda la informacion recopilada en formato de texto claro y estructurado, listo para ser guardado.

Reglas:
- Haz solo UNA pregunta por mensaje
- Se conversacional y amable, no parece un formulario
- Responde siempre en espanol
- Sin emojis`

  // ── 6. Stream from OpenAI ──────────────────────────────────────
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    stream: true,
    max_tokens: 1200,
    temperature: 0.7,
  })

  // ── 7. Stream and detect completion ───────────────────────────
  const readableStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let fullResponse = ''

      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) {
            fullResponse += text
            controller.enqueue(encoder.encode(text))
          }
        }
      } finally {
        // Detect if interview is complete and save summary
        if (fullResponse.includes(INTERVIEW_COMPLETE_MARKER)) {
          const summaryStart = fullResponse.indexOf(INTERVIEW_COMPLETE_MARKER) + INTERVIEW_COMPLETE_MARKER.length
          const summary = fullResponse.slice(summaryStart).trim()

          if (summary) {
            const now = new Date()
            const dateStr = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

            await supabase.from('business_knowledge').insert({
              business_id,
              type: 'interview',
              title: `Entrevista de conocimiento - ${dateStr}`,
              extracted_text: summary,
            })
          }
        }

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
}
