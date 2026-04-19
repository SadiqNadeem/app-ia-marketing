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

  const { data: business } = await supabase
    .from('businesses')
    .select('*, elevenlabs_voice_id, voice_name, voice_sample_url, voice_status')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl mx-auto w-full">
      <PageHeader
        title="Configuracion"
        subtitle="Actualiza los datos de tu negocio"
      />
      <SettingsClient business={business} userEmail={user.email ?? ''} />
    </div>
  )
}
