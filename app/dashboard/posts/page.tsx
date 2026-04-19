import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { PostsClient } from './PostsClient'
import type { Post } from '@/types'

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

  const { data: posts } = await supabase
    .from('posts')
    .select('*')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto w-full">
      <PageHeader
        title="Publicaciones"
        subtitle="Historial de todo el contenido creado"
      />
      <PostsClient posts={(posts ?? []) as Post[]} businessId={business.id} />
    </div>
  )
}
