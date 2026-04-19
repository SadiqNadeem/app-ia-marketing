'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import type { Post, SocialPlatform } from '@/types'

const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAY_LABELS = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo']

const PLATFORM_SHORT: Record<string, string> = { instagram: 'IG', tiktok: 'TT', whatsapp: 'WA', facebook: 'FB', google: 'GO' }
const PLATFORM_STYLE: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700 border-pink-200',
  tiktok: 'bg-gray-900 text-gray-100 border-gray-700',
  whatsapp: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  facebook: 'bg-blue-100 text-blue-700 border-blue-200',
  google: 'bg-amber-100 text-amber-700 border-amber-200',
}

type PlanStyle = 'moderno' | 'divertido' | 'premium'
type PostsPerWeek = 3 | 5

interface PlanConfig {
  includePromotions: boolean
  postsPerWeek: PostsPerWeek
  style: PlanStyle
}

interface PlanItem {
  day: number
  platform: SocialPlatform
  title: string
  content: string
  isPromotion: boolean
  emoji: string
}

interface CalendarPost extends Post {
  title?: string | null
}

const CONTENT_POOL = [
  { text: 'Nuestro kebab estrella', emoji: '📸', promo: false },
  { text: '2x1 en kebabs viernes', emoji: '🔥', promo: true },
  { text: 'Como lo preparamos', emoji: '🎥', promo: false },
  { text: 'Resena de cliente feliz', emoji: '💬', promo: false },
  { text: 'Detras de cocina', emoji: '👨‍🍳', promo: false },
]

function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate() }
function firstDayOffset(year: number, month: number) { const d = new Date(year, month - 1, 1).getDay(); return d === 0 ? 6 : d - 1 }
function pad(n: number) { return String(n).padStart(2, '0') }
function monthLabel(m: number, y: number) { return `${MONTH_NAMES[m - 1]} de ${y}` }

function postDay(post: CalendarPost): number | null {
  const raw = post.suggestion_date || post.scheduled_at
  if (!raw) return null
  const day = Number.parseInt(raw.slice(8, 10), 10)
  return Number.isNaN(day) ? null : day
}

function generatePlan(config: PlanConfig, month: number, year: number): PlanItem[] {
  const dim = daysInMonth(year, month)
  const weeks = Math.ceil(dim / 7)
  const amount = Math.max(10, Math.min(20, weeks * config.postsPerWeek))
  const platforms: SocialPlatform[] = config.postsPerWeek === 5
    ? ['instagram', 'tiktok', 'facebook', 'whatsapp', 'instagram']
    : ['instagram', 'tiktok', 'whatsapp']

  const out: PlanItem[] = []
  for (let i = 0; i < amount; i++) {
    const slot = CONTENT_POOL[i % CONTENT_POOL.length]
    if (slot.promo && !config.includePromotions) continue
    const stylePrefix = config.style === 'premium' ? 'Edicion premium: ' : config.style === 'divertido' ? 'Toque divertido: ' : 'Estilo moderno: '
    const day = Math.min(dim, 1 + Math.floor((i / Math.max(1, amount - 1)) * (dim - 1)))
    out.push({
      day,
      platform: platforms[i % platforms.length],
      title: slot.text,
      content: `${stylePrefix}${slot.text}`,
      isPromotion: slot.promo,
      emoji: slot.emoji,
    })
  }
  return out.length < 10 ? [...out, ...out].slice(0, 10) : out
}

