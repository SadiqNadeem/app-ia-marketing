'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { generateBusinessSlug } from '@/lib/business-slug'
import type { BusinessCategory } from '@/types'

const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'peluqueria', label: 'Peluqueria' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'gimnasio', label: 'Gimnasio' },
  { value: 'bar', label: 'Bar' },
  { value: 'otro', label: 'Otro' },
]

// ── Step indicator ────────────────────────────────────────────────
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            'h-1.5 rounded-full transition-all duration-300',
            i < current ? 'bg-brand-primary flex-1' : 'bg-brand-border flex-1',
          ].join(' ')}
        />
      ))}
      <span className="text-xs text-brand-text-secondary whitespace-nowrap ml-1">
        Paso {current} de {total}
      </span>
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Step 1 fields
  const [name, setName] = useState('')
  const [category, setCategory] = useState<BusinessCategory>('restaurante')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  // Step 2 fields
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#2563EB')
  const [secondaryColor, setSecondaryColor] = useState('#111827')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if user already has a business → skip onboarding
  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (data) {
        router.push('/dashboard')
        return
      }
      setChecking(false)
    }
    check()
  }, [router])

  // ── Logo handling ──────────────────────────────────────────────
  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return
    setLogoFile(file)
    const url = URL.createObjectURL(file)
    setLogoPreview(url)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  // ── Step 1 submit ─────────────────────────────────────────────
  function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setStep(2)
  }

  // ── Final submit ──────────────────────────────────────────────
  async function handleFinish(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      let logoUrl: string | null = null

      // Upload logo if selected
      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(path, logoFile, { upsert: true })

        if (uploadError) throw new Error('Error al subir el logo: ' + uploadError.message)

        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
        logoUrl = urlData.publicUrl
      }

      // Insert business (get id first via select after insert)
      const { data: inserted, error: insertError } = await supabase.from('businesses').insert({
        owner_id: user.id,
        name: name.trim(),
        category,
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        plan: 'basic',
      }).select('id').single()

      if (!insertError && inserted) {
        const slug = generateBusinessSlug(name.trim(), inserted.id)
        await supabase.from('businesses').update({ slug }).eq('id', inserted.id)
      }

      if (insertError) throw new Error(insertError.message)


      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
      setLoading(false)
    }
  }

  // ── Loading state while checking business ─────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <Card className="w-full max-w-[520px]" padding="lg">
      <StepIndicator current={step} total={2} />

      {/* ── PASO 1 ────────────────────────────────────────────── */}
      {step === 1 && (
        <form onSubmit={handleStep1} className="flex flex-col gap-5">
          <PageHeader
            title="Cuentanos sobre tu negocio"
            subtitle="Esta informacion personaliza todo el contenido que genera la IA"
          />

          <Input
            label="Nombre del negocio"
            type="text"
            placeholder="Ej: Restaurante La Plaza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-brand-text-primary">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BusinessCategory)}
              className="w-full rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-text-primary bg-brand-surface outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all duration-150"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <Input
            label="Telefono"
            type="tel"
            placeholder="+34 600 000 000 (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <Input
            label="Direccion"
            type="text"
            placeholder="Calle, ciudad... (opcional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <Button type="submit" className="w-full mt-2">
            Continuar
          </Button>
        </form>
      )}

      {/* ── PASO 2 ────────────────────────────────────────────── */}
      {step === 2 && (
        <form onSubmit={handleFinish} className="flex flex-col gap-5">
          <PageHeader
            title="Identidad visual de tu negocio"
            subtitle="La IA usara tu logo y colores en todos los disenos"
          />

          {error && (
            <Badge variant="error" className="w-full justify-center py-2 rounded-lg text-xs">
              {error}
            </Badge>
          )}

          {/* Logo upload */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-brand-text-primary">Logo</span>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={[
                'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-150 min-h-[140px]',
                dragOver
                  ? 'border-brand-primary bg-blue-50'
                  : 'border-brand-border hover:border-brand-primary hover:bg-brand-bg',
              ].join(' ')}
            >
              {logoPreview ? (
                <div className="relative w-24 h-24">
                  <Image
                    src={logoPreview}
                    alt="Vista previa del logo"
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-sm text-brand-text-secondary text-center px-4">
                    Arrastra tu logo aqui o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-brand-text-secondary">PNG o JPG</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </div>
            {logoPreview && (
              <button
                type="button"
                onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                className="text-xs text-brand-text-secondary hover:text-brand-error transition-colors duration-150 self-start"
              >
                Eliminar logo
              </button>
            )}
          </div>

          {/* Color pickers */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-brand-text-primary">Color principal</label>
              <div className="flex items-center gap-2 border border-brand-border rounded-lg px-3 py-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-sm text-brand-text-primary font-mono">{primaryColor}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium text-brand-text-primary">Color secundario</label>
              <div className="flex items-center gap-2 border border-brand-border rounded-lg px-3 py-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-sm text-brand-text-primary font-mono">{secondaryColor}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              Atras
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              Finalizar y entrar al dashboard
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
