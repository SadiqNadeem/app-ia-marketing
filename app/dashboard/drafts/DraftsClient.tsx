'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { usePosts } from '@/components/providers/PostsProvider'
import { PublishModal } from '@/app/dashboard/create/PublishModal'
import type { Post, SocialPlatform } from '@/types'

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google: 'Google',
  whatsapp: 'WhatsApp',
}

const PLATFORM_COLOR: Record<SocialPlatform, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#000000',
  google: '#4285F4',
  whatsapp: '#25D366',
}

type ToastState = { message: string; type: 'success' | 'error' } | null

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'Ahora mismo'
  if (mins < 60) return `Hace ${mins} min`
  if (hours < 24) return `Hace ${hours} h`
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} dias`
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

function getPreviewText(post: Post): string {
  return (post.content_text ?? post.content ?? '').trim()
}

function PlatformPill({ platform }: { platform: SocialPlatform }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 100,
        background: `${PLATFORM_COLOR[platform]}18`,
        color: PLATFORM_COLOR[platform],
        border: `1px solid ${PLATFORM_COLOR[platform]}30`,
      }}
    >
      {PLATFORM_LABEL[platform]}
    </span>
  )
}

function ImageThumbnail({ imageUrl, platform }: { imageUrl: string | null; platform: SocialPlatform | undefined }) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt="Imagen del borrador"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }
  const letter = platform ? PLATFORM_LABEL[platform]?.[0] ?? 'B' : 'B'
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #1A56DB 0%, #3B82F6 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: '-0.02em',
      }}
    >
      {letter}
    </div>
  )
}

interface DraftCardProps {
  draft: Post
  isPublishing: boolean
  toDelete: string | null
  onEdit: () => void
  onPublish: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

function DraftCard({
  draft,
  isPublishing,
  toDelete,
  onEdit,
  onPublish,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: DraftCardProps) {
  const [hov, setHov] = useState(false)
  const platforms = (draft.platforms ?? []).filter(
    (p): p is SocialPlatform => ['instagram', 'facebook', 'tiktok', 'google', 'whatsapp'].includes(p)
  )
  const mainPlatform = platforms[0]
  const preview = getPreviewText(draft)
  const isConfirming = toDelete === draft.id

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px',
        border: `1px solid ${hov ? '#BFDBFE' : '#E5E7EB'}`,
        borderRadius: 14,
        background: '#FFFFFF',
        transition: 'border-color 150ms, box-shadow 150ms',
        boxShadow: hov ? '0 2px 12px rgba(26,86,219,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 10,
          flexShrink: 0,
          overflow: 'hidden',
          background: '#F3F4F6',
        }}
      >
        <ImageThumbnail imageUrl={draft.image_url} platform={mainPlatform} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Platform + date row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {platforms.slice(0, 3).map((p) => <PlatformPill key={p} platform={p} />)}
          <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            {formatRelativeTime(draft.updated_at ?? draft.created_at)}
          </span>
        </div>

        {/* Text preview */}
        <p
          className="clamp-2"
          style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, margin: 0 }}
        >
          {preview || <em style={{ color: '#9CA3AF' }}>Sin texto</em>}
        </p>

        {/* CTA if present */}
        {draft.cta && (
          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
            CTA: <span style={{ fontWeight: 500 }}>{draft.cta}</span>
          </p>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <ActionButton onClick={onEdit} variant="primary">
            Editar
          </ActionButton>

          <ActionButton onClick={onPublish} variant="success" disabled={isPublishing}>
            {isPublishing ? 'Publicando...' : 'Publicar'}
          </ActionButton>

          {isConfirming ? (
            <>
              <ActionButton onClick={onDeleteConfirm} variant="danger">
                Confirmar
              </ActionButton>
              <ActionButton onClick={onDeleteCancel} variant="ghost">
                Cancelar
              </ActionButton>
            </>
          ) : (
            <ActionButton onClick={onDeleteRequest} variant="ghost">
              Eliminar
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  variant,
  disabled,
  children,
}: {
  onClick: () => void
  variant: 'primary' | 'success' | 'danger' | 'ghost'
  disabled?: boolean
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)

  const styles: Record<string, { bg: string; bgHov: string; color: string; border: string }> = {
    primary: { bg: '#EEF3FE', bgHov: '#DBEAFE', color: '#1A56DB', border: '#BFDBFE' },
    success: { bg: '#ECFDF5', bgHov: '#D1FAE5', color: '#059669', border: '#A7F3D0' },
    danger:  { bg: '#FEF2F2', bgHov: '#FEE2E2', color: '#E02424', border: '#FECACA' },
    ghost:   { bg: '#F9FAFB', bgHov: '#F3F4F6', color: '#374151', border: '#E5E7EB' },
  }

  const s = styles[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '5px 12px',
        borderRadius: 8,
        border: `1px solid ${s.border}`,
        background: hov ? s.bgHov : s.bg,
        color: s.color,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 120ms',
      }}
    >
      {children}
    </button>
  )
}

function EmptyState() {
  const router = useRouter()
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '64px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background: '#EEF3FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#1A56DB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" stroke="#1A56DB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="16" y1="13" x2="8" y2="13" stroke="#1A56DB" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="16" y1="17" x2="8" y2="17" stroke="#1A56DB" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
          No tienes borradores
        </p>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0, maxWidth: 280 }}>
          Genera contenido con IA y guardalo como borrador para editarlo aqui.
        </p>
      </div>
      <button
        onClick={() => router.push('/dashboard/create')}
        style={{
          padding: '9px 20px',
          borderRadius: 10,
          border: 'none',
          background: '#1A56DB',
          color: '#FFFFFF',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Crear contenido
      </button>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '16px',
        border: '1px solid #E5E7EB',
        borderRadius: 14,
        background: '#FFFFFF',
      }}
    >
      <div style={{ width: 88, height: 88, borderRadius: 10, background: '#F3F4F6', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: 100, height: 18, borderRadius: 6, background: '#F3F4F6' }} />
        <div style={{ width: '100%', height: 13, borderRadius: 6, background: '#F3F4F6' }} />
        <div style={{ width: '70%', height: 13, borderRadius: 6, background: '#F3F4F6' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {[80, 72, 64].map((w, i) => (
            <div key={i} style={{ width: w, height: 28, borderRadius: 8, background: '#F3F4F6' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DraftsClient() {
  const router = useRouter()
  const { posts, loading, refreshPosts } = usePosts()
  const drafts = posts.filter((p) => p.status === 'draft')

  const [toast, setToast] = useState<ToastState>(null)
  const [toDelete, setToDelete] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishTarget, setPublishTarget] = useState<Post | null>(null)

  function pushToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 3200)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('posts').delete().eq('id', id)
    if (error) {
      pushToast('No se pudo eliminar el borrador.', 'error')
    } else {
      pushToast('Borrador eliminado.', 'success')
      await refreshPosts()
    }
    setToDelete(null)
  }

  async function handlePublishWithPlatforms(platforms: SocialPlatform[]) {
    if (!publishTarget) return
    setPublishing(true)

    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: publishTarget.id, platforms }),
      })

      const data = await res.json()
      if (!res.ok) {
        pushToast(data?.error ?? 'No se pudo publicar.', 'error')
        return
      }

      const results = (data?.results ?? {}) as Record<string, { success?: boolean; error?: string }>
      const failed = Object.entries(results).filter(([, v]) => !v?.success)
      if (failed.length > 0) {
        pushToast(`Error en: ${failed.map(([k]) => k).join(', ')}`, 'error')
      } else {
        pushToast('Publicado correctamente.', 'success')
        setPublishTarget(null)
        await refreshPosts()
      }
    } catch {
      pushToast('Error de conexion al publicar.', 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '0 0 4px', letterSpacing: '-0.03em' }}>
            Borradores
          </h1>
          {!loading && (
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
              {drafts.length === 0
                ? 'Sin borradores guardados'
                : `${drafts.length} borrador${drafts.length === 1 ? '' : 'es'} guardado${drafts.length === 1 ? '' : 's'}`}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push('/dashboard/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#1A56DB',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + Crear nuevo
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : drafts.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              isPublishing={publishing && publishTarget?.id === draft.id}
              toDelete={toDelete}
              onEdit={() => router.push(`/dashboard/create?id=${draft.id}`)}
              onPublish={() => setPublishTarget(draft)}
              onDeleteRequest={() => setToDelete(draft.id)}
              onDeleteConfirm={() => handleDelete(draft.id)}
              onDeleteCancel={() => setToDelete(null)}
            />
          ))}
        </div>
      )}

      {/* Publish platform modal */}
      <PublishModal
        open={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        businessId={publishTarget?.business_id ?? ''}
        postContent={(publishTarget?.content_text ?? publishTarget?.content ?? '').trim()}
        postImageUrl={publishTarget?.image_url ?? null}
        initialPlatforms={(publishTarget?.platforms ?? []) as SocialPlatform[]}
        publishing={publishing}
        onPublish={handlePublishWithPlatforms}
      />

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 80,
            borderRadius: 10,
            padding: '10px 16px',
            color: '#FFFFFF',
            background: toast.type === 'success' ? '#059669' : '#DC2626',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
