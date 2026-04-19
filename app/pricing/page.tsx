import { createClient } from '@/lib/supabase/server'
import { PricingClient } from './PricingClient'
import type { PlanType } from '@/types'

interface PricingPageProps {
  searchParams: Promise<{ reason?: string }>
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  const { reason } = await searchParams

  // Try to get current user — page is public so we don't redirect on failure
  let currentPlan: PlanType | null = null
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: business } = await supabase
        .from('businesses')
        .select('plan')
        .eq('owner_id', user.id)
        .single()

      if (business) {
        currentPlan = business.plan as PlanType
      }
    }
  } catch {
    // Not authenticated or no business — show generic pricing
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] py-16 px-4">
      <div className="max-w-[900px] mx-auto flex flex-col gap-10">
        {/* Header */}
        <div className="text-center flex flex-col gap-3">
          <h1 className="text-[32px] font-semibold text-[#111827]">
            Planes y precios
          </h1>
          <p className="text-lg text-[#374151]">
            Elige el plan que mejor se adapta a tu negocio
          </p>
        </div>

        {/* Plans */}
        <PricingClient
          currentPlan={currentPlan}
          limitReached={reason === 'limit'}
        />
      </div>
    </div>
  )
}

