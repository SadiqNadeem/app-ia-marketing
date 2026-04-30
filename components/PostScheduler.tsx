'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { UpgradeModal } from '@/components/UpgradeModal'
import type { SocialPlatform } from '@/types'

const ALL_PLATFORMS: { key: SocialPlatform; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'google', label: 'Google Business' },
]

interface ConnectionInfo {
  platform: SocialPlatform
  is_active: boolean
}

interface PostSchedulerProps {
  postId: string
  businessId: string
  onPublished: () => void
  onScheduled: () => void
}

type PublishMode = 'now' | 'later'

// ── Datetime min value: 10 minutes from now ────────────────────────
function getMinDatetime(): string {
  const d = new Date(Date.now() + 10 * 60 * 1000)
  // datetime-local requires "YYYY-MM-DDTHH:MM"
  return d.toISOString().slice(0, 16)
}

export function PostScheduler({
  postId,
  businessId,
  onPublished,
  onScheduled,
}: PostSchedulerProps) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([])
  const [mode, setMode] = useState<PublishMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)

  // Load connected platforms
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('social_connections')
        .select('platform, is_active')
        .eq('business_id', businessId)
      setConnections((data ?? []) as ConnectionInfo[])
    }
    load()
  }, [businessId])

  const connectedSet = new Set(
    connections.filter((c) => c.is_active).map((c) => c.platform)
  )

  function togglePlatform(platform: SocialPlatform) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  function isScheduledAtValid(): boolean {
    if (!scheduledAt) return false
    const selected = new Date(scheduledAt).getTime()
    return selected >= Date.now() + 10 * 60 * 1000
  }

  async function handleSubmit() {
    if (selectedPlatforms.length === 0) {
      setFeedback({ type: 'error', message: 'Selecciona al menos una plataforma' })
      return
    }
    if (mode === 'later' && !isScheduledAtValid()) {
      setFeedback({
        type: 'error',
        message: 'La fecha programada debe ser al menos 10 minutos en el futuro',
      })
      return
    }

    setLoading(true)
    setFeedback(null)

    try {
      const body: Record<string, unknown> = {
        post_id: postId,
        platforms: selectedPlatforms,
      }
      if (mode === 'later') {
        body.scheduled_at = new Date(scheduledAt).toISOString()
      }

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 403) {
          setShowUpgrade(true)
          return
        }
        setFeedback({ type: 'error', message: data.error ?? 'Error al publicar' })
        return
      }

      if (data.success === false && data.error) {
        setFeedback({ type: 'error', message: data.error })
        return
      }

      if (data.scheduled) {
        const dateStr = new Date(scheduledAt).toLocaleString('es-ES', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
        setFeedback({ type: 'success', message: `Programado para ${dateStr}` })
        onScheduled()
        return
      }

      // Publish now — check per-platform results
      const results: Record<string, { success: boolean; error?: string }> = data.results ?? {}
      const failedPlatforms = Object.entries(results)
        .filter(([, r]) => !r.success)
        .map(([p]) => p)
      const succeededPlatforms = Object.entries(results)
        .filter(([, r]) => r.success)
        .map(([p]) => p)

      if (failedPlatforms.length === 0) {
        setFeedback({
          type: 'success',
          message: `Publicado correctamente en ${succeededPlatforms.join(', ')}`,
        })
        onPublished()
      } else {
        const errorDetails = Object.entries(results)
          .filter(([, r]) => !r.success)
          .map(([p, r]) => `${p}: ${r.error}`)
          .join(' | ')
        setFeedback({ type: 'error', message: errorDetails })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Error de conexion. Intentalo de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  const submitLabel = loading
    ? 'Publicando...'
    : mode === 'later'
    ? 'Programar'
    : 'Publicar'

  return (
    <>
    {showUpgrade && (
      <UpgradeModal
        feature="publicaciones ilimitadas"
        onClose={() => setShowUpgrade(false)}
      />
    )}
    <Card>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Publicar"
          subtitle="Elige donde y cuando publicar este contenido"
        />

        {feedback && (
          <Badge
            variant={feedback.type === 'success' ? 'success' : 'error'}
            className="w-full justify-center py-2 rounded-lg text-xs"
          >
            {feedback.message}
          </Badge>
        )}

        {/* Platform checkboxes */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-brand-text-primary">Plataformas</span>
          {ALL_PLATFORMS.map(({ key, label }) => {
            const isConnected = connectedSet.has(key)
            const isChecked = selectedPlatforms.includes(key)
            return (
              <label
                key={key}
                className={[
                  'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-colors duration-150',
                  isConnected
                    ? 'border-brand-border cursor-pointer hover:bg-brand-bg'
                    : 'border-brand-border opacity-50 cursor-not-allowed bg-brand-bg',
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    disabled={!isConnected}
                    checked={isChecked}
                    onChange={() => isConnected && togglePlatform(key)}
                    className="w-4 h-4 accent-brand-primary"
                  />
                  <span className="text-sm text-brand-text-primary">{label}</span>
                </div>
                {!isConnected && (
                  <Badge variant="neutral" className="text-xs">No conectada</Badge>
                )}
              </label>
            )
          })}
        </div>

        {/* Publish mode radio */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-brand-text-primary">Cuando publicar</span>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="publish_mode"
              value="now"
              checked={mode === 'now'}
              onChange={() => setMode('now')}
              className="w-4 h-4 accent-brand-primary"
            />
            <span className="text-sm text-brand-text-primary">Publicar ahora</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name="publish_mode"
              value="later"
              checked={mode === 'later'}
              onChange={() => setMode('later')}
              className="w-4 h-4 accent-brand-primary"
            />
            <span className="text-sm text-brand-text-primary">Programar para mas tarde</span>
          </label>
        </div>

        {/* Datetime picker */}
        {mode === 'later' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-text-primary">
              Fecha y hora
            </label>
            <input
              type="datetime-local"
              min={getMinDatetime()}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-primary bg-brand-surface outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-150"
            />
          </div>
        )}

        <Button
          onClick={handleSubmit}
          loading={loading}
          className="w-full"
        >
          {submitLabel}
        </Button>
      </div>
    </Card>
    </>
  )
}
