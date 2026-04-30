'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PostScheduler } from '@/components/PostScheduler'
import { usePosts } from '@/components/providers/PostsProvider'
import { createClient } from '@/lib/supabase/client'
import { Trash2, X } from 'lucide-react'
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
  published:  { variant: 'success', label: 'Publicado'  },
  publishing: { variant: 'info',    label: 'Publicando' },
  scheduled:  { variant: 'info',    label: 'Programado' },
  draft:      { variant: 'neutral', label: 'Borrador'   },
  failed:     { variant: 'error',   label: 'Fallido'    },
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  tiktok:    'TikTok',
  google:    'Google',
  whatsapp:  'WhatsApp',
}

interface PostsClientProps {
  businessId: string
}

function formatDate(post: Post): string {
  const raw =
    post.status === 'published'
      ? post.published_at
      : post.status === 'scheduled'
      ? post.scheduled_at
      : post.created_at
  if (!raw) return '-'
  return new Date(raw).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}

function getPostPreview(post: Post): string {
  const text = (post.content_text ?? post.content ?? '').trim()
  if (text.length === 0) return '-'
  return text.slice(0, 60) + (text.length > 60 ? '...' : '')
}

export function PostsClient({ businessId }: PostsClientProps) {
  const { posts, loading, error, refreshPosts } = usePosts()
  const supabase = createClient()

  const [activeTab, setActiveTab]           = useState<Tab>('all')
  const [schedulerPostId, setSchedulerPostId] = useState<string | null>(null)
  const [errorModalPost, setErrorModalPost]   = useState<Post | null>(null)
  const [deleteTarget, setDeleteTarget]       = useState<Post | null>(null)
  const [deleting, setDeleting]               = useState(false)
  const [deleteError, setDeleteError]         = useState('')

  const filtered = activeTab === 'all' ? posts : posts.filter((p) => p.status === activeTab)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const { error: dbError } = await supabase
      .from('posts')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('business_id', businessId)

    if (dbError) {
      setDeleteError(dbError.message)
      setDeleting(false)
      return
    }
    setDeleting(false)
    setDeleteTarget(null)
    void refreshPosts()
  }

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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Error al cargar posts: {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-brand-text-secondary">Cargando publicaciones...</div>
      ) : filtered.length === 0 ? (
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
                <th className="hidden md:table-cell text-left px-4 py-3 font-medium text-brand-text-secondary">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-brand-text-secondary">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filtered.map((post) => {
                const { variant, label } = STATUS_BADGE[post.status] ?? STATUS_BADGE.draft
                const preview   = getPostPreview(post)
                const platforms = post.platforms ?? []

                return (
                  <tr key={post.id} className="hover:bg-brand-bg transition-colors">
                    {/* Content preview + image thumbnail */}
                    <td className="px-4 py-3 text-brand-text-primary max-w-[240px]">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {(post.image_url ?? post.media_url) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={post.image_url ?? post.media_url ?? ''}
                            alt=""
                            style={{
                              width: 40, height: 40, borderRadius: 6,
                              objectFit: 'cover', flexShrink: 0,
                              border: '1px solid #E5E7EB',
                            }}
                          />
                        )}
                        <span className="line-clamp-2">{preview}</span>
                      </div>
                    </td>

                    {/* Platforms */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {platforms.map((platformName) => (
                          <span
                            key={platformName}
                            className="text-xs px-2 py-0.5 rounded-full bg-brand-bg border border-brand-border text-brand-text-secondary"
                          >
                            {PLATFORM_LABELS[platformName as SocialPlatform] ?? platformName}
                          </span>
                        ))}
                        {platforms.length === 0 && <span className="text-brand-text-secondary">-</span>}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={variant}>{label}</Badge>
                    </td>

                    {/* Date — hidden on mobile */}
                    <td className="hidden md:table-cell px-4 py-3 text-brand-text-secondary whitespace-nowrap">
                      {formatDate(post)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {post.status === 'draft' && (
                          <Button size="sm" variant="secondary" onClick={() => setSchedulerPostId(post.id)}>
                            Publicar
                          </Button>
                        )}
                        {post.status === 'failed' && (
                          <Button size="sm" variant="secondary" onClick={() => setErrorModalPost(post)}>
                            Ver error
                          </Button>
                        )}
                        <button
                          onClick={() => { setDeleteTarget(post); setDeleteError('') }}
                          title="Eliminar publicacion"
                          style={{
                            width: 30, height: 30, borderRadius: 6,
                            border: '1px solid #FECACA', background: '#FFF5F5',
                            color: '#DC2626', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#FEE2E2' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF5F5' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Scheduler modal */}
      {schedulerPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md">
            <PostScheduler
              postId={schedulerPostId}
              businessId={businessId}
              onPublished={() => { setSchedulerPostId(null); void refreshPosts() }}
              onScheduled={() =>  { setSchedulerPostId(null); void refreshPosts() }}
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
            <Button variant="secondary" size="sm" onClick={() => setErrorModalPost(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#FFFFFF', borderRadius: 14, padding: '28px 28px 24px',
              maxWidth: 420, width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Eliminar publicacion
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
                  Esta accion no se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview */}
            <div
              style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: '#374151', lineHeight: 1.5,
              }}
            >
              {getPostPreview(deleteTarget) || '(sin texto)'}
            </div>

            {deleteError && (
              <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{deleteError}</p>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => !deleting && setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: '1px solid #E5E7EB', background: '#FFFFFF',
                  fontSize: 13, fontWeight: 500, color: '#374151',
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  border: 'none', background: '#DC2626',
                  fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
