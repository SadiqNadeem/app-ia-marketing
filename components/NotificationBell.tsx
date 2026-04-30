'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  business_id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

interface NotificationBellProps {
  businessId: string
  compact?: boolean
}

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

export function NotificationBell({ businessId, compact = false }: NotificationBellProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications/list?business_id=${businessId}`)
      const data = await res.json()
      if (data.notifications) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // silent
    } finally {
      setLoaded(true)
    }
  }, [businessId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Supabase Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
          setUnreadCount((prev) => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: businessId, notification_id: id }),
    }).catch(() => {})
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
    await fetch('/api/notifications/read', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: businessId, mark_all: true }),
    }).catch(() => {})
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link as never)
  }

  const displayCount = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className={compact
          ? 'relative flex items-center justify-center w-full h-full'
          : 'relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#F4F5F7] transition-colors'
        }
        aria-label="Notificaciones"
      >
        {/* Bell SVG */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {/* Unread dot */}
        {loaded && unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: compact ? '2px' : '4px',
              right: compact ? '2px' : '4px',
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: '#E02424',
              border: '1.5px solid #fff',
            }}
          />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'absolute',
            top: '44px',
            right: 0,
            width: '360px',
            maxHeight: '480px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '1px solid #E5E7EB',
            zIndex: 50,
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '1px solid #E5E7EB',
              position: 'sticky',
              top: 0,
              backgroundColor: '#ffffff',
              zIndex: 1,
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>
              Notificaciones
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontSize: '12px', color: '#2563EB' }}
                  className="hover:underline"
                >
                  Marcar todas como leidas
                </button>
              )}
              <button
                onClick={() => { setOpen(false); router.push('/dashboard/notifications') }}
                style={{ fontSize: '12px', color: '#374151' }}
                className="hover:underline"
              >
                Ver todas
              </button>
            </div>
          </div>

          {/* Notification list */}
          {notifications.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#374151' }}>No tienes notificaciones</p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 16px',
                    backgroundColor: n.read ? '#ffffff' : '#EFF6FF',
                    borderBottom: '1px solid #F3F4F6',
                    cursor: n.link ? 'pointer' : 'default',
                    transition: 'background-color 0.1s',
                  }}
                  className="hover:brightness-95"
                >
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                    {n.title}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#374151', lineHeight: '1.4' }}>
                    {n.message}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#4B5563' }}>
                    {relativeTime(n.created_at)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