export default function CalendarPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [businessId, setBusinessId] = useState('')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [applying, setApplying] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [planConfig, setPlanConfig] = useState<PlanConfig>({ includePromotions: true, postsPerWeek: 3, style: 'moderno' })
  const [draftOverrides, setDraftOverrides] = useState<Record<number, number>>({})

  const loadData = useCallback(async (m: number, y: number) => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single()
    if (!business) { setLoading(false); return }
    setBusinessId(business.id)

    const start = `${y}-${pad(m)}-01`
    const end = `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`
    const { data } = await supabase
      .from('posts')
      .select('*')
      .eq('business_id', business.id)
      .gte('suggestion_date', start)
      .lte('suggestion_date', end)
      .order('suggestion_date', { ascending: true })

    setPosts((data as CalendarPost[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData(month, year) }, [month, year, loadData])
  useEffect(() => { if (!feedback) return; const t = setTimeout(() => setFeedback(null), 3200); return () => clearTimeout(t) }, [feedback])

  const dim = daysInMonth(year, month)
  const offset = firstDayOffset(year, month)
  const totalCells = Math.ceil((offset + dim) / 7) * 7
  const draftBase = useMemo(() => generatePlan(planConfig, month, year), [planConfig, month, year])
  const draft = useMemo(() => draftBase.map((it, idx) => ({ ...it, day: Math.max(1, Math.min(dim, draftOverrides[idx] ?? it.day)) })), [draftBase, draftOverrides, dim])

  const postsByDay = useMemo(() => {
    const map: Record<number, CalendarPost[]> = {}
    for (const p of posts) {
      const d = postDay(p)
      if (!d) continue
      map[d] = map[d] ? [...map[d], p] : [p]
    }
    return map
  }, [posts])

  const selectedDayPosts = selectedDay ? (postsByDay[selectedDay] ?? []) : []

  function prevMonth() { if (month === 1) { setMonth(12); setYear((y) => y - 1) } else setMonth((m) => m - 1); setSelectedDay(null) }
  function nextMonth() { if (month === 12) { setMonth(1); setYear((y) => y + 1) } else setMonth((m) => m + 1); setSelectedDay(null) }
  function regenerate() { setPlanConfig((p) => ({ ...p, style: p.style === 'moderno' ? 'divertido' : p.style === 'divertido' ? 'premium' : 'moderno' })) }

  async function applyPlan() {
    setApplying(true)
    const generated: CalendarPost[] = draft.map((it, idx) => ({
      id: `ai-plan-${Date.now()}-${idx}`,
      business_id: businessId || 'local',
      content_text: it.content,
      image_url: null,
      video_url: null,
      platforms: [it.platform],
      status: 'draft',
      scheduled_at: null,
      published_at: null,
      promotion_type: it.isPromotion ? 'oferta_2x1' : null,
      is_suggestion: true,
      suggestion_date: `${year}-${pad(month)}-${pad(it.day)}`,
      title: it.title,
      created_at: new Date().toISOString(),
    }))
    setPosts((prev) => [...prev.filter((p) => !p.id.startsWith('ai-plan-')), ...generated])
    setApplying(false)
    setSidebarOpen(false)
    setFeedback(`Plan generado con ${generated.length} publicaciones`)
  }

  return (
    <div className={['flex w-full flex-col gap-5 px-3 py-4 md:px-6 md:py-6', sidebarOpen ? 'lg:pr-[430px]' : ''].join(' ')}>
      <PageHeader title="Calendario editorial" subtitle="Vista mensual para planificar y gestionar publicaciones" />

      {feedback && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{feedback}</div>}

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F7F8FA]">&lt;</button>
            <span className="min-w-[170px] text-center text-base font-semibold capitalize text-[#111827]">{monthLabel(month, year)}</span>
            <button onClick={nextMonth} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F7F8FA]">&gt;</button>
          </div>
          <div className="flex-1" />
          <span className="text-sm text-[#374151]">{posts.length} publicaciones en este mes</span>
          <Button onClick={() => setSidebarOpen(true)} disabled={!businessId}>Generar plan con IA</Button>
        </div>

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#EF4444]">{error}</div>}
        {loading && <div className="mt-4 text-sm text-[#374151]">Cargando calendario...</div>}

        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[780px]">
            <div className="mb-2 grid grid-cols-7 gap-3">
              {DAY_LABELS.map((d) => <div key={d} className="px-1 text-xs font-medium uppercase tracking-wide text-[#374151]">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-3">
              {Array.from({ length: totalCells }, (_, idx) => {
                const day = idx - offset + 1
                const inMonth = day >= 1 && day <= dim
                if (!inMonth) return <div key={`e-${idx}`} className="min-h-[120px] rounded-xl border border-transparent bg-transparent" />
                const dayPosts = postsByDay[day] ?? []
                return (
                  <button key={day} onClick={() => setSelectedDay(day)} className="min-h-[120px] rounded-xl border border-[#E5E7EB] bg-white p-3 text-left transition-all hover:border-[#93C5FD] hover:shadow-sm">
                    <div className="text-sm font-semibold text-[#111827]">{day}</div>
                    <div className="mt-2 space-y-1">
                      {dayPosts.slice(0, 3).map((p) => {
                        const pf = p.platforms?.[0] ?? 'instagram'
                        return <div key={p.id} className={`truncate rounded-md border px-2 py-1 text-[11px] font-medium ${PLATFORM_STYLE[pf] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>{(p.title || p.content_text).slice(0, 38)} - {PLATFORM_SHORT[pf] ?? 'IG'}</div>
                      })}
                      {dayPosts.length > 3 && <div className="text-[11px] font-medium text-[#374151]">+{dayPosts.length - 3} mas</div>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {selectedDay !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <p className="text-lg font-semibold">Dia {selectedDay} de {MONTH_NAMES[month - 1]}</p>
              <button onClick={() => setSelectedDay(null)} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm hover:bg-[#F7F8FA]">Cerrar</button>
            </div>
            <div className="max-h-[calc(80vh-72px)] space-y-2 overflow-y-auto p-5">
              {selectedDayPosts.length === 0 ? <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-5 text-center text-sm text-[#374151]">No hay publicaciones para este dia.</div> : selectedDayPosts.map((p) => <div key={p.id} className="rounded-xl border border-[#E5E7EB] p-3 text-sm">{p.title || p.content_text}</div>)}
            </div>
          </div>
        </div>
      )}

      <aside className={['fixed right-0 top-0 z-[60] h-full w-full max-w-[400px] border-l border-[#E5E7EB] bg-white shadow-xl transition-transform duration-300', sidebarOpen ? 'translate-x-0' : 'translate-x-full'].join(' ')}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
            <div>
              <p className="text-sm text-[#374151]">Asistente IA</p>
              <p className="text-base font-medium text-[#111827]">Configurar plan mensual</p>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-sm hover:bg-[#F7F8FA]">Cerrar</button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-[#111827]">A) Chat / preguntas IA</p>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">¿Que tipo de contenido quieres este mes?</div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">¿Quieres incluir promociones?</div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-sm">¿Cuantos posts por semana?</div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[#374151]">Promociones</p>
                <div className="flex gap-2">
                  <button onClick={() => setPlanConfig((p) => ({ ...p, includePromotions: true }))} className={['rounded-lg border px-3 py-1.5 text-sm', planConfig.includePromotions ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB]'].join(' ')}>Promociones</button>
                  <button onClick={() => setPlanConfig((p) => ({ ...p, includePromotions: false }))} className={['rounded-lg border px-3 py-1.5 text-sm', !planConfig.includePromotions ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB]'].join(' ')}>No promociones</button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[#374151]">Frecuencia</p>
                <div className="flex gap-2">
                  <button onClick={() => setPlanConfig((p) => ({ ...p, postsPerWeek: 3 }))} className={['rounded-lg border px-3 py-1.5 text-sm', planConfig.postsPerWeek === 3 ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB]'].join(' ')}>3 posts semana</button>
                  <button onClick={() => setPlanConfig((p) => ({ ...p, postsPerWeek: 5 }))} className={['rounded-lg border px-3 py-1.5 text-sm', planConfig.postsPerWeek === 5 ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB]'].join(' ')}>5 posts semana</button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-[#374151]">Estilo</p>
                <div className="flex flex-wrap gap-2">
                  {(['moderno', 'divertido', 'premium'] as const).map((s) => (
                    <button key={s} onClick={() => setPlanConfig((p) => ({ ...p, style: s }))} className={['rounded-lg border px-3 py-1.5 text-sm capitalize', planConfig.style === s ? 'border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]' : 'border-[#E5E7EB]'].join(' ')}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#111827]">B) Preview del plan</p>
                <span className="text-xs text-[#374151]">{draft.length} items</span>
              </div>
              <div className="space-y-2 rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-3">
                {draft.slice(0, 16).map((item, idx) => (
                  <div key={`${item.day}-${idx}`} className="rounded-lg border border-[#E5E7EB] bg-white p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-[#111827]">Dia {item.day} · {PLATFORM_SHORT[item.platform]}</p>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] border ${PLATFORM_STYLE[item.platform]}`}>{PLATFORM_SHORT[item.platform]}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#374151]">{item.emoji} {item.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-[#374151]">Dia</span>
                      <input
                        type="number"
                        min={1}
                        max={dim}
                        value={draftOverrides[idx] ?? item.day}
                        onChange={(e) => setDraftOverrides((prev) => ({ ...prev, [idx]: Number.parseInt(e.target.value || '1', 10) }))}
                        className="w-16 rounded border border-[#E5E7EB] px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 border-t border-[#E5E7EB] p-4">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={regenerate} className="flex-1">Regenerar</Button>
              <Button variant="secondary" onClick={() => setSelectedDay(1)} className="flex-1">Editar un dia manualmente</Button>
            </div>
            <Button onClick={applyPlan} loading={applying} className="w-full">Aplicar plan al calendario</Button>
          </div>
        </div>
      </aside>
    </div>
  )
}
