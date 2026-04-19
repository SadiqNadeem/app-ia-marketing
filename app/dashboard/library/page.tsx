import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { LibraryClient } from './LibraryClient'
import type { ContentLibraryItem } from '@/types'

export default async function LibraryPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const { data: items } = await supabase
    .from('content_library')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6 p-8 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Biblioteca"
        subtitle="Todo el contenido que has guardado"
      />
      <LibraryClient
        initialItems={(items ?? []) as ContentLibraryItem[]}
        businessId={business.id}
      />
    </div>
  )
}
