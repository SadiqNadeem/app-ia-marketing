'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

type FilterType = 'all' | 'post_published' | 'post_failed' | 'coupon_redeemed' | 'review_new' | 'review_negative' | 'trend_available' | 'token_expiring'

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'post_published', label: 'Publicaciones' },
  { key: 'post_failed', label: 'Errores' },
  { key: 'coupon_redeemed', label: 'Cupones' },
  { key: 'review_new', label: 'Resenas' },
  { key: 'trend_available', label: 'Ideas' },
  { key: 'token_expiring', label: 'Sistema' },
]

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  if (days === 1) return 'ayer'
  return `hace ${days} dias`
}

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState<FilterType>('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  // Get businessId from the list endpoint (it verifies ownership)
  const fetchNotifications = useCallback(async (bid: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notifications/list?business_id=${bid}`)
      const data = await res.json()
      if (data.notifications) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch business_id from the existing API (use /api/business/context or similar)
  useEffect(() => {
    fetch('/api/business/context')
      .then((r) => r.json())
      .then((d) => {
        if (d.business?.id) {
          setBusinessId(d.business.id)
          fetchNotifications(d.business.id)
        }
      })
      .catch(() => setLoading(false))
  }, [fetchNotifications])

  async function markAllRead() {
    if (!businessId) return
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: businessId, mark_all: true }),
    }).catch(() => {})
  }

  async function handleClick(n: Notification) {
    if (!businessId || n.read) {
      if (n.link) router.push(n.link as never)
      return
    }
    setNotifications((prev) =>
      prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: businessId, notification_id: n.id }),
    }).catch(() => {})
    if (n.link) router.push(n.link as never)
  }

  const filtered = notifications.filter((n) => {
    if (filter === 'all') return true
    if (filter === 'review_new') return n.type === 'review_new' || n.type === 'review_negative'
    if (filter === 'token_expiring') return n.type === 'token_expiring'
    return n.type === filter
  })

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div className="flex flex-col gap-6 p-8 max-w-3xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Notificaciones"
          subtitle="Historial de alertas de tu negocio"
        />
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="shrink-0 text-sm border border-[#E5E7EB] text-[#374151] rounded-lg px-4 py-2 hover:bg-[#F7F8FA] transition-colors"
          >
            Marcar todas como leidas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilter(key); setPage(0) }}
            className={[
              'text-sm px-3 py-1.5 rounded-lg transition-colors',
              filter === key
                ? 'bg-[#2563EB] text-white font-medium'
                : 'text-[#374151] hover:bg-[#F7F8FA]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-[#374151] py-8 text-center">Cargando...</p>
      ) : paginated.length === 0 ? (
        <p className="text-sm text-[#374151] py-8 text-center">No hay notificaciones en esta categoria.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {paginated.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              style={{ backgroundColor: n.read ? '#ffffff' : '#EFF6FF' }}
              className={[
                'text-left w-full rounded-lg border border-[#E5E7EB] px-4 py-3 transition-colors',
                n.link ? 'cursor-pointer hover:border-[#2563EB]' : 'cursor-default',
              ].join(' ')}
            >
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0 }}>
                {n.title}
              </p>
              <p style={{ fontSize: '12px', color: '#374151', margin: '2px 0 0', lineHeight: '1.5' }}>
                {n.message}
              </p>
              <p style={{ fontSize: '11px', color: '#4B5563', margin: '4px 0 0' }}>
                {relativeTime(n.created_at)}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-sm px-3 py-1.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F7F8FA] disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-[#374151]">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-sm px-3 py-1.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F7F8FA] disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

