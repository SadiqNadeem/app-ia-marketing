import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business, error: bizError } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  // Only redirect to onboarding if the business genuinely doesn't exist (PGRST116 = no rows)
  if (!business && bizError?.code === 'PGRST116') redirect('/onboarding')
  if (!business) redirect('/dashboard')

  const isAdmin = user.email === process.env.ADMIN_EMAIL

  return (
    <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-8 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Configuracion"
        subtitle="Actualiza los datos de tu negocio"
      />
      <SettingsClient business={business} userEmail={user.email ?? ''} isAdmin={isAdmin} />
    </div>
  )
}
