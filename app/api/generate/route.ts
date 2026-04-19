import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserData {
  name: string
  type: string
  tone: string
}

interface RequestBody {
  prompt:   string
  userData: UserData
}

interface GenerateResult {
  text: string
}

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(userData: UserData): string {
  return `Eres un experto en marketing digital para negocios locales.

Negocio: ${userData.name}
Tipo de negocio: ${userData.type}
Tono de comunicación: ${userData.tone}

Reglas:
- Genera contenido real y específico para este negocio, nada genérico
- Respeta siempre el tono indicado
- Incluye una llamada a la acción (CTA) clara
- Sin explicaciones ni texto introductorio — solo el contenido final`
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de la solicitud inválido' },
      { status: 400 }
    )
  }

  const { prompt, userData } = body

  // ── 2. Validate ────────────────────────────────────────────────────────────
  if (!prompt?.trim()) {
    return NextResponse.json(
      { error: 'El campo "prompt" es requerido' },
      { status: 400 }
    )
  }

  if (!userData?.name?.trim() || !userData?.type?.trim() || !userData?.tone?.trim()) {
    return NextResponse.json(
      { error: 'userData debe incluir: name, type, tone' },
      { status: 400 }
    )
  }

  // ── 3. Call OpenAI ─────────────────────────────────────────────────────────
  try {
    const completion = await openai.chat.completions.create({
      model:       'gpt-4o-mini',
      max_tokens:  600,
      temperature: 0.8,
      messages: [
        { role: 'system', content: buildSystemPrompt(userData) },
        { role: 'user',   content: prompt.trim() },
      ],
    })

    const text = completion.choices[0]?.message?.content?.trim()

    if (!text) {
      return NextResponse.json(
        { error: 'La IA no devolvió contenido. Inténtalo de nuevo.' },
        { status: 502 }
      )
    }

    const result: GenerateResult = { text }
    return NextResponse.json(result)

  } catch (err: unknown) {
    if (err instanceof Error && 'status' in err) {
      const status = (err as { status: number }).status

      if (status === 429) {
        return NextResponse.json(
          { error: 'Límite de solicitudes alcanzado. Espera unos segundos.' },
          { status: 429 }
        )
      }
      if (status === 401) {
        return NextResponse.json(
          { error: 'API key de OpenAI inválida o no configurada.' },
          { status: 500 }
        )
      }
    }

    console.error('[api/generate] Error:', err)
    return NextResponse.json(
      { error: 'Error al generar contenido. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}
