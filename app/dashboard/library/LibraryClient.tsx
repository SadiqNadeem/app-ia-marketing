'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PostScheduler } from '@/components/PostScheduler'
import type { ContentLibraryItem, ContentItemType } from '@/types'

type TabFilter = 'all' | ContentItemType

const TABS: { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'flyer', label: 'Flyers' },
  { value: 'post', label: 'Posts' },
  { value: 'story', label: 'Stories' },
  { value: 'video', label: 'Videos' },
]

const TYPE_LABEL: Record<ContentItemType, string> = {
  flyer: 'Flyer',
  post: 'Post',
  story: 'Story',
  video: 'Video',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface LibraryClientProps {
  initialItems: ContentLibraryItem[]
  businessId: string
}

export function LibraryClient({ initialItems, businessId }: LibraryClientProps) {
  const [items, setItems] = useState<ContentLibraryItem[]>(initialItems)
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [publishingItem, setPublishingItem] = useState<ContentLibraryItem | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const filtered =
    activeTab === 'all' ? items : items.filter((i) => i.type === activeTab)

  async function handleDelete(item: ContentLibraryItem) {
    setDeletingId(item.id)
    try {
      const supabase = createClient()

      // Extract storage path from URL
      // URL format: .../storage/v1/object/public/content-library/{path}
      const urlParts = item.file_url.split('/storage/v1/object/public/content-library/')
      if (urlParts[1]) {
        await supabase.storage.from('content-library').remove([urlParts[1]])
      }
      if (item.thumbnail_url) {
        const thumbParts = item.thumbnail_url.split('/storage/v1/object/public/content-library/')
        if (thumbParts[1]) {
          await supabase.storage.from('content-library').remove([thumbParts[1]])
        }
      }

      const { error } = await supabase
        .from('content_library')
        .delete()
        .eq('id', item.id)

      if (!error) {
        setItems((prev) => prev.filter((i) => i.id !== item.id))
      }
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  if (items.length === 0) {
    return (
      <Card padding="lg" className="flex flex-col items-center gap-4 py-16">
        <p className="text-sm text-[#374151]">Aun no tienes contenido guardado</p>
        <Link href="/dashboard/create">
          <Button>Crear tu primer contenido</Button>
        </Link>
      </Card>
    )
  }

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={[
              'px-4 py-2 text-sm transition-colors duration-100 border-b-2 -mb-px',
              activeTab === value
                ? 'border-[#2563EB] text-[#2563EB] font-medium'
                : 'border-transparent text-[#374151] hover:text-[#111827]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card padding="md" className="py-12">
          <p className="text-sm text-[#374151] text-center">
            No hay contenido en esta categoria.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} padding="sm" className="flex flex-col gap-3">
              {/* Image */}
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[#F7F8FA]">
                <Image
                  src={item.thumbnail_url ?? item.file_url}
                  alt={TYPE_LABEL[item.type]}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between gap-2">
                <Badge variant="neutral">{TYPE_LABEL[item.type]}</Badge>
                <span className="text-xs text-[#374151]">{formatDate(item.created_at)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => setPublishingItem(item)}
                >
                  Publicar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="flex-1"
                  loading={deletingId === item.id}
                  onClick={() => setConfirmDeleteId(item.id)}
                >
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Publish modal */}
      <Dialog
        open={!!publishingItem}
        onClose={() => setPublishingItem(null)}
        title="Publicar contenido"
      >
        {publishingItem && (
          <PostScheduler
            postId={publishingItem.id}
            businessId={businessId}
            onPublished={() => setPublishingItem(null)}
            onScheduled={() => setPublishingItem(null)}
          />
        )}
      </Dialog>

      {/* Delete confirmation modal */}
      <Dialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        title="Confirmar eliminacion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[#374151]">
            Esta accion no se puede deshacer. El archivo sera eliminado permanentemente.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              loading={deletingId === confirmDeleteId}
              onClick={() => {
                const item = items.find((i) => i.id === confirmDeleteId)
                if (item) handleDelete(item)
              }}
            >
              Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

