'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CouponQR } from '@/components/CouponQR'
import { CouponScanner } from '@/components/CouponScanner'
import type { Coupon, CouponRedemption, DiscountType } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDiscount(type: DiscountType, value: number): string {
  if (type === 'percentage') return `${value}%`
  return `${value} €`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function isExpired(coupon: Coupon): boolean {
  return !!coupon.expires_at && new Date(coupon.expires_at) < new Date()
}

function couponStatus(coupon: Coupon): {
  variant: 'success' | 'neutral' | 'error'
  label: string
} {
  if (isExpired(coupon)) return { variant: 'error', label: 'Expirado' }
  if (!coupon.is_active) return { variant: 'neutral', label: 'Inactivo' }
  return { variant: 'success', label: 'Activo' }
}

function conversionRate(coupon: Coupon): string {
  if (!coupon.max_uses || coupon.max_uses === 0) return '—'
  return `${Math.round((coupon.used_count / coupon.max_uses) * 100)}%`
}

function discountDelivered(coupon: Coupon): string {
  if (coupon.discount_type === 'fixed') {
    return `${(coupon.used_count * coupon.discount_value).toFixed(0)} €`
  }
  return `${coupon.used_count} canj.`
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'coupons' | 'scanner' | 'redemptions'

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '10px 16px',
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        border: '1px solid #EAECF0',
        minWidth: 100,
      }}
    >
      <span style={{ fontSize: 11, color: '#9EA3AE', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>
        {value}
      </span>
    </div>
  )
}

// ── Icon buttons ──────────────────────────────────────────────────────────────

