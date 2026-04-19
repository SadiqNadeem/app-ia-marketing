'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import type { Business, PromotionType } from '@/types'

// ── Types ────────────────────────────────────────────────────────
type ImageStyle = 'moderno' | 'elegante' | 'divertido' | 'minimalista'

export interface FlyerEditorProps {
  businessId: string
  business: Business
  onSave: (fileUrl: string, thumbnailUrl: string) => void
  initialPromotionType?: PromotionType
}

// ── Option sets ──────────────────────────────────────────────────
const STYLES: { value: ImageStyle; label: string }[] = [
  { value: 'moderno', label: 'Moderno' },
  { value: 'elegante', label: 'Elegante' },
  { value: 'divertido', label: 'Divertido' },
  { value: 'minimalista', label: 'Minimalista' },
]

const PROMOTION_TYPES: { value: PromotionType; label: string }[] = [
  { value: 'oferta_2x1', label: 'Oferta 2x1' },
  { value: 'menu_dia', label: 'Menu del dia' },
  { value: 'happy_hour', label: 'Happy Hour' },
  { value: 'sorteo', label: 'Sorteo' },
  { value: 'evento', label: 'Evento' },
  { value: 'nuevo_producto', label: 'Nuevo producto' },
  { value: 'black_friday', label: 'Black Friday' },
  { value: 'navidad', label: 'Navidad' },
  { value: 'san_valentin', label: 'San Valentin' },
  { value: 'halloween', label: 'Halloween' },
  { value: 'apertura', label: 'Gran apertura' },
  { value: 'aniversario', label: 'Aniversario' },
]

const PROMOTION_LABELS: Record<PromotionType, string> = Object.fromEntries(
  PROMOTION_TYPES.map((p) => [p.value, p.label])
) as Record<PromotionType, string>

const selectClass =
  'w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-primary bg-brand-surface outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-150'

// ── Hex → rgba helper ────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Flyer canvas (pure div, no real <canvas>) ────────────────────
interface FlyerCanvasProps {
  imageUrl: string | null
  mainText: string
  subText: string
  promotionType: PromotionType
  business: Business
}

