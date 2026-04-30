'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Post, PostStatus, SocialPlatform } from '@/types'

// ── Status config ──────────────────────────────────────────────────
const STATUS: Record<PostStatus, { bar: string; bg: string; color: string; label: string }> = {
  published: { bar: '#10B981', bg: '#D1FAE5', color: '#065F46', label: 'Publicado'  },
  publishing:{ bar: '#3B82F6', bg: '#DBEAFE', color: '#1E40AF', label: 'Publicando' },
  scheduled: { bar: '#F59E0B', bg: '#FEF3C7', color: '#92400E', label: 'Programado' },
  draft:     { bar: '#D1D5DB', bg: '#F3F4F6', color: '#374151', label: 'Borrador'   },
  failed:    { bar: '#EF4444', bg: '#FEE2E2', color: '#991B1B', label: 'Fallido'    },
}

const PLATFORM_LABEL: Partial<Record<SocialPlatform, string>> = {
  instagram: 'Instagram',
  facebook:  'Facebook',
  tiktok:    'TikTok',
}

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']

type Filter = PostStatus | 'all'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (h < 1) return 'hace unos minutos'
  if (h < 24) return `hace ${h}h`
  if (d === 1) return 'ayer'
  return `hace ${d}d`
}

function formatScheduled(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ── Empty state for posts ─────────────────────────────────────────
function EmptyQueue({ filter }: { filter: Filter }) {
  const msg = filter === 'all'
    ? 'Aun no has publicado nada'
    : filter === 'scheduled'
    ? 'No tienes publicaciones programadas'
    : filter === 'publishing'
    ? 'No hay publicaciones en proceso de publicacion'
    : filter === 'published'
    ? 'No hay publicaciones publicadas'
    : filter === 'failed'
    ? 'No hay publicaciones fallidas'
    : 'No hay borradores'

  return (
    <div style={{ padding: '36px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Minimal line icon */}
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="8" width="28" height="22" rx="3" />
        <line x1="4" y1="14" x2="32" y2="14" />
        <line x1="11" y1="4" x2="11" y2="12" />
        <line x1="25" y1="4" x2="25" y2="12" />
        <line x1="10" y1="20" x2="20" y2="20" />
        <line x1="10" y1="25" x2="16" y2="25" />
      </svg>
      <p style={{ fontSize: 13, color: '#374151', margin: 0, fontWeight: 500 }}>{msg}</p>
      {filter === 'all' && (
        <Link
          href="/dashboard/create"
          style={{
            display: 'inline-block',
            background: '#1A1A1A',
            color: '#fff',
            borderRadius: 8,
            padding: '9px 20px',
            fontSize: 12,
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '-0.1px',
          }}
        >
          Crear primera publicacion
        </Link>
      )}
    </div>
  )
}

interface Props { posts: Post[] }

export function DashboardMainContent({ posts }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  // ── Week days ─────────────────────────────────────────────────
  const today   = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const dow     = today.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday  = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  // Posts keyed by date
  const postsByDate: Record<string, Post[]> = {}
  for (const post of posts) {
    const raw = post.scheduled_at ?? post.published_at ?? post.created_at
    const key = new Date(raw).toISOString().slice(0, 10)
    if (!postsByDate[key]) postsByDate[key] = []
    postsByDate[key].push(post)
  }

  // Counts
  const counts = {
    published: posts.filter(p => p.status === 'published').length,
    publishing: posts.filter(p => p.status === 'publishing').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    draft:     posts.filter(p => p.status === 'draft').length,
    failed:    posts.filter(p => p.status === 'failed').length,
  }
  const visible = (filter === 'all' ? posts : posts.filter(p => p.status === filter)).slice(0, 10)

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',       label: 'Todas'       },
    { key: 'published', label: 'Publicadas',  count: counts.published  },
    { key: 'publishing',label: 'Publicando',  count: counts.publishing },
    { key: 'scheduled', label: 'Programadas', count: counts.scheduled  },
    { key: 'draft',     label: 'Borradores',  count: counts.draft      },
    { key: 'failed',    label: 'Fallidas',    count: counts.failed     },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Week calendar ─────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 12px',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9E9688', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Esta semana
          </span>
          <Link href="/dashboard/calendar" style={{ fontSize: 11, fontWeight: 600, color: '#1A56DB', textDecoration: 'none' }}>
            Ver calendario
          </Link>
        </div>

        {/* Day columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderTop: '1px solid #F4F1EC' }}>
          {weekDays.map((day, i) => {
            const key       = day.toISOString().slice(0, 10)
            const dayPosts  = postsByDate[key] ?? []
            const isToday   = key === todayKey
            const isFuture  = key > todayKey
            const isPast    = key < todayKey

            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '12px 4px 14px',
                  borderRight: i < 6 ? '1px solid #F4F1EC' : 'none',
                  background: isToday ? '#FAFAFA' : 'transparent',
                  position: 'relative',
                }}
              >
                {/* Day name */}
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: isToday ? '#1A1A1A' : '#C4BDB5',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 7,
                }}>
                  {DAY_NAMES[i]}
                </span>

                {/* Day number — filled circle for today */}
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isToday ? '#1A1A1A' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: isToday ? 700 : isPast ? 400 : 500,
                    color: isToday ? '#fff' : isPast ? '#C4BDB5' : '#1A1A1A',
                    lineHeight: 1,
                  }}>
                    {day.getDate()}
                  </span>
                </div>

                {/* Status dots or empty indicator */}
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', minHeight: 7 }}>
                  {dayPosts.length === 0 ? (
                    <span style={{
                      width: 5, height: 5, borderRadius: 1,
                      background: isFuture ? '#E8E3DC' : 'transparent',
                      display: 'inline-block',
                    }} />
                  ) : (
                    dayPosts.slice(0, 3).map((p, j) => (
                      <span key={j} style={{
                        width: 5, height: 5, borderRadius: 1,
                        background: STATUS[p.status].bar,
                        display: 'inline-block',
                      }} />
                    ))
                  )}
                </div>

                {/* Post count pill */}
                {dayPosts.length > 0 && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: isToday ? '#1A56DB' : '#9E9688',
                    marginTop: 5,
                  }}>
                    {dayPosts.length}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Post queue ─────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #F4F1EC',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9E9688', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Publicaciones
          </span>

          {/* Inline tab strip — Uber style */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {FILTERS.map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  fontSize: 12,
                  fontWeight: filter === key ? 700 : 500,
                  color: filter === key ? '#1A1A1A' : '#9E9688',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  borderBottom: filter === key ? '2px solid #1A1A1A' : '2px solid transparent',
                  transition: 'all 120ms',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: filter === key ? '#1A1A1A' : '#F4F1EC',
                    color: filter === key ? '#fff' : '#9E9688',
                    borderRadius: 99,
                    padding: '1px 5px',
                    lineHeight: 1.4,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ padding: '0 20px' }}>
          {visible.length === 0 ? (
            <EmptyQueue filter={filter} />
          ) : (
            <>
              {visible.map((post, i) => {
                const cfg      = STATUS[post.status]
                const platform = post.platforms?.[0] ?? 'instagram'
                const date     = post.scheduled_at
                  ? formatScheduled(post.scheduled_at)
                  : timeAgo(post.created_at)

                return (
                  <div
                    key={post.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '13px 0',
                      borderBottom: i < visible.length - 1 ? '1px solid #F4F1EC' : 'none',
                    }}
                  >
                    {/* Status bar */}
                    <div style={{
                      width: 3, height: 36,
                      borderRadius: 2,
                      background: cfg.bar,
                      flexShrink: 0,
                    }} />

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="clamp-2" style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: 0, lineHeight: 1.4 }}>
                        {post.content_text || '(Sin texto)'}
                      </p>
                      <p style={{ fontSize: 11, color: '#9E9688', margin: '3px 0 0' }}>
                        {PLATFORM_LABEL[platform] ?? platform} &middot; {date}
                      </p>
                    </div>

                    {/* Badge */}
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: cfg.color, background: cfg.bg,
                      borderRadius: 5, padding: '3px 8px',
                      whiteSpace: 'nowrap', flexShrink: 0,
                      letterSpacing: '0.02em',
                    }}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}

              {posts.length > 10 && (
                <div style={{ padding: '12px 0', textAlign: 'center' }}>
                  <Link href="/dashboard/posts" style={{ fontSize: 12, color: '#1A56DB', fontWeight: 600, textDecoration: 'none' }}>
                    Ver todas las publicaciones ({posts.length})
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

