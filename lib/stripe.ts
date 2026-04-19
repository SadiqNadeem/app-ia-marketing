import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set in environment variables')
    _stripe = new Stripe(key, { apiVersion: '2024-06-20' })
  }
  return _stripe
}

/** @deprecated use getStripe() instead */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const PLANS = {
  basic: {
    name: 'Basico',
    price: 19,
    priceId: process.env.STRIPE_PRICE_BASIC!,
    features: [
      '5 publicaciones al mes',
      '1 red social conectada',
      'Generador de texto con IA',
      'Generador de imagenes con IA',
    ],
    limits: { posts_per_month: 5, social_connections: 1 },
  },
  pro: {
    name: 'Pro',
    price: 29,
    priceId: process.env.STRIPE_PRICE_PRO!,
    features: [
      'Publicaciones ilimitadas',
      '3 redes sociales conectadas',
      'Programador de publicaciones',
      'Biblioteca de contenido',
      'Generador de texto e imagenes con IA',
    ],
    limits: { posts_per_month: -1, social_connections: 3 },
  },
  business: {
    name: 'Business',
    price: 49,
    priceId: process.env.STRIPE_PRICE_BUSINESS!,
    features: [
      'Todo lo del plan Pro',
      'Redes sociales ilimitadas',
      'WhatsApp Business',
      'Analitica avanzada',
      'Gestion de clientes y puntos',
    ],
    limits: { posts_per_month: -1, social_connections: -1 },
  },
  agency: {
    name: 'Agencias',
    price: 99,
    priceId: process.env.STRIPE_PRICE_AGENCY!,
    features: [
      'Todo lo del plan Business',
      'Hasta 10 negocios distintos',
      'Panel multi-negocio',
      'Soporte prioritario',
    ],
    limits: { posts_per_month: -1, social_connections: -1 },
  },
} as const

export type PlanKey = keyof typeof PLANS

/** Reverse-lookup: priceId → plan key */
export function planFromPriceId(priceId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return key as PlanKey
  }
  return null
}
