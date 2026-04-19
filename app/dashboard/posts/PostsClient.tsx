'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PostScheduler } from '@/components/PostScheduler'
import type { Post, PostStatus, SocialPlatform } from '@/types'

type Tab = 'all' | PostStatus

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'published', label: 'Publicados' },
  { key: 'scheduled', label: 'Programados' },
  { key: 'draft', label: 'Borradores' },
  { key: 'failed', label: 'Fallidos' },
]

const STATUS_BADGE: Record<PostStatus, { variant: 'success' | 'info' | 'neutral' | 'error'; label: string }> = {
  published: { variant: 'success', label: 'Publicado' },
  scheduled: { variant: 'info', label: 'Programado' },
  draft: { variant: 'neutral', label: 'Borrador' },
  failed: { variant: 'error', label: 'Fallido' },
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google',
  whatsapp: 'WhatsApp',
}

interface PostsClientProps {
  posts: Post[]
  businessId: string
}

function formatDate(post: Post): string {
  const raw =
    post.status === 'published'
      ? post.published_at
      : post.status === 'scheduled'
      ? post.scheduled_at
      : post.created_at

  if (!raw) return '—'
  return new Date(raw).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function PostsClient({ posts, businessId }: PostsClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [schedulerPostId, setSchedulerPostId] = useState<string | null>(null)
  const [errorModalPost, setErrorModalPost] = useState<Post | null>(null)

  const filtered =
    activeTab === 'all' ? posts : posts.filter((p) => p.status === activeTab)

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-brand-border">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'px-3 py-2 text-sm font-medium transition-colors duration-150',
              activeTab === key
                ? 'text-brand-primary border-b-2 border-brand-primary -mb-px'
                : 'text-brand-text-secondary hover:text-brand-text-primary',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-brand-text-secondary">
          No hay publicaciones en esta categoria
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-brand-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border bg-brand-bg">
                <th className="text-left px-4 py-3 font-medium text-brand-text-secondary">Contenido</th>
                <th className="text-left px-4 py-3 font-medium text-brand-text-secondary">Plataformas</th>
                <th className="text-left px-4 py-3 font-medium text-brand-text-secondary">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-brand-text-secondary">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-brand-text-secondary">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filtered.map((post) => {
                const { variant, label } = STATUS_BADGE[post.status as PostStatus]
                const preview = (post.content_text ?? '').slice(0, 60) +
                  ((post.content_text ?? '').length > 60 ? '...' : '')
                const platforms = (post.platforms ?? []) as SocialPlatform[]

                return (
                  <tr key={post.id} className="hover:bg-brand-bg transition-colors">
                    <td className="px-4 py-3 text-brand-text-primary max-w-[240px]">
                      <span className="line-clamp-2">{preview || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {platforms.map((p) => (
                          <span
                            key={p}
                            className="text-xs px-2 py-0.5 rounded-full bg-brand-bg border border-brand-border text-brand-text-secondary"
                          >
                            {PLATFORM_LABELS[p] ?? p}
                          </span>
                        ))}
                        {platforms.length === 0 && (
                          <span className="text-brand-text-secondary">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={variant}>{label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-brand-text-secondary whitespace-nowrap">
                      {formatDate(post)}
                    </td>
                    <td className="px-4 py-3">
                      {post.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSchedulerPostId(post.id)}
                        >
                          Publicar
                        </Button>
                      )}
                      {post.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setErrorModalPost(post)}
                        >
                          Ver error
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline scheduler drawer */}
      {schedulerPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md">
            <PostScheduler
              postId={schedulerPostId}
              businessId={businessId}
              onPublished={() => setSchedulerPostId(null)}
              onScheduled={() => setSchedulerPostId(null)}
            />
            <button
              onClick={() => setSchedulerPostId(null)}
              className="mt-3 w-full text-sm text-brand-text-secondary hover:text-brand-text-primary transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Error detail modal */}
      {errorModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md bg-brand-surface rounded-xl border border-brand-border p-6 flex flex-col gap-4 shadow-sm">
            <p className="text-base font-semibold text-brand-text-primary">Detalle del error</p>
            <p className="text-sm text-brand-error break-words">
              {errorModalPost.error_message ?? 'Sin informacion de error disponible'}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setErrorModalPost(null)}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
