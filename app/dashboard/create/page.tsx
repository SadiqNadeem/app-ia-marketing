import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CreatePageClient } from './CreatePageClient'
import type { PromotionType } from '@/types'

interface CreatePageProps {
  searchParams: Promise<{ promotion_type?: string }>
}

export default async function CreatePage({ searchParams }: CreatePageProps) {
  const { promotion_type } = await searchParams

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div style={{ height: '100%' }}>
      <CreatePageClient
        business={business}
        initialPromotionType={promotion_type as PromotionType | undefined}
      />
    </div>
  )
}