function ActionBtn({
  onClick,
  title,
  children,
  color = '#5A6070',
  bg = '#F4F5F7',
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
  color?: string
  bg?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 10px',
        borderRadius: 7,
        fontSize: 11,
        fontWeight: 500,
        color,
        backgroundColor: bg,
        border: '1px solid #EAECF0',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

// ── Coupon Card ───────────────────────────────────────────────────────────────

interface CouponCardProps {
  coupon: Coupon
  appUrl: string
  copiedCode: string | null
  copiedLink: string | null
  onCopyCode: (coupon: Coupon) => void
  onCopyLink: (coupon: Coupon) => void
  onToggle: (coupon: Coupon) => void
  onDelete: (coupon: Coupon) => void
  onQR: (coupon: Coupon) => void
  onWhatsApp: (coupon: Coupon) => void
  onCreatePost: (coupon: Coupon) => void
  onUseCampaign: (coupon: Coupon) => void
}

function CouponCard({
  coupon,
  copiedCode,
  copiedLink,
  onCopyCode,
  onCopyLink,
  onToggle,
  onDelete,
  onQR,
  onWhatsApp,
  onCreatePost,
  onUseCampaign,
}: CouponCardProps) {
  const { variant, label } = couponStatus(coupon)
  const usagePercent =
    coupon.max_uses && coupon.max_uses > 0
      ? Math.min(100, (coupon.used_count / coupon.max_uses) * 100)
      : null
  const isMaxed = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses

  return (
    <div
      style={{
        borderRadius: 10,
        border: '1px solid #EAECF0',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Color band top */}
      <div
        style={{
          height: 3,
          backgroundColor:
            variant === 'success' ? '#0E9F6E' : variant === 'error' ? '#E02424' : '#9EA3AE',
        }}
      />

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>
              {coupon.title}
            </p>
            {coupon.description && (
              <p style={{ fontSize: 11, color: '#9EA3AE', marginTop: 2 }}>{coupon.description}</p>
            )}
          </div>
          <Badge variant={variant}>{label}</Badge>
        </div>

        {/* Discount value — protagonist */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#1A56DB', letterSpacing: '-0.5px' }}>
            {formatDiscount(coupon.discount_type, coupon.discount_value)}
          </span>
          <span style={{ fontSize: 12, color: '#5A6070' }}>
            {coupon.discount_type === 'percentage' ? 'de descuento' : 'fijo'}
          </span>
        </div>

        {/* Code box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#F4F5F7',
            borderRadius: 8,
            padding: '8px 12px',
            border: '1px solid #EAECF0',
          }}
        >
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 15,
              fontWeight: 700,
              color: '#111827',
              letterSpacing: '0.12em',
              flex: 1,
            }}
          >
            {coupon.code}
          </span>
          <button
            onClick={() => onCopyCode(coupon)}
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: copiedCode === coupon.code ? '#0E9F6E' : '#1A56DB',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: '2px 6px',
              borderRadius: 5,
              transition: 'color 120ms ease',
              flexShrink: 0,
            }}
          >
            {copiedCode === coupon.code ? 'Copiado' : 'Copiar codigo'}
          </button>
        </div>

        {/* Tracking metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {[
            {
              label: 'Usos',
              value: coupon.max_uses
                ? `${coupon.used_count} / ${coupon.max_uses}`
                : `${coupon.used_count}`,
            },
            {
              label: 'Conversion',
              value: conversionRate(coupon),
            },
            {
              label: coupon.discount_type === 'fixed' ? 'Descuento dado' : 'Canjes totales',
              value: discountDelivered(coupon),
            },
          ].map(({ label: l, value }) => (
            <div
              key={l}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '8px 10px',
                borderRadius: 8,
                backgroundColor: '#F4F5F7',
              }}
            >
              <span style={{ fontSize: 10, color: '#9EA3AE', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {l}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Usage progress bar */}
        {usagePercent !== null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                backgroundColor: '#EAECF0',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${usagePercent}%`,
                  borderRadius: 999,
                  backgroundColor: isMaxed ? '#E02424' : '#1A56DB',
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            {isMaxed && (
              <p style={{ fontSize: 10, color: '#E02424', fontWeight: 500 }}>
                Limite de usos alcanzado
              </p>
            )}
          </div>
        )}

        {/* Expiry */}
        {coupon.expires_at && (
          <p style={{ fontSize: 11, color: isExpired(coupon) ? '#E02424' : '#9EA3AE' }}>
            {isExpired(coupon) ? 'Expiro el ' : 'Caduca el '}{formatDate(coupon.expires_at)}
          </p>
        )}

        {/* Action buttons row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
          <ActionBtn onClick={() => onCreatePost(coupon)} title="Crear post con este cupon" color="#1A56DB" bg="#EEF3FE">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M8 12h8M12 8v8" />
            </svg>
            Crear post
          </ActionBtn>

          <ActionBtn onClick={() => onWhatsApp(coupon)} title="Enviar por WhatsApp" color="#0E9F6E" bg="#DEF7EC">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            WhatsApp
          </ActionBtn>

          <ActionBtn onClick={() => onUseCampaign(coupon)} title="Usar en campana" color="#D97706" bg="#FFF8E6">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            Campana
          </ActionBtn>

          <ActionBtn onClick={() => onQR(coupon)} title="Ver codigo QR" color="#5A6070" bg="#F4F5F7">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h3M17 14v3M14 17h3M17 17v3M20 14v.01M20 20v.01" />
            </svg>
            Ver QR
          </ActionBtn>

          <ActionBtn onClick={() => onCopyLink(coupon)} title="Copiar enlace publico" color="#5A6070" bg="#F4F5F7">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
            {copiedLink === coupon.code ? 'Copiado' : 'Copiar link'}
          </ActionBtn>
        </div>

        {/* Secondary: toggle + delete */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            paddingTop: 4,
            borderTop: '1px solid #EAECF0',
          }}
        >
          <button
            onClick={() => onToggle(coupon)}
            style={{
              fontSize: 11,
              color: '#5A6070',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
              transition: 'color 120ms ease',
            }}
          >
            {coupon.is_active ? 'Desactivar' : 'Activar'}
          </button>
          <span style={{ color: '#EAECF0', fontSize: 12 }}>|</span>
          <button
            onClick={() => onDelete(coupon)}
            style={{
              fontSize: 11,
              color: '#E02424',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              padding: 0,
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CouponsPage() {
  const router = useRouter()
  const [businessId, setBusinessId] = useState('')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('coupons')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [creating, setCreating] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createError, setCreateError] = useState('')

  // UI state
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
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (!biz) { setLoading(false); return }
    setBusinessId(biz.id)

    const [{ data: couponData }, { data: redemptionData }] = await Promise.all([
      supabase
        .from('coupons')
        .select('*')
        .eq('business_id', biz.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('coupon_redemptions')
        .select('*, coupons(title, code, discount_type, discount_value)')
        .eq('business_id', biz.id)
        .order('redeemed_at', { ascending: false }),
    ])

    setCoupons((couponData as Coupon[]) ?? [])
    setRedemptions((redemptionData as CouponRedemption[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess(false)
    setCreating(true)

    const res = await fetch('/api/coupons/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: businessId,
        title,
        description: description || undefined,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        max_uses: maxUses ? parseInt(maxUses, 10) : undefined,
        expires_at: expiresAt || undefined,
      }),
    })

    const json = await res.json()
    setCreating(false)

    if (!res.ok || !json.success) {
      setCreateError(json.error ?? 'Error al crear el cupon')
      return
    }

    setCreateSuccess(true)
    setTitle('')
    setDescription('')
    setDiscountType('percentage')
    setDiscountValue('')
    setMaxUses('')
    setExpiresAt('')
    await loadData()
    setTimeout(() => setCreateSuccess(false), 3000)
  }

  async function handleToggle(coupon: Coupon) {
    const res = await fetch('/api/coupons/toggle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ coupon_id: coupon.id, is_active: !coupon.is_active }),
    })
    if (res.ok) {
      setCoupons(prev =>
        prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c)
      )
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (!window.confirm(`Eliminar el cupon "${coupon.title}"?`)) return
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
    const url = `${appUrl}/coupon/${coupon.code}`
    await navigator.clipboard.writeText(url)
    setCopiedLink(coupon.code)
    setTimeout(() => setCopiedLink(null), 2500)
  }

  function handleWhatsApp(coupon: Coupon) {
    const couponUrl = `${appUrl}/coupon/${coupon.code}`
    const discount = formatDiscount(coupon.discount_type, coupon.discount_value)
    const text = encodeURIComponent(
      `Tenemos una oferta especial para ti. Usa el codigo *${coupon.code}* y obtén *${discount} de descuento*.\n\nAccede aqui: ${couponUrl}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  function handleCreatePost(coupon: Coupon) {
    const params = new URLSearchParams({
      promotion_type: 'oferta_2x1',
      context: `Cupon ${coupon.code}: ${formatDiscount(coupon.discount_type, coupon.discount_value)} de descuento`,
    })
    router.push(`/dashboard/create?${params.toString()}`)
  }

  function handleUseCampaign(coupon: Coupon) {
    const params = new URLSearchParams({
      coupon_code: coupon.code,
      coupon_title: coupon.title,
      coupon_discount: formatDiscount(coupon.discount_type, coupon.discount_value),
    })
    router.push(`/dashboard/campaigns?${params.toString()}`)
  }

  // ── Computed stats ───────────────────────────────────────────────────────────

  const activeCoupons = coupons.filter(c => c.is_active && !isExpired(c))
  const totalUses = coupons.reduce((sum, c) => sum + c.used_count, 0)
  const topCoupon = [...coupons].sort((a, b) => b.used_count - a.used_count)[0]

  const now = new Date()
  const redemptionsThisMonth = redemptions.filter(r => {
    const d = new Date(r.redeemed_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })


  const TABS: { key: Tab; label: string }[] = [
    { key: 'coupons', label: 'Mis cupones' },
    { key: 'scanner', label: 'Escanear QR' },
    { key: 'redemptions', label: 'Canjes' },
  ]

  const inputClass =
    'text-sm border border-[#EAECF0] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1A56DB] text-[#111827] placeholder:text-[#9EA3AE] bg-white transition-colors duration-[120ms]'

  return (
    <div className="p-6 flex flex-col gap-6 max-w-[1200px]">
      <PageHeader title="Cupones" subtitle="Crea cupones y conectalos a campanas, posts y WhatsApp" />

      {/* ── Global stats ── */}
      {coupons.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <StatPill label="Activos" value={activeCoupons.length} />
          <StatPill label="Canjes totales" value={totalUses} />
          <StatPill label="Este mes" value={redemptionsThisMonth.length} />
          {topCoupon && topCoupon.used_count > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '10px 16px',
                borderRadius: 10,
                backgroundColor: '#FFFFFF',
                border: '1px solid #EAECF0',
              }}
            >
              <span style={{ fontSize: 11, color: '#9EA3AE', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Mas usado
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                {topCoupon.code}
              </span>
              <span style={{ fontSize: 11, color: '#5A6070' }}>
                {topCoupon.used_count} canje{topCoupon.used_count !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ── Left: Create form ── */}
        <Card padding="md" className="flex flex-col gap-5">
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Nuevo cupon</p>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#5A6070] font-medium">Titulo</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                placeholder="Descuento de bienvenida"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#5A6070] font-medium">Descripcion <span className="font-normal text-[#9EA3AE]">(opcional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Solo valido de lunes a jueves"
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#5A6070] font-medium">Tipo</label>
                <select
                  value={discountType}
                  onChange={e => setDiscountType(e.target.value as DiscountType)}
                  className={inputClass}
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Importe fijo</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#5A6070] font-medium">
                  Valor ({discountType === 'percentage' ? '%' : '€'})
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(e.target.value)}
                  required
                  min="0.01"
                  max={discountType === 'percentage' ? '100' : undefined}
                  step="0.01"
                  placeholder={discountType === 'percentage' ? '15' : '5.00'}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#5A6070] font-medium">Usos maximos</label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={e => setMaxUses(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="Sin limite"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#5A6070] font-medium">Caduca el</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            {createError && (
              <p className="text-xs text-[#E02424]">{createError}</p>
            )}
            {createSuccess && (
              <Badge variant="success">Cupon creado correctamente</Badge>
            )}

            <Button type="submit" loading={creating} disabled={!businessId} className="w-full">
              Crear cupon
            </Button>
          </form>
        </Card>

        {/* ── Right: tabs ── */}
        <div className="flex flex-col gap-4">
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #EAECF0' }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: activeTab === key ? 600 : 400,
                  color: activeTab === key ? '#1A56DB' : '#5A6070',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  borderBottom: activeTab === key ? '2px solid #1A56DB' : '2px solid transparent',
                  marginBottom: -1,
                  background: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 120ms ease',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab: Mis cupones */}
          {activeTab === 'coupons' && (
            <div className="flex flex-col gap-3">
              {loading ? (
                <p style={{ fontSize: 13, color: '#9EA3AE' }}>Cargando...</p>
              ) : coupons.length === 0 ? (
                <div
                  style={{
                    borderRadius: 10,
                    border: '1px dashed #EAECF0',
                    padding: '40px 24px',
                    textAlign: 'center',
                  }}
                >
                  <p style={{ fontSize: 13, color: '#9EA3AE' }}>
                    Aun no has creado ningun cupon.
                  </p>
                  <p style={{ fontSize: 12, color: '#9EA3AE', marginTop: 4 }}>
                    Crea tu primer cupon y conectalo a una campana de WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {coupons.map(coupon => (
                    <CouponCard
                      key={coupon.id}
                      coupon={coupon}
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
              )}
            </div>
          )}

          {/* Tab: Escanear QR */}
          {activeTab === 'scanner' && (
            <div className="flex flex-col gap-3">
              <p style={{ fontSize: 13, color: '#5A6070' }}>
                Pide al cliente que muestre el QR de su cupon y escanéalo para validarlo.
              </p>
              {businessId && <CouponScanner businessId={businessId} />}
            </div>
          )}

          {/* Tab: Canjes */}
          {activeTab === 'redemptions' && (
            <div className="flex flex-col gap-4">
              {/* Per-coupon breakdown */}
              {coupons.some(c => c.used_count > 0) && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9EA3AE', marginBottom: 10 }}>
                    Por cupon
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {coupons
                      .filter(c => c.used_count > 0)
                      .sort((a, b) => b.used_count - a.used_count)
                      .map(c => {
                        const pct = c.max_uses ? (c.used_count / c.max_uses) * 100 : null
                        return (
                          <div
                            key={c.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: '1px solid #EAECF0',
                              backgroundColor: '#FFFFFF',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#111827', letterSpacing: '0.08em' }}>
                                  {c.code}
                                </span>
                                <span style={{ fontSize: 11, color: '#5A6070' }}>{c.title}</span>
                              </div>
                              {pct !== null && (
                                <div style={{ height: 4, borderRadius: 999, backgroundColor: '#EAECF0', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, backgroundColor: '#1A56DB', borderRadius: 999 }} />
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                                {c.used_count}
                              </p>
                              <p style={{ fontSize: 10, color: '#9EA3AE' }}>
                                {c.discount_type === 'fixed'
                                  ? `${(c.used_count * c.discount_value).toFixed(0)} € dado`
                                  : conversionRate(c) !== '—' ? `${conversionRate(c)} uso` : 'sin limite'}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Redemption log */}
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9EA3AE', marginBottom: 10 }}>
                  Historial de canjes
                </p>
                {loading ? (
                  <p style={{ fontSize: 13, color: '#9EA3AE' }}>Cargando...</p>
                ) : redemptions.length === 0 ? (
                  <div style={{ borderRadius: 10, border: '1px dashed #EAECF0', padding: 24, textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: '#9EA3AE' }}>Aun no hay canjes registrados.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {redemptions.map(r => {
                      const c = r.coupons as {
                        title: string
                        code: string
                        discount_type: DiscountType
                        discount_value: number
                      } | undefined
                      return (
                        <div
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 8,
                            border: '1px solid #EAECF0',
                            backgroundColor: '#FFFFFF',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>
                              {c?.title ?? 'Cupon'}
                            </p>
                            <p style={{ fontSize: 11, color: '#9EA3AE', marginTop: 2 }}>
                              {formatDateTime(r.redeemed_at)}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#1A56DB',
                                backgroundColor: '#EEF3FE',
                                padding: '2px 7px',
                                borderRadius: 5,
                              }}
                            >
                              {c?.code ?? ''}
                            </span>
                            {c && (
                              <p style={{ fontSize: 11, color: '#0E9F6E', fontWeight: 600, marginTop: 3 }}>
                                -{formatDiscount(c.discount_type, c.discount_value)}
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

      {/* ── QR Modal ── */}
      {qrModalCoupon && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
            padding: 16,
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 12,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              maxWidth: 340,
              width: '100%',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{qrModalCoupon.title}</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1A56DB', marginTop: 4 }}>
                {formatDiscount(qrModalCoupon.discount_type, qrModalCoupon.discount_value)}
              </p>
            </div>

            <CouponQR
              url={`${appUrl}/coupon/${qrModalCoupon.code}`}
              size={220}
              downloadName={qrModalCoupon.code}
            />

            <p
              style={{
                fontFamily: 'monospace',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: '#111827',
              }}
            >
              {qrModalCoupon.code}
            </p>

            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button
                onClick={() => handleCopyCode(qrModalCoupon)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  border: '1px solid #EAECF0',
                  backgroundColor: '#F4F5F7',
                  color: '#5A6070',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {copiedCode === qrModalCoupon.code ? 'Copiado' : 'Copiar codigo'}
              </button>
              <button
                onClick={() => setQrModalCoupon(null)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  border: '1px solid #EAECF0',
                  backgroundColor: '#FFFFFF',
                  color: '#5A6070',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

