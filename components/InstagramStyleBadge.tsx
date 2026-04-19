'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  businessId: string
}

type BadgeState = 'loading' | 'active' | 'analyzing' | 'none'

export function InstagramStyleBadge({ businessId }: Props) {
  const [badgeState, setBadgeState] = useState<BadgeState>('loading')

  useEffect(() => {
    const supabase = createClient()

    async function check() {
      // Check if Instagram is connected
      const { data: conn } = await supabase
        .from('social_connections')
        .select('id')
        .eq('business_id', businessId)
        .eq('platform', 'instagram')
        .eq('is_active', true)
        .maybeSingle()

      if (!conn) {
        setBadgeState('none')
        return
      }

      // Check if analysis exists
      const { data: analysis } = await supabase
        .from('business_knowledge')
        .select('id')
        .eq('business_id', businessId)
        .eq('type', 'instagram_analysis')
        .maybeSingle()

      setBadgeState(analysis ? 'active' : 'analyzing')
    }

    check()
  }, [businessId])

  if (badgeState === 'loading' || badgeState === 'none') return null

  if (badgeState === 'analyzing') {
    return (
      <div
        title="La IA esta aprendiendo tu estilo de Instagram"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
        style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
      >
        <div className="w-2 h-2 rounded-full bg-[#D97706] animate-pulse" />
        Analizando estilo...
      </div>
    )
  }

  return (
    <div
      title="La IA conoce tu estilo de Instagram"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium cursor-default"
      style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
    >
      <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
      Estilo IA activo
    </div>
  )
}
