import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { PostsClient } from './PostsClient'

export default async function PostsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Publicaciones"
        subtitle="Historial de todo el contenido creado"
      />
      <PostsClient businessId={business.id} />
    </div>
  )
}
