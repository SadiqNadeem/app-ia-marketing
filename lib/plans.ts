import type { PlanType } from '@/types'

// ─── DEV MODE: all limits disabled ───────────────────────────────────────────
// Re-enable plan checks before going to production.

const PLAN_LIMITS: Record<PlanType, { posts_per_month: number; social_connections: number }> = {
  basic:    { posts_per_month: 5,  social_connections: 1  },
  pro:      { posts_per_month: -1, social_connections: 3  },
  business: { posts_per_month: -1, social_connections: -1 },
  agency:   { posts_per_month: -1, social_connections: -1 },
}

export function getPlanLimits(_businessId: string) {
  return Promise.resolve(PLAN_LIMITS['agency'])
}

export async function checkCanPublish(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanTranslate(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanSendWhatsApp(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanGenerateVideo(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanGenerateAds(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanCloneVoice(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanAnalyzeCompetitors(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}

export async function checkCanConnectSocial(
  _businessId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true }
}
