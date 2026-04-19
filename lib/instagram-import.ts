import { getValidToken } from '@/lib/tokens'
import { createAdminClient } from '@/lib/supabase/admin'
import { openai } from '@/lib/openai'

const GRAPH = 'https://graph.facebook.com/v19.0'

interface IgMediaItem {
  id: string
  caption?: string
  media_type: string
  timestamp: string
  like_count?: number
  comments_count?: number
  media_url?: string
}

interface IgMediaResponse {
  data: IgMediaItem[]
}

export interface ImportResult {
  success: boolean
  posts_analyzed: number
  analysis_preview: string
  error?: string
  posts?: Array<{ caption: string; like_count: number }>
}

/**
 * Imports the last 30 Instagram posts for a business and runs GPT-4o analysis.
 * Saves the result in business_knowledge with type='instagram_analysis'.
 */
export async function runInstagramImport(businessId: string): Promise<ImportResult> {
  const admin = createAdminClient()

  // 1. Get valid Instagram token
  const token = await getValidToken(businessId, 'instagram')
  if (!token) {
    return { success: false, posts_analyzed: 0, analysis_preview: '', error: 'no_instagram_connected' }
  }

  // 2. Get ig_user_id from social_connections
  const { data: conn } = await admin
    .from('social_connections')
    .select('platform_user_id')
    .eq('business_id', businessId)
    .eq('platform', 'instagram')
    .eq('is_active', true)
    .single()

  if (!conn?.platform_user_id) {
    return { success: false, posts_analyzed: 0, analysis_preview: '', error: 'no_instagram_connected' }
  }

  // 3. Get business name and category for the prompt
  const { data: business } = await admin
    .from('businesses')
    .select('name, category')
    .eq('id', businessId)
    .single()

  const businessName = business?.name ?? 'este negocio'
  const businessCategory = business?.category ?? 'negocio'

  // 4. Fetch last 30 media posts from Instagram Graph API
  let mediaItems: IgMediaItem[] = []
  try {
    const url =
      `${GRAPH}/${conn.platform_user_id}/media?` +
      new URLSearchParams({
        fields: 'id,caption,media_type,timestamp,like_count,comments_count,media_url',
        limit: '30',
        access_token: token,
      })

    const res = await fetch(url)
    if (!res.ok) {
      const errData = await res.json()
      console.error('[instagram-import] media fetch error:', errData)
      return { success: false, posts_analyzed: 0, analysis_preview: '', error: 'api_error' }
    }
    const data = await res.json() as IgMediaResponse
    mediaItems = data.data ?? []
  } catch (err) {
    console.error('[instagram-import] fetch error:', err)
    return { success: false, posts_analyzed: 0, analysis_preview: '', error: 'api_error' }
  }

  // 5. Filter to IMAGE and CAROUSEL_ALBUM only
  const filtered = mediaItems.filter(
    p => p.media_type === 'IMAGE' || p.media_type === 'CAROUSEL_ALBUM'
  )

  if (filtered.length === 0) {
    return { success: false, posts_analyzed: 0, analysis_preview: '', error: 'no_posts' }
  }

  // 6. Build analysis context string
  let postsContext = filtered
    .map(p => {
      const likes = p.like_count ?? 0
      const comments = p.comments_count ?? 0
      return `Post (${likes} likes, ${comments} comentarios):\n"${p.caption?.trim() || 'Sin texto'}"`
    })
    .join('\n\n')

  if (postsContext.length > 6000) {
    postsContext = postsContext.slice(0, 6000)
  }

  // 7. Call GPT-4o for style analysis
  let analysisText = ''
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: 'Eres un experto en analisis de comunicacion y marketing digital.',
        },
        {
          role: 'user',
          content: `Analiza los siguientes posts de Instagram de ${businessName}, un negocio de tipo ${businessCategory}. Extrae un analisis detallado de su estilo de comunicacion.

Posts importados:
${postsContext}

Responde con un analisis estructurado que incluya:
1. Tono de comunicacion (formal/informal/cercano/profesional/divertido/etc)
2. Longitud tipica de los posts (corto/medio/largo)
3. Uso de hashtags (muchos/pocos/ninguno, tipos de hashtags que usan)
4. Llamadas a la accion mas frecuentes
5. Temas o categorias de contenido que mas publican
6. Que tipos de posts generan mas engagement segun los datos
7. Recomendaciones especificas para mantener la coherencia de marca

Responde en texto claro y estructurado, no en JSON.
Maximo 400 palabras. Sin emojis.`,
        },
      ],
    })

    analysisText = completion.choices[0]?.message?.content?.trim() ?? ''
  } catch (err) {
    console.error('[instagram-import] GPT error:', err)
    return { success: false, posts_analyzed: filtered.length, analysis_preview: '', error: 'gpt_error' }
  }

  // 8. Save/update in business_knowledge
  const { data: existing } = await admin
    .from('business_knowledge')
    .select('id')
    .eq('business_id', businessId)
    .eq('title', 'Analisis de estilo de Instagram')
    .single()

  if (existing?.id) {
    await admin
      .from('business_knowledge')
      .update({ extracted_text: analysisText })
      .eq('id', existing.id)
  } else {
    await admin.from('business_knowledge').insert({
      business_id: businessId,
      type: 'instagram_analysis',
      title: 'Analisis de estilo de Instagram',
      extracted_text: analysisText,
    })
  }

  const preview = analysisText.slice(0, 200)

  const previewPosts = filtered.slice(0, 5).map(p => ({
    caption: p.caption?.slice(0, 80) ?? 'Sin texto',
    like_count: p.like_count ?? 0,
  }))

  return {
    success: true,
    posts_analyzed: filtered.length,
    analysis_preview: preview,
    posts: previewPosts,
  }
}
