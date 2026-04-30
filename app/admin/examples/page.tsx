import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminExamplesClient } from './AdminExamplesClient'

export default async function AdminExamplesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.email !== process.env.ADMIN_EMAIL) redirect('/dashboard')

  const { data: examples } = await supabase
    .from('ai_examples')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  return <AdminExamplesClient initialExamples={examples ?? []} />
}
