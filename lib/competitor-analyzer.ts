import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'

interface ApifyPost {
  caption?: string
  likesCount?: number
  commentsCount?: number
  timestamp?: string
  type?: string
  videoViewCount?: number
}

interface ApifyProfile {
  username?: string
  fullName?: string
  biography?: string
  followersCount?: number
  followsCount?: number
  postsCount?: number
  latestPosts?: ApifyPost[]
  topPosts?: ApifyPost[]
}

interface CompetitorMetrics {
  avg_likes: number
  avg_comments: number
  avg_engagement: number
  posting_frequency: number
  content_types: Record<string, number>
  top_posts: Array<{ caption: string; likesCount: number; commentsCount: number }>
}

function calculateMetrics(posts: ApifyPost[], followersCount: number): CompetitorMetrics {
  if (!posts.length) {
    return { avg_likes: 0, avg_comments: 0, avg_engagement: 0, posting_frequency: 0, content_types: {}, top_posts: [] }
  }

  const avg_likes = posts.reduce((s, p) => s + (p.likesCount ?? 0), 0) / posts.length
  const avg_comments = posts.reduce((s, p) => s + (p.commentsCount ?? 0), 0) / posts.length
  const avg_engagement = followersCount > 0 ? ((avg_likes + avg_comments) / followersCount) * 100 : 0

  // Posting frequency: posts per week from timestamps
  let posting_frequency = 0
  const timestamped = posts.filter(p => p.timestamp).map(p => new Date(p.timestamp!).getTime())
  if (timestamped.length >= 2) {
    const oldest = Math.min(...timestamped)
    const newest = Math.max(...timestamped)
    const weeks = (newest - oldest) / (1000 * 60 * 60 * 24 * 7)
    posting_frequency = weeks > 0 ? Math.round((posts.length / weeks) * 10) / 10 : posts.length
  } else {
    posting_frequency = posts.length
  }

  // Content type distribution
  const content_types: Record<string, number> = {}
  for (const p of posts) {
    const t = p.type ?? 'imagen'
    content_types[t] = (content_types[t] ?? 0) + 1
  }

  // Top 3 posts by engagement
  const sorted = [...posts].sort((a, b) =>
    ((b.likesCount ?? 0) + (b.commentsCount ?? 0)) - ((a.likesCount ?? 0) + (a.commentsCount ?? 0))
  ).slice(0, 3)

  const top_posts = sorted.map(p => ({
    caption: p.caption ?? '',
    likesCount: p.likesCount ?? 0,
    commentsCount: p.commentsCount ?? 0,
  }))

  return { avg_likes, avg_comments, avg_engagement, posting_frequency, content_types, top_posts }
}

