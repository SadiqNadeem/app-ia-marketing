'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'

interface TrendSuggestion {
  id: string
  title: string
  reason: string
  platform: string
  content_text: string
  hashtags: string[]
  promotion_type: string | null
  used: boolean
}

interface TrendsRecord {
  id: string
  business_id: string
  week_start: string
  suggestions: TrendSuggestion[]
  created_at: string
}

interface TrendsCardProps {
  businessId: string
  compact?: boolean
}

function formatWeekRange(weekStart: string): string {
  const monday = new Date(weekStart + 'T00:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  return `Semana del ${fmt(monday)} al ${fmt(sunday)}`
}

export function TrendsCard({ businessId, compact = false }: TrendsCardProps) {
  const router = useRouter()
  const [trends, setTrends] = useState<TrendsRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [usingId, setUsingId] = useState<string | null>(null)

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/trends/current?business_id=${businessId}`)
      const data = await res.json()
      setTrends(data.trends ?? null)
    } catch {
      setTrends(null)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/trends/generate-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId }),
      })
      if (res.ok) {
        await fetchTrends()
      }
    } catch {
      // silent fail
    } finally {
      setGenerating(false)
    }
  }

  async function handleUse(suggestion: TrendSuggestion) {
    setUsingId(suggestion.id)
    try {
      const res = await fetch('/api/trends/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId, trend_id: suggestion.id }),
      })
      const data = await res.json()
      if (data.success) {
        // Mark used in local state
        setTrends((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            suggestions: prev.suggestions.map((s) =>
              s.id === suggestion.id ? { ...s, used: true } : s
            ),
          }
        })
        router.push(`/dashboard/create?post_id=${data.post_id}`)
      }
    } catch {
      // silent fail
    } finally {
      setUsingId(null)
    }
  }

  if (loading) return null

  const pending = trends?.suggestions.filter((s) => !s.used) ?? []

  if (!trends) {
    if (compact) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: '#9E9688', textAlign: 'center', padding: '12px 0', margin: 0 }}>
            No hay ideas esta semana
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: '#EEF3FE',
              color: '#1A56DB',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              marginTop: 8,
              opacity: generating ? 0.6 : 1,
            }}
          >
            {generating ? 'Generando...' : 'Generar ideas'}
          </button>
        </div>
      )
    }
    return (
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs text-[#1A56DB] hover:underline disabled:opacity-50"
        >
          {generating ? 'Generando ideas...' : 'Generar ideas de esta semana'}
        </button>
      </div>
    )
  }

  if (pending.length === 0) return null

  // ── Compact mode: renders without outer card wrapper ──────────
  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {pending.map((suggestion, i) => (
          <div
            key={suggestion.id}
            style={{
              padding: '10px 0',
              borderBottom: i < pending.length - 1 ? '1px solid #F4F1EC' : 'none',
            }}
          >
            <p style={{ fontSize: 12, fontWeight: 500, color: '#1A1A1A', margin: 0 }}>
              {suggestion.title}
            </p>
            <p style={{ fontSize: 11, color: '#9E9688', margin: '2px 0 5px' }}>
              {suggestion.reason.slice(0, 90)}{suggestion.reason.length > 90 ? '...' : ''}
            </p>
            <button
              onClick={() => handleUse(suggestion)}
              disabled={usingId === suggestion.id}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#1A56DB',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                opacity: usingId === suggestion.id ? 0.5 : 1,
              }}
            >
              {usingId === suggestion.id ? 'Creando...' : 'Usar esta idea'}
            </button>
          </div>
        ))}
      </div>
    )
  }

  // ── Full mode ─────────────────────────────────────────────────
  return (
    <div
      style={{ borderLeft: '3px solid #1A56DB', background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #EAECF0', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#1A56DB', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Ideas para esta semana
        </span>
        <span style={{ fontSize: 12, color: '#5A6070' }}>
          {formatWeekRange(trends.week_start)}
        </span>
      </div>

      {/* Suggestion list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pending.map((suggestion) => (
          <div
            key={suggestion.id}
            style={{ backgroundColor: '#F4F5F7', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>
              {suggestion.title}
            </p>
            <p style={{ fontSize: 12, color: '#5A6070', margin: 0 }}>
              {suggestion.reason}
            </p>
            <div>
              <Badge variant="neutral">{suggestion.platform}</Badge>
            </div>
            <button
              onClick={() => handleUse(suggestion)}
              disabled={usingId === suggestion.id}
              style={{
                width: '100%',
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #1A56DB',
                color: '#1A56DB',
                borderRadius: 8,
                padding: '6px 0',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'background 120ms',
                opacity: usingId === suggestion.id ? 0.5 : 1,
              }}
            >
              {usingId === suggestion.id ? 'Creando borrador...' : 'Usar esta idea'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

