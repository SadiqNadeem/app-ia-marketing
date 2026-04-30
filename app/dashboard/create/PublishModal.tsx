'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog } from '@/components/ui/Dialog'
import type { SocialPlatform } from '@/types'

const ALL_PLATFORMS: SocialPlatform[] = ['instagram', 'facebook', 'tiktok', 'google', 'whatsapp']

const PLATFORM_META: Record<SocialPlatform, { label: string; color: string }> = {
  instagram: { label: 'Instagram',       color: '#E1306C' },
  facebook:  { label: 'Facebook',        color: '#1877F2' },
  tiktok:    { label: 'TikTok',          color: '#111827' },
  google:    { label: 'Google Business', color: '#4285F4' },
  whatsapp:  { label: 'WhatsApp',        color: '#25D366' },
}

function PlatformIcon({ platform, size = 28 }: { platform: SocialPlatform; size?: number }) {
  if (platform === 'instagram') return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <defs>
        <radialGradient id="ig-pm" cx="30%" cy="107%" r="150%">
          <stop offset="0%"  stopColor="#fdf497" />
          <stop offset="5%"  stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-pm)" />
      <rect x="6" y="6" width="12" height="12" rx="4" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="white" strokeWidth="1.5" />
      <circle cx="16.5" cy="7.5" r="1" fill="white" />
    </svg>
  )
  if (platform === 'facebook') return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <path d="M13.5 8.5h2V6h-2C11.6 6 10 7.6 10 9.5V11H8v2.5h2V20h2.5v-6.5H15l.5-2.5h-3V9.5c0-.6.4-1 1-1z" fill="white" />
    </svg>
  )
  if (platform === 'tiktok') return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect width="24" height="24" rx="6" fill="#111827" />
      <path d="M15.6 5.6c.4 1.1 1.2 2 2.4 2.3v2.1c-.8 0-1.6-.2-2.4-.7v5c0 2.4-2 4.4-4.4 4.4s-4.4-2-4.4-4.4 2-4.4 4.4-4.4c.2 0 .4 0 .6.1v2.2c-.2-.1-.4-.1-.6-.1-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2V5.6h2.2z" fill="white" />
    </svg>
  )
  if (platform === 'google') return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect width="24" height="24" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="1" />
      <path d="M12 10.4h6c.1.5.2 1 .2 1.6 0 3.5-2.4 6-6.2 6-3.5 0-6.3-2.8-6.3-6.3s2.8-6.3 6.3-6.3c1.7 0 3.1.6 4.2 1.6l-1.7 1.7c-.7-.6-1.5-1-2.5-1-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8c1.9 0 3.2-1.1 3.5-2.6H12v-2.3z" fill="#4285F4" />
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect width="24" height="24" rx="6" fill="#25D366" />
      <path d="M12 4.5A7.5 7.5 0 0 0 5.3 16l-1 3.5 3.6-1A7.5 7.5 0 1 0 12 4.5zm3.3 9c-.2-.1-1-.5-1.2-.5-.2-.1-.3-.1-.4.1s-.5.6-.6.8c-.1.1-.2.1-.4 0-.2-.1-.8-.3-1.5-1-.6-.5-1-1.1-1.1-1.3 0-.2 0-.3.1-.4l.3-.3.2-.3v-.3l-.7-1.6c-.1-.3-.3-.3-.4-.3h-.4c-.1 0-.3 0-.5.2-.2.2-.7.7-.7 1.6s.7 1.9.8 2c.1.1 1.4 2.2 3.5 3 .5.2.9.3 1.2.4.5.1 1 .1 1.3.1.4-.1 1.2-.5 1.4-1s.2-.9.1-1c0-.1-.2-.2-.4-.3z" fill="white" />
    </svg>
  )
}

interface Connection {
  platform: SocialPlatform
  platform_username: string | null
  has_verified_location: boolean | null
}

export interface PublishModalProps {
  open: boolean
  onClose: () => void
  businessId: string
  postContent?: string
  postImageUrl?: string | null
  initialPlatforms?: SocialPlatform[]
  publishing: boolean
  onPublish: (platforms: SocialPlatform[]) => void
}

