'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Props {
  businessId: string
  connectedAt?: string
}

interface AnalysisState {
  loaded: boolean
  text: string | null
  expanded: boolean
  reimporting: boolean
  error: string | null
  postsAnalyzed: number | null
  /** timestamp when component mounted — used to decide whether to show "Analizar ahora" */
  mountedAt: number
}

export function InstagramAnalysisSection({ businessId }: Props) {
  const [state, setState] = useState<AnalysisState>({
    loaded: false,
    text: null,
    expanded: false,
    reimporting: false,
    error: null,
    postsAnalyzed: null,
    mountedAt: Date.now(),
  })
  const [showManualButton, setShowManualButton] = useState(false)

  const loadAnalysis = useCallback(async () => {
    try {
      const res = await fetch(`/api/instagram/analysis-status?business_id=${businessId}`)
      const data = await res.json()
      setState(prev => ({
        ...prev,
        loaded: true,
        text: data.analysis ?? null,
        postsAnalyzed: data.posts_analyzed ?? null,
      }))
    } catch {
      setState(prev => ({ ...prev, loaded: true }))
    }
  }, [businessId])

  useEffect(() => {
    loadAnalysis()
  }, [loadAnalysis])

  // After 30 seconds without analysis, show "Analizar ahora" button
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowManualButton(true)
    }, 30000)
    return () => clearTimeout(timer)
  }, [])

  async function handleReiimport() {
    setState(prev => ({ ...prev, reimporting: true, error: null }))
    try {
      const res = await fetch('/api/instagram/reimport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ business_id: businessId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState(prev => ({ ...prev, reimporting: false, error: data.error ?? 'Error al reimportar' }))
        return
      }
      setState(prev => ({
        ...prev,
        reimporting: false,
        text: data.analysis_preview ?? prev.text,
        postsAnalyzed: data.posts_analyzed ?? prev.postsAnalyzed,
        expanded: false,
      }))
      // Re-fetch full analysis
      await loadAnalysis()
    } catch {
      setState(prev => ({ ...prev, reimporting: false, error: 'Error de red' }))
    }
  }

  const { loaded, text, expanded, reimporting, error, postsAnalyzed } = state

  if (!loaded) {
    return (
      <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2 text-sm text-[#374151]">
          <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          Importando y analizando tus posts de Instagram...
        </div>
      </div>
    )
  }

  if (!text) {
    return (
      <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
        <div className="flex items-center gap-2 text-sm text-[#374151]">
          <div className="w-4 h-4 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          Importando y analizando tus posts de Instagram...
        </div>
        {showManualButton && (
          <button
            onClick={handleReiimport}
            disabled={reimporting}
            className="mt-2 text-sm text-[#2563EB] hover:underline disabled:opacity-50"
          >
            {reimporting ? 'Analizando...' : 'Analizar ahora'}
          </button>
        )}
        {error && <p className="text-xs text-[#DC2626] mt-1">{error}</p>}
      </div>
    )
  }

  const preview = text.slice(0, 200)
  const hasMore = text.length > 200

  return (
    <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="success">Analisis completado</Badge>
        {postsAnalyzed !== null && (
          <span className="text-xs text-[#4B5563]">{postsAnalyzed} posts analizados</span>
        )}
      </div>

      <div className="text-sm text-[#374151] leading-relaxed bg-[#F7F8FA] rounded-xl px-4 py-3">
        {expanded ? text : `${preview}${hasMore ? '...' : ''}`}
      </div>

      <div className="flex items-center gap-3 mt-2">
        {hasMore && (
          <button
            onClick={() => setState(prev => ({ ...prev, expanded: !prev.expanded }))}
            className="text-xs text-[#2563EB] hover:underline"
          >
            {expanded ? 'Ver menos' : 'Ver analisis completo'}
          </button>
        )}
        <button
          onClick={handleReiimport}
          disabled={reimporting}
          className="text-xs text-[#374151] hover:text-[#111827] transition-colors disabled:opacity-50"
        >
          {reimporting ? 'Analizando tus ultimos 30 posts...' : 'Reimportar y reanalizar'}
        </button>
      </div>

      {error && <p className="text-xs text-[#DC2626] mt-1">{error}</p>}
    </div>
  )
}

