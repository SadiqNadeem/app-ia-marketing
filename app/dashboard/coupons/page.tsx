'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CouponQR } from '@/components/CouponQR'
import { CouponScanner } from '@/components/CouponScanner'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import type { Coupon, CouponRedemption, DiscountType } from '@/types'

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function fmt(type: DiscountType, value: number): string {
  return type === 'percentage' ? `${value}%` : `${value} €`
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}
function isExpired(c: Coupon) {
  return !!c.expires_at && new Date(c.expires_at) < new Date()
}
function couponStatus(c: Coupon): { dot: string; bg: string; border: string; color: string; label: string } {
  if (isExpired(c))  return { dot: '#E02424', bg: '#FDE8E8', border: '#FECACA', color: '#E02424', label: 'Expirado' }
  if (!c.is_active)  return { dot: '#9EA3AE', bg: '#F4F5F7', border: '#EAECF0', color: '#9EA3AE', label: 'Inactivo' }
  return               { dot: '#0E9F6E', bg: '#DEF7EC', border: '#A7F3D0', color: '#0E9F6E', label: 'Activo'   }
}
function conversionRate(c: Coupon) {
  if (!c.max_uses) return '—'
  return `${Math.round((c.used_count / c.max_uses) * 100)}%`
}
function usagePct(c: Coupon) {
  if (!c.max_uses) return null
  return Math.min(100, Math.round((c.used_count / c.max_uses) * 100))
}

type Tab = 'coupons' | 'scanner' | 'redemptions'

