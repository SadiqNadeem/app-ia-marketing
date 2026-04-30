'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface TrendItem {
  id: string
  title: string
  reason: string
  platform: string
  used?: boolean
}

interface Props {
  businessId: string
  trendsList: TrendItem[]
  activeConnections: number
  customersCount: number
  scheduledCount: number
}


export function DashboardAIPanel({
  businessId,
  trendsList,
  activeConnections,
  customersCount,
  scheduledCount,
}: Props) {
  const router = useRouter()
  const [ideas, setIdeas] = useState<TrendItem[]>(trendsList)
  const [generating, setGenerating] = useState(false)
  const [usingId, setUsingId]   = useState<string | null>(null)

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/trends/generate-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId }),
      })
      if (res.ok) {
        const tRes = await fetch(`/api/trends/current?business_id=${businessId}`)
        const data = await tRes.json()
        setIdeas(data.trends?.suggestions ?? [])
      }
    } catch { /* silent */ }
    setGenerating(false)
  }

  async function handleUse(idea: TrendItem) {
    setUsingId(idea.id)
    try {
      const res = await fetch('/api/trends/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId, trend_id: idea.id }),
      })
      const data = await res.json()
      if (data.success) router.push(`/dashboard/create?post_id=${data.post_id}`)
    } catch { /* silent */ }
    setUsingId(null)
  }

  const pendingIdeas = ideas.filter(i => !i.used).slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Create block ────────────────────────────────────────── */}
      {/* Dark card — the most important action on the page */}
      <div style={{
        background: '#1A1A1A',
        borderRadius: 14,
        padding: '22px 20px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
      }}>
        {/* Label + title */}
        <span style={{
          fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          display: 'block', marginBottom: 6,
        }}>
          Contenido con IA
        </span>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
          Crea y publica en segundos
        </p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: '0 0 18px', lineHeight: 1.4 }}>
          Post, video o flyer generado con IA
        </p>

        {/* Primary CTA — white on black */}
        <Link
          href="/dashboard/create"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            background: '#fff',
            color: '#1A1A1A',
            borderRadius: 9,
            padding: '11px 0',
            fontSize: 13,
            fontWeight: 700,
            textDecoration: 'none',
            width: '100%',
            letterSpacing: '-0.1px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nuevo post
        </Link>

        {/* Secondary actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {[
            { label: 'Video', href: '/dashboard/video' },
            { label: 'Asistente IA', href: '/dashboard/chat' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href as never}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.75)',
                borderRadius: 8,
                padding: '9px',
                fontSize: 12, fontWeight: 600,
                textDecoration: 'none',
                transition: 'background 120ms',
              }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Ideas card ──────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid #F4F1EC',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9E9688', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Ideas de la semana
          </span>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              fontSize: 11, fontWeight: 600, color: '#1A56DB',
              background: 'none', border: 'none', cursor: generating ? 'default' : 'pointer',
              padding: 0, opacity: generating ? 0.5 : 1,
            }}
          >
            {generating ? 'Generando...' : pendingIdeas.length === 0 ? 'Generar' : 'Actualizar'}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '4px 18px 8px' }}>
          {pendingIdeas.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              {/* Lightbulb icon */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px' }}>
                <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 2.22-1.2 4.15-3 5.19V17H9v-2.81C7.2 13.15 6 11.22 6 9a6 6 0 0 1 6-6z" />
              </svg>
              <p style={{ fontSize: 12, color: '#9E9688', margin: '0 0 10px' }}>Sin ideas esta semana</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  background: '#1A1A1A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  padding: '8px 16px',
                  fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                  opacity: generating ? 0.6 : 1,
                }}
              >
                {generating ? 'Generando...' : 'Generar ideas'}
              </button>
            </div>
          ) : (
            pendingIdeas.map((idea, idx) => (
              <div
                key={idea.id}
                style={{
                  padding: '12px 0',
                  borderBottom: idx < pendingIdeas.length - 1 ? '1px solid #F4F1EC' : 'none',
                }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A', margin: '0 0 2px', lineHeight: 1.35 }}>
                  {idea.title}
                </p>
                <p style={{ fontSize: 11, color: '#9E9688', margin: '0 0 6px', lineHeight: 1.35 }}>
                  {(idea.reason ?? '').slice(0, 80)}{(idea.reason?.length ?? 0) > 80 ? '...' : ''}
                </p>
                <button
                  onClick={() => handleUse(idea)}
                  disabled={usingId === idea.id}
                  style={{
                    fontSize: 11, fontWeight: 700,
                    color: usingId === idea.id ? '#9E9688' : '#1A56DB',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  {usingId === idea.id ? 'Creando...' : 'Usar esta idea →'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}