function FlyerCanvas({
  imageUrl,
  mainText,
  subText,
  promotionType,
  business,
}: FlyerCanvasProps) {
  return (
    // 540 × 540 = 50% of 1080 × 1080
    <div
      className="relative overflow-hidden rounded-xl border border-brand-border"
      style={{ width: 540, height: 540, flexShrink: 0 }}
    >
      {/* Background image */}
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt="Imagen de fondo del flyer"
          fill
          className="object-cover"
          crossOrigin="anonymous"
          unoptimized
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ backgroundColor: hexToRgba(business.primary_color, 0.08) }}
        >
          <p className="text-sm text-brand-text-secondary text-center px-8">
            Genera una imagen para ver el flyer completo
          </p>
        </div>
      )}

      {/* Bottom overlay — primary_color at 80% opacity, height 35% */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: '35%',
          backgroundColor: hexToRgba(business.primary_color, 0.8),
        }}
      />

      {/* Logo — top left */}
      {business.logo_url && (
        <div className="absolute top-4 left-4 w-20 h-20">
          <Image
            src={business.logo_url}
            alt={business.name}
            fill
            className="object-contain"
            crossOrigin="anonymous"
            unoptimized
          />
        </div>
      )}

      {/* Promotion badge — top right */}
      <div className="absolute top-4 right-4">
        <span
          className="text-[13px] font-medium text-white px-3 py-1 rounded-full"
          style={{ backgroundColor: business.secondary_color }}
        >
          {PROMOTION_LABELS[promotionType]}
        </span>
      </div>

      {/* Texts on overlay */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 pt-3" style={{ height: '35%' }}>
        {mainText && (
          <p
            className="text-white font-semibold leading-tight mb-1 line-clamp-2"
            style={{ fontSize: 28 }}
          >
            {mainText}
          </p>
        )}
        {subText && (
          <p
            className="leading-snug line-clamp-2"
            style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)' }}
          >
            {subText}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export function FlyerEditor({ businessId, business, onSave, initialPromotionType }: FlyerEditorProps) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // Form state
  const [style, setStyle] = useState<ImageStyle>('moderno')
  const [promotionType, setPromotionType] = useState<PromotionType>(
    initialPromotionType ?? 'nuevo_producto'
  )
  const [mainText, setMainText] = useState('')
  const [subText, setSubText] = useState('')

  // Status state
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // ── Generate image ─────────────────────────────────────────────
  async function handleGenerate() {
    setError(null)
    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          business_id: businessId,
          promotion_type: promotionType,
          style,
          custom_text: mainText || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Error al generar la imagen')
        return
      }
      setImageUrl(data.image_url)
    } catch {
      setError('Error de conexion. Comprueba tu red e intentalo de nuevo.')
    } finally {
      setIsGenerating(false)
    }
  }

  // ── Export PNG ─────────────────────────────────────────────────
  async function handleExport() {
    if (!canvasRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        width: 540,
        height: 540,
      })
      const link = document.createElement('a')
      link.download = `${business.name.replace(/\s+/g, '_')}_flyer.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('html2canvas error:', err)
      setError('Error al exportar. Asegurate de que la imagen ha cargado completamente.')
    }
  }

  // ── Save to library ────────────────────────────────────────────
  async function handleSave() {
    if (!canvasRef.current) return
    setIsSaving(true)
    setError(null)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(canvasRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,
        width: 540,
        height: 540,
      })

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to convert canvas to blob'))
        }, 'image/png')
      })

      // Upload to Supabase Storage
      const supabase = createClient()
      const path = `${businessId}/flyer_${Date.now()}.png`
      const { error: uploadError } = await supabase.storage
        .from('generated-images')
        .upload(path, blob, { contentType: 'image/png', upsert: false })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage
        .from('generated-images')
        .getPublicUrl(path)

      const fileUrl = urlData.publicUrl

      // Insert into content_library
      const { error: insertError } = await supabase.from('content_library').insert({
        business_id: businessId,
        type: 'flyer',
        file_url: fileUrl,
        thumbnail_url: fileUrl,
        tags: [promotionType, style],
        promotion_type: promotionType,
      })

      if (insertError) throw new Error(insertError.message)

      onSave(fileUrl, fileUrl)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar en la biblioteca')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ── Left: controls ──────────────────────────────────── */}
        <div className="w-full lg:w-[300px] shrink-0">
          <Card>
            <div className="flex flex-col gap-5">
              <PageHeader title="Editor de flyer" />

              {error && (
                <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
                  {error}
                </Badge>
              )}

              {saveSuccess && (
                <Badge variant="success" className="w-full justify-center py-2 rounded-lg text-xs">
                  Guardado en tu biblioteca
                </Badge>
              )}

              {/* Estilo visual */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brand-text-primary">
                  Estilo visual
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as ImageStyle)}
                  className={selectClass}
                >
                  {STYLES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de promocion */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-brand-text-primary">
                  Tipo de promocion
                </label>
                <select
                  value={promotionType}
                  onChange={(e) => setPromotionType(e.target.value as PromotionType)}
                  className={selectClass}
                >
                  {PROMOTION_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <Input
                label="Texto principal"
                type="text"
                placeholder="Ej: 50% de descuento"
                value={mainText}
                onChange={(e) => setMainText(e.target.value)}
              />

              <Input
                label="Texto secundario"
                type="text"
                placeholder="Ej: Solo este fin de semana"
                value={subText}
                onChange={(e) => setSubText(e.target.value)}
              />

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleGenerate}
                  loading={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? 'Generando...' : 'Generar imagen'}
                </Button>
                {imageUrl && (
                  <Button
                    variant="secondary"
                    onClick={handleGenerate}
                    loading={isGenerating}
                    className="w-full"
                  >
                    Regenerar
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right: canvas preview ────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* The ref goes on this wrapper so html2canvas captures exactly 540×540 */}
          <div ref={canvasRef}>
            <FlyerCanvas
              imageUrl={imageUrl}
              mainText={mainText}
              subText={subText}
              promotionType={promotionType}
              business={business}
            />
          </div>

          {/* Canvas actions */}
          <div className="flex gap-3" style={{ width: 540 }}>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={!imageUrl}
              className="flex-1"
            >
              Exportar PNG
            </Button>
            <Button
              onClick={handleSave}
              loading={isSaving}
              disabled={!imageUrl}
              className="flex-1"
            >
              Guardar en biblioteca
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