// ─────────────────────────────────────────────────────────────────
// StatCard
// ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: 12,
      padding: '16px 18px', flex: 1, minWidth: 100,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#9EA3AE', fontWeight: 500 }}>{label}</span>
        <div style={{ width: 28, height: 28, borderRadius: 7, background: '#EEF3FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9EA3AE', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// CouponCard
// ─────────────────────────────────────────────────────────────────

function CouponCard({
  coupon, appUrl, copiedCode, copiedLink,
  onCopyCode, onCopyLink, onToggle, onDelete, onQR, onWhatsApp, onCreatePost, onUseCampaign,
}: {
  coupon: Coupon; appUrl: string
  copiedCode: string | null; copiedLink: string | null
  onCopyCode: (c: Coupon) => void; onCopyLink: (c: Coupon) => void
  onToggle: (c: Coupon) => void; onDelete: (c: Coupon) => void; onQR: (c: Coupon) => void
  onWhatsApp: (c: Coupon) => void; onCreatePost: (c: Coupon) => void; onUseCampaign: (c: Coupon) => void
}) {
  const st = couponStatus(coupon)
  const pct = usagePct(coupon)
  const isMaxed = !!(coupon.max_uses && coupon.used_count >= coupon.max_uses)

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #EAECF0', borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Accent bar */}
      <div style={{ height: 3, background: isMaxed ? '#E02424' : st.dot }} />

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', letterSpacing: '-0.1px' }}>{coupon.title}</p>
            {coupon.description && <p style={{ fontSize: 12, color: '#9EA3AE', marginTop: 2 }}>{coupon.description}</p>}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 10px', borderRadius: 100,
            background: st.bg, border: `1px solid ${st.border}`,
            fontSize: 11, fontWeight: 600, color: st.color, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: st.dot }} />
            {st.label}
          </span>
        </div>

        {/* Discount hero */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          padding: '10px 14px', background: '#F8F9FF', borderRadius: 10,
          border: '1px solid #BFDBFE',
        }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: '#1A56DB', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {fmt(coupon.discount_type, coupon.discount_value)}
          </span>
          <span style={{ fontSize: 13, color: '#5A6070' }}>
            {coupon.discount_type === 'percentage' ? 'de descuento' : 'descuento fijo'}
          </span>
        </div>

        {/* Code */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#F4F5F7', borderRadius: 9, padding: '9px 13px',
          border: '1px solid #EAECF0',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#111827', letterSpacing: '0.14em', flex: 1 }}>
            {coupon.code}
          </span>
          <button
            onClick={() => onCopyCode(coupon)}
            style={{
              fontSize: 12, fontWeight: 600,
              color: copiedCode === coupon.code ? '#0E9F6E' : '#1A56DB',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 6px', borderRadius: 5, flexShrink: 0,
              fontFamily: 'inherit', transition: 'color 120ms',
            }}
          >
            {copiedCode === coupon.code ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'Usos',      value: coupon.max_uses ? `${coupon.used_count}/${coupon.max_uses}` : `${coupon.used_count}` },
            { label: 'Conversión', value: conversionRate(coupon) },
            { label: 'Canjes',    value: coupon.used_count },
          ].map(m => (
            <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 2, background: '#F8F8F9', borderRadius: 8, padding: '8px 10px' }}>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9EA3AE' }}>{m.label}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {pct !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#9EA3AE' }}>Uso del límite</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: isMaxed ? '#E02424' : '#5A6070' }}>{pct}%</span>
            </div>
            <div style={{ height: 5, borderRadius: 100, background: '#EAECF0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 100, background: isMaxed ? '#E02424' : '#1A56DB', transition: 'width 400ms ease' }} />
            </div>
            {isMaxed && <span style={{ fontSize: 11, color: '#E02424', fontWeight: 500 }}>Límite alcanzado</span>}
          </div>
        )}

        {/* Expiry */}
        {coupon.expires_at && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: isExpired(coupon) ? '#E02424' : '#9EA3AE' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            {isExpired(coupon) ? 'Expiró el ' : 'Caduca el '}{formatDate(coupon.expires_at)}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
          <ActionBtn onClick={() => onCreatePost(coupon)} color="#1A56DB" bg="#EEF3FE" border="#C7D9FB">
            Crear post
          </ActionBtn>
          <ActionBtn onClick={() => onWhatsApp(coupon)} color="#0E9F6E" bg="#DEF7EC" border="#A7F3D0">
            WhatsApp
          </ActionBtn>
          <ActionBtn onClick={() => onUseCampaign(coupon)} color="#D97706" bg="#FFF8E6" border="#FDE68A">
            Campaña
          </ActionBtn>
          <ActionBtn onClick={() => onQR(coupon)} color="#5A6070" bg="#F4F5F7" border="#EAECF0">
            Ver QR
          </ActionBtn>
          <ActionBtn onClick={() => onCopyLink(coupon)} color="#5A6070" bg="#F4F5F7" border="#EAECF0">
            {copiedLink === coupon.code ? '✓ Copiado' : 'Copiar link'}
          </ActionBtn>
        </div>

        {/* Toggle / delete */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4, borderTop: '1px solid #EAECF0' }}>
          <button onClick={() => onToggle(coupon)} style={{ fontSize: 12, color: '#5A6070', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            {coupon.is_active ? 'Desactivar' : 'Activar'}
          </button>
          <span style={{ color: '#EAECF0' }}>|</span>
          <button onClick={() => onDelete(coupon)} style={{ fontSize: 12, color: '#E02424', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ActionBtn
// ─────────────────────────────────────────────────────────────────

function ActionBtn({ onClick, color, bg, border, children }: {
  onClick: () => void; color: string; bg: string; border: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 11px', borderRadius: 7,
        border: `1px solid ${border}`, background: bg, color,
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        fontFamily: 'inherit', transition: 'opacity 120ms', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────
// FocusInput / FocusSelect — inputs with blue focus ring
// ─────────────────────────────────────────────────────────────────

const inputStyle = (focused: boolean): React.CSSProperties => ({
  width: '100%', borderRadius: 8, padding: '8px 11px', fontSize: 13,
  color: '#111827', background: '#FFFFFF', outline: 'none',
  border: `1.5px solid ${focused ? '#1A56DB' : '#EAECF0'}`,
  boxShadow: focused ? '0 0 0 3px rgba(26,86,219,0.08)' : 'none',
  transition: 'border-color 120ms, box-shadow 120ms',
  boxSizing: 'border-box' as const,
  fontFamily: 'inherit',
})

// ─────────────────────────────────────────────────────────────────
// ScannerTab — empty state for scanner
// ─────────────────────────────────────────────────────────────────

function ScannerTabEmpty() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 24px' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: '#EEF3FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <path d="M14 14h3M17 14v3M14 17h3M17 17v3M20 14v.01M20 20v.01"/>
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6 }}>Escanear cupón QR</p>
        <p style={{ fontSize: 13, color: '#5A6070', maxWidth: 320, lineHeight: 1.6 }}>
          Pide al cliente que muestre el QR de su cupón y escanéalo para validarlo automáticamente.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// RedemptionBar — per-coupon usage bar in Canjes tab
// ─────────────────────────────────────────────────────────────────

function RedemptionBar({ coupon }: { coupon: Coupon }) {
  const pct = usagePct(coupon)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: '1px solid #EAECF0', background: '#FFFFFF' }}>
      <div style={{ width: 36, height: 36, borderRadius: 9, background: '#EEF3FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#1A56DB' }}>{coupon.code.slice(0, 4)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{coupon.title}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            {coupon.used_count}{coupon.max_uses ? `/${coupon.max_uses}` : ''}
          </span>
        </div>
        {pct !== null && (
          <div style={{ height: 5, borderRadius: 100, background: '#EAECF0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#1A56DB', borderRadius: 100, transition: 'width 400ms' }} />
          </div>
        )}
        <div style={{ fontSize: 11, color: '#9EA3AE', marginTop: 4 }}>
          <span style={{ fontFamily: 'monospace', letterSpacing: '0.06em' }}>{coupon.code}</span>
          {' · '}{fmt(coupon.discount_type, coupon.discount_value)} de descuento
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [businessId, setBusinessId] = useState('')
  const [coupons, setCoupons]       = useState<Coupon[]>([])
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([])
  const [loading, setLoading]       = useState(true)
  const [activeTab, setActiveTab]   = useState<Tab>('coupons')

  // Form state
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses]         = useState('')
  const [expiresAt, setExpiresAt]     = useState('')
  const [creating, setCreating]       = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createError, setCreateError] = useState('')

  // Focus states for inputs
  const [focusTitle, setFocusTitle]     = useState(false)
  const [focusDesc, setFocusDesc]       = useState(false)
  const [focusType, setFocusType]       = useState(false)
  const [focusValue, setFocusValue]     = useState(false)
  const [focusMax, setFocusMax]         = useState(false)
  const [focusExp, setFocusExp]         = useState(false)

  // UI
  const [qrModalCoupon, setQrModalCoupon] = useState<Coupon | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: biz } = await supabase
      .from('businesses').select('id').eq('owner_id', user.id).single()
    if (!biz) { setLoading(false); return }
    setBusinessId(biz.id)

    const [{ data: couponData }, { data: redemptionData }] = await Promise.all([
      supabase.from('coupons').select('*').eq('business_id', biz.id).order('created_at', { ascending: false }),
      supabase.from('coupon_redemptions')
        .select('*, coupons(title, code, discount_type, discount_value)')
        .eq('business_id', biz.id).order('redeemed_at', { ascending: false }),
    ])

    setCoupons((couponData as Coupon[]) ?? [])
    setRedemptions((redemptionData as CouponRedemption[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Handlers ────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(''); setCreateSuccess(false); setCreating(true)

    const res = await fetch('/api/coupons/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: businessId, title, description: description || undefined,
        discount_type: discountType, discount_value: parseFloat(discountValue),
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
        expires_at: expiresAt || undefined,
      }),
    })
    const json = await res.json()
    setCreating(false)

    if (!res.ok || !json.success) {
      setCreateError(json.error ?? 'Error al crear el cupón')
      return
    }

    setCreateSuccess(true)
    setTitle(''); setDescription(''); setDiscountType('percentage')
    setDiscountValue(''); setMaxUses(''); setExpiresAt('')
    await loadData()
    setTimeout(() => setCreateSuccess(false), 3000)
  }

  async function handleToggle(coupon: Coupon) {
    const res = await fetch('/api/coupons/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ coupon_id: coupon.id, is_active: !coupon.is_active }),
    })
    if (res.ok) setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
  }

  async function handleDelete(coupon: Coupon) {
    if (!window.confirm(`Eliminar el cupón "${coupon.title}"?`)) return
    const res = await fetch('/api/coupons/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ coupon_id: coupon.id }),
    })
    if (res.ok) await loadData()
  }

  async function handleCopyCode(coupon: Coupon) {
    await navigator.clipboard.writeText(coupon.code)
    setCopiedCode(coupon.code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  async function handleCopyLink(coupon: Coupon) {
    await navigator.clipboard.writeText(`${appUrl}/coupon/${coupon.code}`)
    setCopiedLink(coupon.code)
    setTimeout(() => setCopiedLink(null), 2500)
  }

  function handleWhatsApp(coupon: Coupon) {
    const url = `${appUrl}/coupon/${coupon.code}`
    const discount = fmt(coupon.discount_type, coupon.discount_value)
    const text = encodeURIComponent(`Tenemos una oferta especial. Usa el código *${coupon.code}* y obtén *${discount} de descuento*.\n\nAccede aquí: ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  function handleCreatePost(coupon: Coupon) {
    const p = new URLSearchParams({
      promotion_type: 'oferta_2x1',
      context: `Cupón ${coupon.code}: ${fmt(coupon.discount_type, coupon.discount_value)} de descuento`,
    })
    router.push(`/dashboard/create?${p.toString()}`)
  }

  function handleUseCampaign(coupon: Coupon) {
    const p = new URLSearchParams({
      coupon_code: coupon.code, coupon_title: coupon.title,
      coupon_discount: fmt(coupon.discount_type, coupon.discount_value),
    })
    router.push(`/dashboard/campaigns?${p.toString()}`)
  }

  // ── Computed stats ───────────────────────────────────────────────

  const activeCoupons = coupons.filter(c => c.is_active && !isExpired(c))
  const totalUses     = coupons.reduce((s, c) => s + c.used_count, 0)
  const topCoupon     = [...coupons].sort((a, b) => b.used_count - a.used_count)[0]
  const now           = new Date()
  const thisMonth     = redemptions.filter(r => {
    const d = new Date(r.redeemed_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const TABS: { key: Tab; label: string }[] = [
    { key: 'coupons',     label: 'Mis cupones' },
    { key: 'scanner',     label: 'Escanear QR' },
    { key: 'redemptions', label: 'Canjes' },
  ]

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20, maxWidth: 1200 }}>

      {/* Page header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em' }}>Cupones</h1>
        <p style={{ fontSize: 13, color: '#9EA3AE', marginTop: 3 }}>
          Crea cupones y conéctalos a campañas, posts y WhatsApp
        </p>
      </div>

      {/* Stats row */}
      {coupons.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard label="Activos"        value={activeCoupons.length} icon="✅" sub={`de ${coupons.length} cupones`} />
          <StatCard label="Canjes totales" value={totalUses}            icon="🎟" sub="Todos los tiempos" />
          <StatCard label="Este mes"       value={thisMonth.length}     icon="📅" sub="Canjes en el mes" />
          {topCoupon && topCoupon.used_count > 0 && (
            <StatCard label="Más usado" value={topCoupon.code} icon="🏆" sub={`${topCoupon.used_count} canje${topCoupon.used_count !== 1 ? 's' : ''}`} />
          )}
        </div>
      )}

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '296px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left: Create form ── */}
        <div style={{ background: '#FFFFFF', borderRadius: 14, border: '1px solid #EAECF0', padding: '20px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Nuevo cupón</p>
          <p style={{ fontSize: 12, color: '#9EA3AE', marginBottom: 16 }}>El código se genera automáticamente</p>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Título</label>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                required placeholder="Descuento de bienvenida"
                style={inputStyle(focusTitle)}
                onFocus={() => setFocusTitle(true)} onBlur={() => setFocusTitle(false)}
              />
            </div>

            {/* Description */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                Descripción <span style={{ color: '#9EA3AE', fontWeight: 400 }}>(opcional)</span>
              </label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)}
                rows={2} placeholder="Solo válido de lunes a jueves"
                style={{ ...inputStyle(focusDesc), resize: 'none' }}
                onFocus={() => setFocusDesc(true)} onBlur={() => setFocusDesc(false)}
              />
            </div>

            {/* Type + Value */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Tipo</label>
                <select
                  value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}
                  style={inputStyle(focusType)}
                  onFocus={() => setFocusType(true)} onBlur={() => setFocusType(false)}
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Importe fijo</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>
                  Valor ({discountType === 'percentage' ? '%' : '€'})
                </label>
                <input
                  type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                  required min="0.01" step="0.01"
                  placeholder={discountType === 'percentage' ? '15' : '5.00'}
                  style={inputStyle(focusValue)}
                  onFocus={() => setFocusValue(true)} onBlur={() => setFocusValue(false)}
                />
              </div>
            </div>

            {/* Max uses + Expiry */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Usos máximos</label>
                <input
                  type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)}
                  min="1" placeholder="Sin límite"
                  style={inputStyle(focusMax)}
                  onFocus={() => setFocusMax(true)} onBlur={() => setFocusMax(false)}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#374151' }}>Caduca el</label>
                <input
                  type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                  style={inputStyle(focusExp)}
                  onFocus={() => setFocusExp(true)} onBlur={() => setFocusExp(false)}
                />
              </div>
            </div>

            {createError && (
              <div style={{ padding: '9px 12px', borderRadius: 8, background: '#FDE8E8', border: '1px solid #FECACA', fontSize: 12, color: '#E02424' }}>
                {createError}
              </div>
            )}
            {createSuccess && (
              <div style={{ padding: '9px 12px', borderRadius: 8, background: '#DEF7EC', border: '1px solid #A7F3D0', fontSize: 12, fontWeight: 600, color: '#0E9F6E', display: 'flex', alignItems: 'center', gap: 6 }}>
                ✓ Cupón creado correctamente
              </div>
            )}

            <button
              type="submit" disabled={creating || !businessId}
              style={{
                width: '100%', padding: '11px', borderRadius: 9, border: 'none',
                background: (creating || !businessId) ? '#9EB8F4' : 'linear-gradient(135deg, #1A56DB 0%, #2563EB 100%)',
                color: 'white', fontSize: 14, fontWeight: 700,
                cursor: (creating || !businessId) ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: (creating || !businessId) ? 'none' : '0 2px 8px rgba(26,86,219,0.30)',
                transition: 'all 150ms ease', fontFamily: 'inherit',
              }}
            >
              {creating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Creando…
                </>
              ) : '＋ Crear cupón'}
            </button>
          </form>
        </div>

        {/* ── Right: Tabs ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', background: '#FFFFFF', borderRadius: '14px 14px 0 0', border: '1px solid #EAECF0', overflow: 'hidden' }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  flex: 1, padding: '12px 8px', fontSize: 13,
                  fontWeight: activeTab === t.key ? 700 : 400,
                  color: activeTab === t.key ? '#1A56DB' : '#5A6070',
                  background: activeTab === t.key ? '#EEF3FE' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === t.key ? '2px solid #1A56DB' : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 120ms ease', fontFamily: 'inherit',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ background: '#FFFFFF', borderRadius: '0 0 14px 14px', border: '1px solid #EAECF0', borderTop: 'none', padding: '20px 18px', minHeight: 300 }}>

            {/* Tab: Mis cupones */}
            {activeTab === 'coupons' && (
              loading ? (
                <p style={{ fontSize: 13, color: '#9EA3AE' }}>Cargando…</p>
              ) : coupons.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EEF3FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎟</div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Sin cupones todavía</p>
                  <p style={{ fontSize: 13, color: '#9EA3AE', textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
                    Crea tu primer cupón y conéctalo a una campaña de WhatsApp para atraer más clientes.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                  {coupons.map(c => (
                    <CouponCard
                      key={c.id}
                      coupon={c}
                      appUrl={appUrl}
                      copiedCode={copiedCode}
                      copiedLink={copiedLink}
                      onCopyCode={handleCopyCode}
                      onCopyLink={handleCopyLink}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onQR={setQrModalCoupon}
                      onWhatsApp={handleWhatsApp}
                      onCreatePost={handleCreatePost}
                      onUseCampaign={handleUseCampaign}
                    />
                  ))}
                </div>
              )
            )}

            {/* Tab: Scanner */}
            {activeTab === 'scanner' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <ScannerTabEmpty />
                {businessId && <CouponScanner businessId={businessId} />}
              </div>
            )}

            {/* Tab: Canjes */}
            {activeTab === 'redemptions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Per-coupon bars */}
                {coupons.some(c => c.used_count > 0) && (
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9EA3AE', marginBottom: 10 }}>
                      Por cupón
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {coupons
                        .filter(c => c.used_count > 0)
                        .sort((a, b) => b.used_count - a.used_count)
                        .map(c => <RedemptionBar key={c.id} coupon={c} />)
                      }
                    </div>
                  </div>
                )}

                {/* Redemption log */}
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9EA3AE', marginBottom: 10 }}>
                    Historial de canjes
                  </p>
                  {loading ? (
                    <p style={{ fontSize: 13, color: '#9EA3AE' }}>Cargando…</p>
                  ) : redemptions.length === 0 ? (
                    <div style={{ borderRadius: 10, border: '1px dashed #EAECF0', padding: 24, textAlign: 'center' }}>
                      <p style={{ fontSize: 13, color: '#9EA3AE' }}>Aún no hay canjes registrados.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {redemptions.map(r => {
                        const c = r.coupons as { title: string; code: string; discount_type: DiscountType; discount_value: number } | undefined
                        return (
                          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 9, border: '1px solid #EAECF0', background: '#FFFFFF' }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#DEF7EC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0E9F6E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{c?.title ?? 'Cupón'}</p>
                              <p style={{ fontSize: 11, color: '#9EA3AE', marginTop: 1 }}>{formatDateTime(r.redeemed_at)}</p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#1A56DB', background: '#EEF3FE', padding: '2px 8px', borderRadius: 5 }}>
                                {c?.code ?? ''}
                              </span>
                              {c && (
                                <p style={{ fontSize: 12, fontWeight: 700, color: '#0E9F6E', marginTop: 3 }}>
                                  −{fmt(c.discount_type, c.discount_value)}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* QR Modal */}
      {qrModalCoupon && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', padding: 16 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 340, width: '100%', boxShadow: '0 20px 48px rgba(0,0,0,0.2)' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{qrModalCoupon.title}</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: '#1A56DB', marginTop: 4 }}>
                {fmt(qrModalCoupon.discount_type, qrModalCoupon.discount_value)}
              </p>
            </div>
            <CouponQR url={`${appUrl}/coupon/${qrModalCoupon.code}`} size={220} downloadName={qrModalCoupon.code} />
            <button
              onClick={() => setQrModalCoupon(null)}
              style={{ padding: '9px 24px', borderRadius: 9, border: '1px solid #EAECF0', background: '#F4F5F7', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
