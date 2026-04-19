'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReviewReply {
  comment: string
  updateTime: string
}

interface Reviewer {
  displayName: string
  profilePhotoUrl?: string
}

interface Review {
  reviewId: string
  reviewer: Reviewer
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE'
  comment: string
  createTime: string
  updateTime: string
  reviewReply?: ReviewReply
}

type FilterTab = 'all' | 'unanswered' | 'answered' | 'five' | 'low'
type SortKey = 'recent' | 'worst' | 'unanswered'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAR_TO_NUM: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

function starNum(rating: string): number {
  return STAR_TO_NUM[rating] ?? 0
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return d >= weekAgo
}

function avgRating(reviews: Review[]): number {
  if (!reviews.length) return 0
  return reviews.reduce((a, r) => a + starNum(r.starRating), 0) / reviews.length
}

// ── Star components ───────────────────────────────────────────────────────────

function StarsFilled({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span style={{ color: '#EF9F27', fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
      {'★'.repeat(n)}
      <span style={{ color: '#D1D5DB' }}>{'★'.repeat(5 - n)}</span>
    </span>
  )
}

function StarsDisplay({ rating }: { rating: string }) {
  const n = starNum(rating)
  return (
    <div className="flex items-center gap-1.5">
      <StarsFilled n={n} />
      <span className="text-xs text-[#374151]">{n} estrella{n !== 1 ? 's' : ''}</span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#E5E7EB]" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3 w-32 bg-[#E5E7EB] rounded" />
          <div className="h-3 w-20 bg-[#E5E7EB] rounded" />
        </div>
      </div>
      <div className="h-3 w-full bg-[#E5E7EB] rounded" />
      <div className="h-3 w-3/4 bg-[#E5E7EB] rounded" />
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

// ── ReviewCard ────────────────────────────────────────────────────────────────

interface ReviewCardProps {
  review: Review
  businessId: string
  onReplied: (reviewId: string, replyText: string) => void
}

function ReviewCard({ review, businessId, onReplied }: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [generatedReply, setGeneratedReply] = useState('')
  const [editedReply, setEditedReply] = useState('')
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedOk, setPublishedOk] = useState(false)
  const [localReply, setLocalReply] = useState<ReviewReply | undefined>(review.reviewReply)
  const [editingExisting, setEditingExisting] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [genError, setGenError] = useState('')
  const [pubError, setPubError] = useState('')

  const commentText = review.comment ?? ''
  const isLong = commentText.length > 200
  const displayText = isLong && !expanded ? commentText.slice(0, 200) + '...' : commentText
  const isLowRating = starNum(review.starRating) <= 2
  const needsAttention = isLowRating && !localReply && !publishedOk

  const showReplyEditor = (generatedReply !== '' || editingExisting || manualMode) && !localReply

  async function handleGenerate() {
    setGenerating(true)
    setGenError('')
    setGeneratedReply('')
    setEditedReply('')

    const res = await fetch('/api/reviews/generate-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: businessId,
        review_id: review.reviewId,
        star_rating: review.starRating,
        comment: review.comment,
        reviewer_name: review.reviewer.displayName,
      }),
    })

    const json = await res.json()
    setGenerating(false)

    if (!res.ok || !json.reply) {
      setGenError(json.error ?? 'Error al generar la respuesta')
      return
    }

    setGeneratedReply(json.reply)
    setEditedReply(json.reply)
    setManualMode(false)
  }

  async function handlePublish() {
    if (!editedReply.trim()) return
    setPublishing(true)
    setPubError('')

    const res = await fetch('/api/reviews/publish-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: businessId,
        review_id: review.reviewId,
        reply_text: editedReply,
      }),
    })

    const json = await res.json()
    setPublishing(false)

    if (!res.ok || !json.success) {
      setPubError(json.error ?? 'Error al publicar la respuesta')
      return
    }

    const newReply: ReviewReply = { comment: editedReply, updateTime: new Date().toISOString() }
    setLocalReply(newReply)
    setPublishedOk(true)
    setGeneratedReply('')
    setManualMode(false)
    setEditingExisting(false)
    onReplied(review.reviewId, editedReply)
    setTimeout(() => setPublishedOk(false), 4000)
  }

  function openManualReply() {
    setManualMode(true)
    setEditedReply('')
    setGeneratedReply('')
    setGenError('')
  }

  function cancelReply() {
    setManualMode(false)
    setGeneratedReply('')
    setEditedReply('')
    setGenError('')
    if (editingExisting) {
      setEditingExisting(false)
      setLocalReply(review.reviewReply)
    }
  }

  return (
    <div
      className={[
        'bg-white rounded-xl border p-4 flex flex-col gap-3 transition-colors',
        needsAttention
          ? 'border-red-200 ring-1 ring-red-100'
          : 'border-[#E5E7EB]',
      ].join(' ')}
    >
      {/* Alert strip for 1-2 stars without reply */}
      {needsAttention && (
        <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 -mx-1">
          <AlertIcon />
          <p className="text-xs text-red-700 font-medium">
            Resena negativa — responde pronto para proteger tu reputacion.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {review.reviewer.profilePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={review.reviewer.profilePhotoUrl}
              alt={review.reviewer.displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className={[
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0',
              isLowRating ? 'bg-red-50 text-red-600' : 'bg-[#EFF6FF] text-[#2563EB]',
            ].join(' ')}>
              {review.reviewer.displayName?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-[#111827]">
              {review.reviewer.displayName}
            </span>
            <StarsDisplay rating={review.starRating} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {localReply && !editingExisting && (
            <Badge variant="success">Respondida</Badge>
          )}
          <span className="text-xs text-[#374151]">{formatDate(review.createTime)}</span>
        </div>
      </div>

      {/* Comment */}
      {commentText && (
        <div className="flex flex-col gap-1">
          <p className="text-[13px] text-[#374151] leading-relaxed">{displayText}</p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-[#2563EB] text-left hover:underline"
            >
              {expanded ? 'Ver menos' : 'Ver mas'}
            </button>
          )}
        </div>
      )}

      {/* Published confirmation */}
      {publishedOk && (
        <Badge variant="success">Respuesta publicada en Google</Badge>
      )}

      {/* Existing reply */}
      {localReply && !editingExisting && (
        <div className="rounded-lg p-3 flex flex-col gap-1.5 bg-[#F7F8FA] border-l-4 border-[#2563EB]">
          <span className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wide">Tu respuesta</span>
          <p className="text-[13px] text-[#374151] leading-relaxed">{localReply.comment}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditedReply(localReply.comment)
              setLocalReply(undefined)
              setEditingExisting(true)
              setGeneratedReply(localReply.comment)
            }}
          >
            Editar respuesta
          </Button>
        </div>
      )}

      {/* Reply editor — manual or AI-generated */}
      {showReplyEditor && (
        <div className="flex flex-col gap-2.5 pt-1 border-t border-[#F3F4F6]">
          <div className="flex flex-col gap-1.5">
            <textarea
              value={editedReply}
              onChange={e => setEditedReply(e.target.value)}
              rows={4}
              maxLength={4096}
              className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#374151] resize-none"
              placeholder="Escribe tu respuesta..."
              autoFocus={manualMode && !generatedReply}
            />
            <span className="text-xs text-[#4B5563] text-right">
              {editedReply.length} / 4096
            </span>
          </div>

          {pubError && <p className="text-xs text-[#EF4444]">{pubError}</p>}
          {genError && <p className="text-xs text-[#EF4444]">{genError}</p>}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handlePublish}
              loading={publishing}
              disabled={!editedReply.trim()}
            >
              Publicar respuesta
            </Button>

            {/* Show "Generar con IA" in manual mode, "Regenerar" in AI mode */}
            {manualMode && !generatedReply ? (
              <Button size="sm" variant="secondary" onClick={handleGenerate} loading={generating}>
                {generating ? 'Generando...' : 'Generar con IA'}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={handleGenerate} loading={generating}>
                Regenerar
              </Button>
            )}

            <button
              onClick={cancelReply}
              className="text-xs text-[#4B5563] hover:text-[#374151] transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* No reply yet — two action buttons */}
      {!localReply && !generatedReply && !manualMode && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-[#F3F4F6]">
          {genError && <p className="text-xs text-[#EF4444]">{genError}</p>}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={openManualReply}>
              Responder
            </Button>
            <Button size="sm" onClick={handleGenerate} loading={generating}>
              {generating ? 'Generando...' : 'Responder con IA'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Review link panel ─────────────────────────────────────────────────────────

interface ReviewLinkPanelProps {
  businessId: string
  onClose: () => void
}

function ReviewLinkPanel({ businessId, onClose }: ReviewLinkPanelProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/reviews/review-link?business_id=${businessId}`)
      const json = await res.json()
      setLoading(false)
      if (res.ok && json.url) {
        setUrl(json.url)
      } else {
        setError(json.error ?? 'No se pudo obtener el enlace')
      }
    }
    load()
  }, [businessId])

  async function handleCopy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // fallback: do nothing
    }
  }

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon />
          <p className="text-sm font-semibold text-[#111827]">Enlace para pedir resena</p>
        </div>
        <button
          onClick={onClose}
          className="text-[#4B5563] hover:text-[#374151] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {loading && (
        <p className="text-sm text-[#374151]">Obteniendo enlace de Google...</p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {url && (
        <>
          <p className="text-xs text-[#374151]">
            Comparte este enlace con tus clientes para que dejen una resena directamente en Google.
          </p>
          <div className="flex items-center gap-2 bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg px-3 py-2.5">
            <span className="text-xs text-[#374151] truncate flex-1 font-mono">{url}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline shrink-0 font-medium"
            >
              <CopyIcon />
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#374151] hover:text-[#111827] transition-colors text-center"
          >
            Abrir en Google
          </a>
        </>
      )}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',        label: 'Todas' },
  { key: 'unanswered', label: 'Sin responder' },
  { key: 'answered',   label: 'Respondidas' },
  { key: 'five',       label: '5 estrellas' },
  { key: 'low',        label: '1-2 estrellas' },
]

export default function ReviewsPage() {
  const [businessId, setBusinessId] = useState('')
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [noGoogle, setNoGoogle] = useState(false)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [sortKey, setSortKey] = useState<SortKey>('recent')
  const [repliedIds, setRepliedIds] = useState<Set<string>>(new Set())
  const [showLinkPanel, setShowLinkPanel] = useState(false)

  const loadReviews = useCallback(async (bid: string) => {
    setLoading(true)
    setNoGoogle(false)

    try {
      const res = await fetch(`/api/reviews/list?business_id=${bid}`)
      const json = await res.json()

      if (json.error === 'no_google_connected') {
        setNoGoogle(true)
        return
      }

      if (res.ok && Array.isArray(json.reviews)) {
        setReviews(json.reviews)
      }
    } catch {
      setNoGoogle(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .single()

      if (!biz) {
        setLoading(false)
        return
      }

      setBusinessId(biz.id)
      await loadReviews(biz.id)
    }
    init()
  }, [loadReviews])

  function handleReplied(reviewId: string) {
    setRepliedIds(prev => new Set(prev).add(reviewId))
  }

  // ── Derived metrics ────────────────────────────────────────────────
  const unansweredCount = reviews.filter(
    r => !r.reviewReply && !repliedIds.has(r.reviewId)
  ).length

  const unansweredLowCount = reviews.filter(
    r => starNum(r.starRating) <= 2 && !r.reviewReply && !repliedIds.has(r.reviewId)
  ).length

  const weekCount = reviews.filter(r => isThisWeek(r.createTime)).length
  const avg = avgRating(reviews)

  // ── Filter ─────────────────────────────────────────────────────────
  let filtered = reviews.filter(r => {
    const hasReply = !!r.reviewReply || repliedIds.has(r.reviewId)
    const n = starNum(r.starRating)
    switch (filterTab) {
      case 'unanswered': return !hasReply
      case 'answered':   return hasReply
      case 'five':       return n === 5
      case 'low':        return n <= 2
      default:           return true
    }
  })

  // ── Sort ───────────────────────────────────────────────────────────
  filtered = [...filtered].sort((a, b) => {
    if (sortKey === 'worst') return starNum(a.starRating) - starNum(b.starRating)
    if (sortKey === 'unanswered') {
      const aHas = !!a.reviewReply || repliedIds.has(a.reviewId) ? 1 : 0
      const bHas = !!b.reviewReply || repliedIds.has(b.reviewId) ? 1 : 0
      if (aHas !== bHas) return aHas - bHas
    }
    return new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime()
  })

  // ── No Google connected ────────────────────────────────────────────
  if (!loading && noGoogle) {
    return (
      <div className="p-6 flex flex-col gap-6 max-w-3xl">
        <h1 className="text-lg font-bold text-[#111827]">Resenas de Google</h1>
        <div className="flex justify-center mt-10">
          <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-10 max-w-sm w-full flex flex-col items-center gap-4 text-center">
            {/* Google icon */}
            <div className="w-14 h-14 rounded-full bg-[#F3F4F6] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-base font-semibold text-[#111827]">
                Conecta tu cuenta de Google
              </p>
              <p className="text-sm text-[#374151]">
                Para ver y responder resenas directamente desde la app
              </p>
            </div>

            <Button onClick={() => { window.location.href = '/api/auth/google/connect' }}>
              Conectar Google Business
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl">

      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#111827]">Resenas de Google</h1>
          <p className="text-[13px] text-[#374151] mt-0.5">
            Responde a tus clientes directamente desde la app
          </p>
        </div>
        {!loading && !noGoogle && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowLinkPanel(v => !v)}
          >
            <LinkIcon />
            <span>Pedir resena</span>
          </Button>
        )}
      </div>

      {/* ── Review link panel ─────────────────────────────────────── */}
      {showLinkPanel && businessId && (
        <ReviewLinkPanel
          businessId={businessId}
          onClose={() => setShowLinkPanel(false)}
        />
      )}

      {/* ── Alert: unanswered negative reviews ────────────────────── */}
      {!loading && unansweredLowCount > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-800">
          <AlertIcon />
          <p className="text-sm">
            <span className="font-semibold">
              {unansweredLowCount} resena{unansweredLowCount > 1 ? 's' : ''} negativa{unansweredLowCount > 1 ? 's' : ''} sin responder.
            </span>
            {' '}Responde pronto para proteger tu reputacion en Google.
            {filterTab !== 'low' && (
              <button
                onClick={() => setFilterTab('low')}
                className="ml-2 underline hover:no-underline font-medium"
              >
                Ver ahora
              </button>
            )}
          </p>
        </div>
      )}

      {/* ── Metrics ───────────────────────────────────────────────── */}
      {!loading && reviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Avg rating with stars */}
          <Card padding="sm" className="flex flex-col gap-1">
            <p className="text-xs text-[#374151]">Nota media</p>
            <p className="text-2xl font-bold text-[#111827] leading-none">{avg.toFixed(1)}</p>
            <StarsFilled n={Math.round(avg)} size={12} />
          </Card>

          <Card padding="sm" className="flex flex-col gap-1">
            <p className="text-xs text-[#374151]">Total resenas</p>
            <p className="text-2xl font-bold text-[#111827] leading-none">{reviews.length}</p>
          </Card>

          <Card padding="sm" className="flex flex-col gap-1">
            <p className="text-xs text-[#374151]">Sin responder</p>
            <p className={`text-2xl font-bold leading-none ${unansweredCount > 0 ? 'text-amber-600' : 'text-[#111827]'}`}>
              {unansweredCount}
            </p>
          </Card>

          <Card padding="sm" className="flex flex-col gap-1">
            <p className="text-xs text-[#374151]">Esta semana</p>
            <p className="text-2xl font-bold text-[#111827] leading-none">{weekCount}</p>
          </Card>
        </div>
      )}

      {/* ── Filters + sort ────────────────────────────────────────── */}
      {!loading && reviews.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-0.5 border-b border-[#E5E7EB] flex-1 overflow-x-auto">
            {FILTER_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterTab(key)}
                className={[
                  'px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  filterTab === key
                    ? 'text-[#2563EB] border-b-2 border-[#2563EB] -mb-px'
                    : 'text-[#374151] hover:text-[#111827]',
                ].join(' ')}
              >
                {label}
                {key === 'unanswered' && unansweredCount > 0 && (
                  <span className="ml-1.5 text-xs bg-[#EFF6FF] text-[#2563EB] rounded-full px-1.5 py-0.5">
                    {unansweredCount}
                  </span>
                )}
                {key === 'low' && unansweredLowCount > 0 && (
                  <span className="ml-1.5 text-xs bg-red-100 text-red-700 rounded-full px-1.5 py-0.5">
                    {unansweredLowCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="text-xs border border-[#E5E7EB] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB] text-[#374151] bg-white shrink-0"
          >
            <option value="recent">Mas recientes primero</option>
            <option value="worst">Peor nota primero</option>
            <option value="unanswered">Sin responder primero</option>
          </select>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col gap-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* ── Empty states ──────────────────────────────────────────── */}
      {!loading && !noGoogle && reviews.length === 0 && (
        <div className="flex justify-center mt-8">
          <Card padding="lg" className="max-w-md w-full text-center">
            <p className="text-sm text-[#374151]">Aun no tienes resenas en Google Business.</p>
          </Card>
        </div>
      )}

      {!loading && reviews.length > 0 && filtered.length === 0 && (
        <Card padding="md" className="text-center">
          <p className="text-sm text-[#374151]">No hay resenas en esta categoria.</p>
        </Card>
      )}

      {/* ── Review list ───────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map(review => (
            <ReviewCard
              key={review.reviewId}
              review={review}
              businessId={businessId}
              onReplied={handleReplied}
            />
          ))}
        </div>
      )}
    </div>
  )
}