export function PublishModal({
  open,
  onClose,
  businessId,
  postContent,
  postImageUrl,
  initialPlatforms = [],
  publishing,
  onPublish,
}: PublishModalProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loadingConns, setLoadingConns] = useState(true)
  const [selected, setSelected] = useState<SocialPlatform[]>([])
  const [googleExcluded, setGoogleExcluded] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadingConns(true)
    const supabase = createClient()
    supabase
      .from('social_connections')
      .select('platform, platform_username, has_verified_location')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .then(({ data }) => {
        const raw = (data ?? []) as Connection[]
        // Exclude Google if not verified
        const googleConn = raw.find((c) => c.platform === 'google')
        const isGoogleUnverified = googleConn !== undefined && googleConn.has_verified_location === false
        setGoogleExcluded(isGoogleUnverified)
        const conns = isGoogleUnverified ? raw.filter((c) => c.platform !== 'google') : raw
        setConnections(conns)
        const connectedSet = new Set(conns.map((c) => c.platform))
        const pre = initialPlatforms.filter((p) => connectedSet.has(p))
        setSelected(pre.length > 0 ? pre : Array.from(connectedSet).slice(0, 1))
        setLoadingConns(false)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId])

  const connectedSet = new Set(connections.map((c) => c.platform))
  const instagramSelected = selected.includes('instagram')
  const needsImageWarning = instagramSelected && !postImageUrl

  function toggle(p: SocialPlatform) {
    setSelected((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const canPublish = selected.length > 0 && !needsImageWarning && !publishing

  const previewText = (postContent ?? '').trim()

  return (
    <Dialog open={open} onClose={onClose} title="Publicar post">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Post preview strip */}
        {previewText && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 10,
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
            }}
          >
            {postImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={postImageUrl}
                alt=""
                style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              />
            )}
            <p
              style={{
                fontSize: 12,
                color: '#374151',
                lineHeight: 1.5,
                margin: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {previewText}
            </p>
          </div>
        )}

        {/* Platform list */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Selecciona las plataformas
          </p>

          {loadingConns ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ height: 52, borderRadius: 10, background: '#F3F4F6' }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALL_PLATFORMS.map((platform) => {
                const isConnected = connectedSet.has(platform)
                const isSelected = selected.includes(platform)
                const conn = connections.find((c) => c.platform === platform)
                const meta = PLATFORM_META[platform]

                return (
                  <PlatformRow
                    key={platform}
                    platform={platform}
                    label={meta.label}
                    color={meta.color}
                    username={conn?.platform_username ?? null}
                    isConnected={isConnected}
                    isSelected={isSelected}
                    onToggle={() => isConnected && toggle(platform)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Warnings */}
        {needsImageWarning && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              fontSize: 12,
              color: '#92400E',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span style={{ flexShrink: 0, fontSize: 14 }}>⚠</span>
            Instagram requiere imagen. Genera o sube una imagen antes de publicar.
          </div>
        )}

        {googleExcluded && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#FFFBEB',
              border: '1px solid #FCD34D',
              fontSize: 12,
              color: '#92400E',
            }}
          >
            Tu ficha de Google Business no esta verificada. Se excluira de esta publicacion.
          </div>
        )}

        {!loadingConns && connections.length === 0 && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              fontSize: 12,
              color: '#1E3A8A',
            }}
          >
            No tienes redes sociales conectadas.{' '}
            <a
              href="/dashboard/connections"
              style={{ fontWeight: 600, color: '#1A56DB', textDecoration: 'underline' }}
            >
              Conectar ahora
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
          <CancelBtn onClick={onClose} disabled={publishing} />
          <PublishBtn
            onClick={() => onPublish(selected)}
            disabled={!canPublish}
            publishing={publishing}
            count={selected.length}
          />
        </div>
      </div>
    </Dialog>
  )
}

/* ── Sub-components ── */

function PlatformRow({
  platform,
  label,
  color,
  username,
  isConnected,
  isSelected,
  onToggle,
}: {
  platform: SocialPlatform
  label: string
  color: string
  username: string | null
  isConnected: boolean
  isSelected: boolean
  onToggle: () => void
}) {
  const [hov, setHov] = useState(false)

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 10,
        border: `1.5px solid ${isSelected && isConnected ? color + '60' : '#E5E7EB'}`,
        background: isSelected && isConnected
          ? color + '0D'
          : hov && isConnected
          ? '#F9FAFB'
          : '#FFFFFF',
        cursor: isConnected ? 'pointer' : 'default',
        transition: 'all 120ms',
        opacity: isConnected ? 1 : 0.5,
        userSelect: 'none',
      }}
    >
      {/* Checkbox */}
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: 5,
          border: `1.5px solid ${isSelected && isConnected ? color : '#D1D5DB'}`,
          background: isSelected && isConnected ? color : '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 120ms',
        }}
      >
        {isSelected && isConnected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Platform icon */}
      <PlatformIcon platform={platform} size={26} />

      {/* Name + username */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{label}</p>
        {isConnected && username && (
          <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>{username}</p>
        )}
        {!isConnected && (
          <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>No conectado</p>
        )}
      </div>

      {/* Status badge or connect link */}
      {isConnected ? (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 500,
            color: '#059669',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            padding: '2px 8px',
            borderRadius: 100,
            flexShrink: 0,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669' }} />
          Conectado
        </span>
      ) : (
        <a
          href="/dashboard/connections"
          onClick={(e) => e.stopPropagation()}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#1A56DB',
            textDecoration: 'none',
            background: '#EEF3FE',
            border: '1px solid #BFDBFE',
            padding: '3px 10px',
            borderRadius: 100,
            flexShrink: 0,
          }}
        >
          Conectar
        </a>
      )}
    </div>
  )
}

function CancelBtn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 18px',
        borderRadius: 9,
        border: '1px solid #E5E7EB',
        background: hov ? '#F3F4F6' : '#F9FAFB',
        color: '#374151',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'background 120ms',
      }}
    >
      Cancelar
    </button>
  )
}

function PublishBtn({
  onClick,
  disabled,
  publishing,
  count,
}: {
  onClick: () => void
  disabled: boolean
  publishing: boolean
  count: number
}) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '9px 20px',
        borderRadius: 9,
        border: 'none',
        background: disabled ? '#F3F4F6' : hov ? '#1648C0' : '#1A56DB',
        color: disabled ? '#9CA3AF' : '#FFFFFF',
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'background 120ms',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(26,86,219,0.25)',
      }}
    >
      {publishing ? (
        <>
          <span
            style={{
              width: 13,
              height: 13,
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.6s linear infinite',
            }}
          />
          Publicando...
        </>
      ) : (
        <>
          Publicar
          {count > 0 && (
            <span
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 100,
                padding: '1px 7px',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {count}
            </span>
          )}
        </>
      )}
    </button>
  )
}