export async function analyzeCompetitor(
  reportId: string,
  businessId: string,
  handle: string
): Promise<void> {
  const admin = createAdminClient()

  try {
    // ── STEP 1: Scraping with Apify ─────────────────────────────────────────

    const apifyResponse = await fetch(
      'https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.APIFY_API_TOKEN}`,
        },
        body: JSON.stringify({
          usernames: [handle],
          resultsLimit: 30,
        }),
        signal: AbortSignal.timeout(120_000),
      }
    )

    if (!apifyResponse.ok) {
      throw new Error(`Apify error: ${apifyResponse.status}`)
    }

    const apifyData: ApifyProfile[] = await apifyResponse.json()

    if (!apifyData || apifyData.length === 0) {
      throw new Error('Perfil no encontrado o privado')
    }

    const profileData = apifyData[0]

    if (!profileData.username) {
      throw new Error('Perfil no encontrado o privado')
    }

    const posts: ApifyPost[] = [
      ...(profileData.latestPosts ?? []),
      ...(profileData.topPosts ?? []),
    ]

    // Deduplicate by caption+timestamp
    const seen = new Set<string>()
    const uniquePosts = posts.filter(p => {
      const key = `${p.caption ?? ''}_${p.timestamp ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    if (uniquePosts.length === 0) {
      throw new Error('Perfil no encontrado o privado')
    }

    // ── STEP 2: Calculate metrics ────────────────────────────────────────────

    const metrics = calculateMetrics(uniquePosts, profileData.followersCount ?? 0)

    // Partial update with raw data
    await admin
      .from('competitor_reports')
      .update({
        competitor_name: profileData.fullName ?? profileData.username,
        competitor_followers: profileData.followersCount ?? 0,
        competitor_posts_analyzed: uniquePosts.length,
        raw_data: {
          avg_engagement: Math.round(metrics.avg_engagement * 100) / 100,
          avg_likes: Math.round(metrics.avg_likes),
          avg_comments: Math.round(metrics.avg_comments),
          posting_frequency: metrics.posting_frequency,
          content_types: metrics.content_types,
          top_posts: metrics.top_posts,
          biography: profileData.biography ?? '',
          followersCount: profileData.followersCount ?? 0,
          followsCount: profileData.followsCount ?? 0,
          postsCount: profileData.postsCount ?? 0,
        },
      })
      .eq('id', reportId)

    // ── STEP 3: GPT-4o analysis ──────────────────────────────────────────────

    // Get business data
    const { data: business } = await admin
      .from('businesses')
      .select('name, business_type_id')
      .eq('id', businessId)
      .single()

    const { data: businessType } = business?.business_type_id
      ? await admin
          .from('business_types')
          .select('name')
          .eq('id', business.business_type_id)
          .single()
      : { data: null }

    const { data: knowledge } = await admin
      .from('business_knowledge')
      .select('extracted_text')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(2)

    const knowledgeContext = knowledge?.map(k => k.extracted_text).join('\n').slice(0, 600) ?? ''

    const contentTypesStr = Object.entries(metrics.content_types)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')

    const topPostsStr = metrics.top_posts
      .map(p => `- ${p.likesCount} likes: '${p.caption.substring(0, 100)}'`)
      .join('\n')

    const userPrompt = `Analiza este competidor en Instagram y genera un informe estrategico.

NEGOCIO PROPIO:
Nombre: ${business?.name ?? 'Mi negocio'}
Tipo: ${businessType?.name ?? 'negocio'}
Contexto: ${knowledgeContext || 'Sin informacion adicional.'}

COMPETIDOR: @${handle}
Seguidores: ${profileData.followersCount ?? 0}
Posts analizados: ${uniquePosts.length}
Engagement medio: ${Math.round(metrics.avg_engagement * 100) / 100}%
Frecuencia de publicacion: ${metrics.posting_frequency} posts/semana
Tipos de contenido: ${contentTypesStr}
Biografia: ${profileData.biography ?? ''}

Posts mas destacados:
${topPostsStr}

Genera un informe en JSON con esta estructura exacta:
{
  "summary": "resumen ejecutivo en 2-3 frases de quien es este competidor",
  "strengths": ["punto fuerte 1", "punto fuerte 2", "punto fuerte 3"],
  "weaknesses": ["punto debil 1", "punto debil 2"],
  "opportunities": [
    {
      "title": "titulo de la oportunidad",
      "description": "como puede tu negocio aprovechar esta oportunidad concreta",
      "action": "accion especifica a tomar esta semana"
    }
  ],
  "content_strategy": "recomendacion sobre que tipo de contenido publicar para diferenciarse",
  "posting_recommendation": "con que frecuencia y en que horario publicar",
  "key_differentiators": ["como diferenciarte punto 1", "como diferenciarte punto 2"]
}`

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        max_tokens: 1500,
        temperature: 0.6,
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en estrategia de marketing digital y analisis competitivo.',
          },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!openaiRes.ok) {
      throw new Error(`OpenAI error: ${openaiRes.status}`)
    }

    const openaiData = await openaiRes.json()
    const parsed = JSON.parse(openaiData.choices[0].message.content)

    // ── STEP 4: Save results ─────────────────────────────────────────────────

    const keyFindings = [
      ...(parsed.strengths ?? []).map((s: string) => ({ type: 'strength', text: s })),
      ...(parsed.weaknesses ?? []).map((w: string) => ({ type: 'weakness', text: w })),
    ]

    await admin
      .from('competitor_reports')
      .update({
        status: 'completed',
        competitor_name: profileData.fullName ?? profileData.username,
        competitor_followers: profileData.followersCount ?? 0,
        competitor_posts_analyzed: uniquePosts.length,
        report_text: parsed.summary ?? '',
        key_findings: keyFindings,
        opportunities: parsed.opportunities ?? [],
        raw_data: {
          avg_engagement: Math.round(metrics.avg_engagement * 100) / 100,
          avg_likes: Math.round(metrics.avg_likes),
          avg_comments: Math.round(metrics.avg_comments),
          posting_frequency: metrics.posting_frequency,
          content_types: metrics.content_types,
          top_posts: metrics.top_posts,
          biography: profileData.biography ?? '',
          followersCount: profileData.followersCount ?? 0,
          content_strategy: parsed.content_strategy ?? '',
          posting_recommendation: parsed.posting_recommendation ?? '',
          key_differentiators: parsed.key_differentiators ?? [],
        },
      })
      .eq('id', reportId)

    // Get business owner for notification
    const { data: biz } = await admin
      .from('businesses')
      .select('owner_id')
      .eq('id', businessId)
      .single()

    if (biz?.owner_id) {
      await createNotification({
        business_id: businessId,
        type: 'post_published', // reuse generic positive type
        title: 'Analisis de competencia completado',
        message: `Analisis de @${handle} completado`,
        link: '/dashboard/competitors',
      })
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[competitor-analyzer] error:', errorMessage)

    await admin
      .from('competitor_reports')
      .update({
        status: 'failed',
        error_message: errorMessage,
      })
      .eq('id', reportId)
  }
}
