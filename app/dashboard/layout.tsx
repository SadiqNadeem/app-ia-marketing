import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/DashboardShell'
import { PostsProvider } from '@/components/providers/PostsProvider'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  const { data: networksData } = await supabase
    .from('social_connections')
    .select('platform, platform_username')
    .eq('business_id', business.id)
    .eq('is_active', true)

  const connectedNetworks = (networksData ?? []) as Array<{
    platform: string
    platform_username: string | null
  }>

  const userInitials = (user.email ?? 'U')
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

  return (
    <DashboardShell
      business={business}
      connectedNetworks={connectedNetworks}
      businessId={business.id}
      userInitials={userInitials}
      businessName={business.name}
    >
      <PostsProvider businessId={business.id}>
        {children}
      </PostsProvider>
    </DashboardShell>
  )
}
