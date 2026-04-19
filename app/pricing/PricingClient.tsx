'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PLANS } from '@/lib/stripe'
import type { PlanKey } from '@/lib/stripe'
import type { PlanType } from '@/types'

interface PricingClientProps {
  currentPlan: PlanType | null  // null = not authenticated
  limitReached: boolean
}

const PLAN_ORDER: PlanKey[] = ['basic', 'pro', 'business', 'agency']

const PLAN_RANK: Record<PlanKey, number> = {
  basic: 0,
  pro: 1,
  business: 2,
  agency: 3,
}

export function PricingClient({ currentPlan, limitReached }: PricingClientProps) {
  const [loading, setLoading] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade(plan: PlanKey) {
    setLoading(plan)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Error al iniciar el pago')
        return
      }
      window.location.href = data.url
    } catch {
      setError('Error de conexion. Intentalo de nuevo.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Limit-reached banner */}
      {limitReached && (
        <div className="flex justify-center">
          <Badge variant="error" className="py-3 px-5 rounded-xl text-sm">
            Has alcanzado el limite de tu plan actual. Mejora para continuar.
          </Badge>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex justify-center">
          <Badge variant="error" className="py-2 px-4 rounded-lg text-sm">
            {error}
          </Badge>
        </div>
      )}

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key]
          const isPro = key === 'pro'
          const isCurrentPlan = currentPlan === key
          const isUpgrade =
            currentPlan !== null &&
            PLAN_RANK[key] > PLAN_RANK[currentPlan as PlanKey]

          return (
            <Card
              key={key}
              padding="md"
              className={[
                'flex flex-col gap-5 relative',
                isPro ? 'border-2 border-[#2563EB]' : '',
              ].join(' ')}
            >
              {/* Popular badge */}
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="info" className="px-3 py-1 text-xs">
                    Mas popular
                  </Badge>
                </div>
              )}

              {/* Plan name */}
              <h3 className="text-xl font-semibold text-[#111827]">{plan.name}</h3>

              {/* Price */}
              <div className="flex items-baseline gap-1">
                <span className="text-[36px] font-bold text-[#111827] leading-none">
                  {plan.price}
                </span>
                <span className="text-base text-[#374151]">€/mes</span>
              </div>

              {/* Features */}
              <ul className="flex flex-col gap-2 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-sm text-[#374151]">
                    - {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="mt-auto pt-2">
                {isCurrentPlan ? (
                  <Badge variant="success" className="w-full justify-center py-2 rounded-lg text-sm">
                    Tu plan actual
                  </Badge>
                ) : currentPlan !== null && isUpgrade ? (
                  <Button
                    className="w-full"
                    loading={loading === key}
                    onClick={() => handleUpgrade(key)}
                  >
                    Mejorar a {plan.name}
                  </Button>
                ) : currentPlan === null ? (
                  <Link href="/register">
                    <Button className="w-full">Empezar</Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

