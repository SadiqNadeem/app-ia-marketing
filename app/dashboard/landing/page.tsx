'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LandingBusiness {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  primary_color: string
  category: string
  phone: string | null
  address: string | null
  landing_enabled: boolean
  landing_description: string | null
  landing_gallery: string[]
  landing_show_menu: boolean
  landing_show_reviews: boolean
  landing_cta_text: string
  landing_cta_phone: boolean
  landing_cta_whatsapp: boolean
  landing_cta_maps: boolean
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-blue-500' : 'bg-[#D1D5DB]'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  )
}

// ── Landing preview ───────────────────────────────────────────────────────────

interface PreviewProps {
  biz: LandingBusiness
  gallery: string[]
}

function LandingPreview({ biz, gallery }: PreviewProps) {
  const accentColor = biz.primary_color || '#2563EB'
  const phone = biz.phone?.replace(/\s+/g, '') ?? null
  const waPhone = phone?.replace(/^\+/, '') ?? null
  const mapsQuery = biz.address ? encodeURIComponent(`${biz.name} ${biz.address}`) : null

  return (
    <div
      style={{
        width: 375, fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#F9FAFB', overflowY: 'auto', maxHeight: 680,
        borderRadius: 20, border: '1px solid #E5E7EB', boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
      }}
    >
      {/* Hero */}
      <div style={{ backgroundColor: `${accentColor}18`, padding: '40px 24px', textAlign: 'center' }}>
        {biz.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={biz.logo_url}
            alt=""
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', margin: '0 auto 12px', display: 'block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          />
        )}
        <p style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{biz.name || 'Tu negocio'}</p>
        <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px' }}>
          {biz.category}{biz.address ? ` en ${biz.address.split(',').pop()?.trim() ?? biz.address}` : ''}
        </p>
        {biz.landing_description && (
          <p style={{ fontSize: 13, color: '#374151', margin: '0 0 16px' }}>{biz.landing_description}</p>
        )}

        {/* CTA buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          {biz.landing_cta_phone && phone && (
            <span style={{ backgroundColor: accentColor, color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
              {biz.landing_cta_text || 'Llamar'}
            </span>
          )}
          {biz.landing_cta_whatsapp && waPhone && (
            <span style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', color: '#111827', padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
              WhatsApp
            </span>
          )}
          {biz.landing_cta_maps && mapsQuery && (
            <span style={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', color: '#111827', padding: '8px 16px', borderRadius: 8, fontSize: 13 }}>
              Ver en Maps
            </span>
          )}
        </div>
      </div>

      {/* Gallery preview */}
      {gallery.length > 0 && (
        <div style={{ padding: '20px 16px 0' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>Nuestro espacio</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {gallery.slice(0, 6).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        </div>
      )}

      {/* Contact preview */}
      <div style={{ padding: '20px 16px' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 10px' }}>Contacto</p>
        {biz.address && (
          <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px' }}>{biz.address}</p>
        )}
        {biz.phone && (
          <p style={{ fontSize: 13, color: accentColor, margin: '0 0 6px' }}>{biz.phone}</p>
        )}
      </div>

      {/* Footer */}
      <div style={{ backgroundColor: '#111827', padding: '20px 16px', textAlign: 'center' }}>
        <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>{biz.name || 'Tu negocio'}</p>
        <p style={{ color: '#4B5563', fontSize: 11, margin: 0 }}>Creado con MarketingIA</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LandingPage() {
  const supabase = createClient()

  const [biz, setBiz] = useState<LandingBusiness | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [copied, setCopied] = useState(false)

  // Editable state
  const [enabled, setEnabled] = useState(false)
  const [description, setDescription] = useState('')
  const [gallery, setGallery] = useState<string[]>([])
  const [showMenu, setShowMenu] = useState(true)
  const [showReviews, setShowReviews] = useState(true)
  const [ctaText, setCtaText] = useState('Contactanos')
  const [ctaPhone, setCtaPhone] = useState(true)
  const [ctaWhatsapp, setCtaWhatsapp] = useState(true)
  const [ctaMaps, setCtaMaps] = useState(true)

  const [uploadingImg, setUploadingImg] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: business } = await supabase
      .from('businesses')
      .select('id, name, slug, logo_url, primary_color, category, phone, address, landing_enabled, landing_description, landing_gallery, landing_show_menu, landing_show_reviews, landing_cta_text, landing_cta_phone, landing_cta_whatsapp, landing_cta_maps')
      .eq('owner_id', user.id)
      .single()

    if (business) {
      const b = business as LandingBusiness
      setBiz(b)
      setEnabled(b.landing_enabled)
      setDescription(b.landing_description ?? '')
      setGallery((b.landing_gallery as string[]) ?? [])
      setShowMenu(b.landing_show_menu)
      setShowReviews(b.landing_show_reviews)
      setCtaText(b.landing_cta_text ?? 'Contactanos')
      setCtaPhone(b.landing_cta_phone)
      setCtaWhatsapp(b.landing_cta_whatsapp)
      setCtaMaps(b.landing_cta_maps)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Build preview object from live state
  const previewBiz: LandingBusiness | null = biz
    ? {
        ...biz,
        landing_enabled: enabled,
        landing_description: description || null,
        landing_gallery: gallery,
        landing_show_menu: showMenu,
        landing_show_reviews: showReviews,
        landing_cta_text: ctaText,
        landing_cta_phone: ctaPhone,
        landing_cta_whatsapp: ctaWhatsapp,
        landing_cta_maps: ctaMaps,
      }
    : null

  async function handleSave() {
    if (!biz) return
    setSaving(true)

    await fetch('/api/landing/save', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: biz.id,
        landing_enabled: enabled,
        landing_description: description || null,
        landing_show_menu: showMenu,
        landing_show_reviews: showReviews,
        landing_cta_text: ctaText,
        landing_cta_phone: ctaPhone,
        landing_cta_whatsapp: ctaWhatsapp,
        landing_cta_maps: ctaMaps,
      }),
    })

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  async function handleGalleryUpload(file: File) {
    if (!biz) return
    if (gallery.length >= 12) return

    setUploadingImg(true)
    const form = new FormData()
    form.append('file', file)
    form.append('business_id', biz.id)

    const res = await fetch('/api/landing/upload-gallery', { method: 'POST', body: form })
    if (res.ok) {
      const data = await res.json()
      setGallery(data.gallery ?? [...gallery, data.image_url])
    }
    setUploadingImg(false)
    if (galleryInputRef.current) galleryInputRef.current.value = ''
  }

  async function handleDeleteImage(url: string) {
    if (!biz) return
    const res = await fetch('/api/landing/delete-gallery-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: biz.id, image_url: url }),
    })
    if (res.ok) {
      const data = await res.json()
      setGallery(data.gallery ?? gallery.filter((u) => u !== url))
    }
  }

  async function handleCopy() {
    if (!biz?.slug) return
    await navigator.clipboard.writeText(`${appUrl}/negocio/${biz.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="p-8 text-sm text-[#374151]">Cargando...</div>
  }

  if (!biz) {
    return <div className="p-8 text-sm text-[#374151]">No se encontro el negocio.</div>
  }

  const publicUrl = biz.slug ? `${appUrl}/negocio/${biz.slug}` : null

  return (
    <div className="p-6 pb-28 max-w-[1280px] mx-auto">
      <PageHeader title="Mi pagina web" subtitle="Tu presencia online en un solo enlace" />

      <div className="flex flex-col lg:flex-row gap-6 mt-6">

        {/* ── Editor column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">

          {/* Card 1 — Activation */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-[#111827]">Estado de la pagina</p>
                {publicUrl && (
                  <p className="text-xs text-[#374151] mt-0.5 break-all">{publicUrl}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'Activa' : 'Inactiva'}</Badge>
                <Toggle checked={enabled} onChange={setEnabled} />
              </div>
            </div>
            {publicUrl && enabled && (
              <div className="flex items-center gap-2 mt-2">
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#2563EB] hover:underline"
                >
                  Ver mi pagina
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs border border-[#E5E7EB] rounded px-2 py-1 text-[#374151] hover:text-[#111827]"
                >
                  {copied ? 'Copiado' : 'Copiar enlace'}
                </button>
              </div>
            )}
          </Card>

          {/* Card 2 — Description */}
          <Card>
            <p className="text-sm font-semibold text-[#111827] mb-3">Descripcion</p>
            <textarea
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#374151] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Describe tu negocio en pocas palabras..."
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-[#4B5563] text-right mt-1">{description.length} / 300</p>
          </Card>

          {/* Card 3 — Gallery */}
          <Card>
            <p className="text-sm font-semibold text-[#111827] mb-3">
              Galeria de fotos ({gallery.length}/12)
            </p>

            {gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {gallery.map((url) => (
                  <div key={url} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(url)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}

            {gallery.length < 12 && (
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadingImg}
                className="w-full border-2 border-dashed border-[#D1D5DB] rounded-xl py-4 text-sm text-[#374151] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
              >
                {uploadingImg ? 'Subiendo...' : '+ Anadir foto (JPG, PNG, WebP — max 5MB)'}
              </button>
            )}
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleGalleryUpload(f) }}
            />
          </Card>

          {/* Card 4 — Visible sections */}
          <Card>
            <p className="text-sm font-semibold text-[#111827] mb-4">Secciones visibles</p>
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between">
                <span className="text-sm text-[#374151]">Mostrar carta / menu</span>
                <Toggle checked={showMenu} onChange={setShowMenu} />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-[#374151]">Mostrar resenas de Google</span>
                <Toggle checked={showReviews} onChange={setShowReviews} />
              </label>
            </div>
          </Card>

          {/* Card 5 — CTA buttons */}
          <Card>
            <p className="text-sm font-semibold text-[#111827] mb-4">Botones de contacto</p>
            <div className="flex flex-col gap-3 mb-4">
              <label className="flex items-center justify-between">
                <span className="text-sm text-[#374151]">Boton de llamada</span>
                <Toggle checked={ctaPhone} onChange={setCtaPhone} />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-[#374151]">Boton de WhatsApp</span>
                <Toggle checked={ctaWhatsapp} onChange={setCtaWhatsapp} />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-[#374151]">Boton de Google Maps</span>
                <Toggle checked={ctaMaps} onChange={setCtaMaps} />
              </label>
            </div>
            <div>
              <p className="text-xs text-[#374151] mb-1">Texto del boton principal</p>
              <input
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={ctaText}
                placeholder="Contactanos"
                onChange={(e) => setCtaText(e.target.value)}
                maxLength={40}
              />
            </div>
          </Card>
        </div>

        {/* ── Preview column ── */}
        <div className="lg:w-[420px] shrink-0 flex flex-col items-center gap-3">
          <p className="text-xs text-[#374151] self-start">Vista previa (375px)</p>
          {previewBiz && <LandingPreview biz={previewBiz} gallery={gallery} />}
        </div>
      </div>

      {/* Floating save button */}
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-[#E5E7EB] px-6 py-3 flex items-center gap-4 z-20">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
        {savedMsg && <Badge variant="success">Cambios guardados</Badge>}
      </div>
    </div>
  )
}

