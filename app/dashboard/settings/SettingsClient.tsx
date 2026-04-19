'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import type { Business, BusinessCategory, VoiceStatus } from '@/types'

const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'peluqueria', label: 'Peluqueria' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'gimnasio', label: 'Gimnasio' },
  { value: 'bar', label: 'Bar' },
  { value: 'otro', label: 'Otro' },
]

const selectClass =
  'w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#111827] bg-white outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all duration-150'

interface SettingsClientProps {
  business: Business
  userEmail: string
}

// ── Voice section sub-component ─────────────────────────────────────────────

function VoiceSection({ business }: { business: Business }) {
  const router = useRouter()

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(
    business.voice_status ?? 'none'
  )
  const [voiceName, setVoiceName] = useState(business.voice_name ?? '')
  const [voiceNameInput, setVoiceNameInput] = useState('')
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null)
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [checking, setChecking] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement>(null)

  async function handleClone() {
    if (!pendingBlob || !voiceNameInput.trim()) return
    setCloning(true)
    setCloneError(null)

    const form = new FormData()
    const ext = pendingBlob.type.includes('mp4') ? 'm4a'
      : pendingBlob.type.includes('ogg') ? 'ogg'
      : pendingBlob.type.includes('webm') ? 'webm'
      : 'mp3'
    form.append('audio_file', pendingBlob, `voice.${ext}`)
    form.append('business_id', business.id)
    form.append('voice_name', voiceNameInput.trim())

    const res = await fetch('/api/voice/clone', { method: 'POST', body: form })
    const data = await res.json()
    setCloning(false)

    if (data.success) {
      setVoiceStatus('ready')
      setVoiceName(voiceNameInput.trim())
      setPendingBlob(null)
      router.refresh()
    } else {
      setCloneError(data.error ?? 'Error al clonar la voz')
      setVoiceStatus('failed')
    }
  }

  async function handleCheckStatus() {
    setChecking(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('businesses')
      .select('voice_status, voice_name')
      .eq('id', business.id)
      .single()
    setChecking(false)
    if (data) {
      setVoiceStatus(data.voice_status as VoiceStatus)
      if (data.voice_name) setVoiceName(data.voice_name)
    }
  }

  async function handlePreview() {
    setLoadingPreview(true)
    const res = await fetch('/api/voice/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: business.id,
        text: 'Bienvenidos a ' + business.name + '. Estamos encantados de atenderte.',
      }),
    })
    const data = await res.json()
    setLoadingPreview(false)
    if (data.audio_url) {
      setPreviewUrl(data.audio_url)
      setTimeout(() => previewAudioRef.current?.play(), 100)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch('/api/voice/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ business_id: business.id }),
    })
    setDeleting(false)
    if (res.ok) {
      setVoiceStatus('none')
      setVoiceName('')
      setConfirmDelete(false)
      router.refresh()
    }
  }

  // none
  if (voiceStatus === 'none') {
    return (
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold text-[#111827] mb-1">Clona tu voz para los videos</h3>
          <p className="text-sm text-[#374151]">
            Graba 2 minutos de tu voz y la IA la clonara. Todos tus videos usaran tu voz real
            automaticamente desde ese momento.
          </p>
        </div>

        <VoiceRecorder onRecordingComplete={(blob) => setPendingBlob(blob)} />

        {pendingBlob && (
          <div className="flex flex-col gap-3">
            <Input
              label="Nombre para tu voz"
              placeholder="Ej: Voz de Maria, Voz del chef"
              value={voiceNameInput}
              onChange={(e) => setVoiceNameInput(e.target.value)}
            />
            {cloneError && (
              <p className="text-sm text-[#EF4444]">{cloneError}</p>
            )}
            <Button
              onClick={handleClone}
              loading={cloning}
              disabled={!voiceNameInput.trim()}
            >
              {cloning ? 'Clonando tu voz... esto puede tardar unos segundos' : 'Clonar mi voz'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // processing
  if (voiceStatus === 'processing') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="warning">Procesando tu voz...</Badge>
        </div>
        <p className="text-sm text-[#374151]">
          ElevenLabs esta procesando tu muestra de voz. Esto puede tardar 1-2 minutos.
        </p>
        <Button variant="secondary" loading={checking} onClick={handleCheckStatus}>
          Comprobar estado
        </Button>
      </div>
    )
  }

  // ready
  if (voiceStatus === 'ready') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="success">Voz lista</Badge>
          <span className="text-sm font-medium text-[#111827]" style={{ fontSize: 14, fontWeight: 500 }}>
            {voiceName}
          </span>
        </div>

        {business.voice_sample_url && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-[#374151]">Muestra original:</p>
            <audio controls src={business.voice_sample_url} className="w-full" />
          </div>
        )}

        <p className="text-sm text-[#374151]">
          Esta voz se usara automaticamente en todos tus videos generados con IA.
        </p>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" loading={loadingPreview} onClick={handlePreview}>
            Probar voz
          </Button>
          {previewUrl && (
            <audio ref={previewAudioRef} controls src={previewUrl} className="w-full" />
          )}
        </div>

        {!confirmDelete ? (
          <Button variant="danger" onClick={() => setConfirmDelete(true)}>
            Eliminar voz
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-4">
            <p className="text-sm text-[#991B1B] font-medium">
              Se eliminara tu voz clonada tanto en ElevenLabs como en la plataforma.
              Los proximos videos usaran la voz generica.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" loading={deleting} onClick={handleDelete}>
                Confirmar eliminacion
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // failed
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="error">Error al clonar la voz</Badge>
      </div>
      {cloneError && <p className="text-sm text-[#EF4444]">{cloneError}</p>}
      <p className="text-sm text-[#374151]">
        Hubo un problema al procesar tu muestra de voz.
      </p>
      <Button variant="secondary" onClick={() => setVoiceStatus('none')}>
        Intentar de nuevo
      </Button>
    </div>
  )
}

// ── Main settings component ──────────────────────────────────────────────────

export function SettingsClient({ business, userEmail }: SettingsClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // ── Card 1: General data ─────────────────────────────────────────
  const [name, setName] = useState(business.name)
  const [category, setCategory] = useState<BusinessCategory>(business.category)
  const [phone, setPhone] = useState(business.phone ?? '')
  const [address, setAddress] = useState(business.address ?? '')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savedGeneral, setSavedGeneral] = useState(false)

  async function saveGeneral() {
    setSavingGeneral(true)
    const { error } = await supabase
      .from('businesses')
      .update({ name, category, phone: phone || null, address: address || null })
      .eq('id', business.id)
    setSavingGeneral(false)
    if (!error) {
      setSavedGeneral(true)
      router.refresh()
      setTimeout(() => setSavedGeneral(false), 3000)
    }
  }

  // ── Card 2: Visual identity ──────────────────────────────────────
  const [primaryColor, setPrimaryColor] = useState(business.primary_color)
  const [secondaryColor, setSecondaryColor] = useState(business.secondary_color)
  const [logoPreview, setLogoPreview] = useState<string | null>(business.logo_url)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [savingVisual, setSavingVisual] = useState(false)
  const [savedVisual, setSavedVisual] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function saveVisual() {
    setSavingVisual(true)
    try {
      let logoUrl = business.logo_url

      if (logoFile) {
        const ext = logoFile.name.split('.').pop()
        const path = `${business.id}/logo.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('business-assets')
          .upload(path, logoFile, { upsert: true })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('business-assets')
            .getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }

      const { error } = await supabase
        .from('businesses')
        .update({ primary_color: primaryColor, secondary_color: secondaryColor, logo_url: logoUrl })
        .eq('id', business.id)

      if (!error) {
        setSavedVisual(true)
        router.refresh()
        setTimeout(() => setSavedVisual(false), 3000)
      }
    } finally {
      setSavingVisual(false)
    }
  }

  // ── Card 3: Account ──────────────────────────────────────────────
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handlePasswordReset() {
    setSendingReset(true)
    await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })
    setSendingReset(false)
    setResetSent(true)
    setTimeout(() => setResetSent(false), 3000)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Card 1 — General data */}
      <Card padding="md" className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-[#111827]">Datos generales</h2>

        <Input
          label="Nombre del negocio"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#111827]">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as BusinessCategory)}
            className={selectClass}
          >
            {CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Telefono"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+34 600 000 000"
        />

        <Input
          label="Direccion"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Calle, ciudad, pais"
        />

        <div className="flex items-center gap-3">
          <Button onClick={saveGeneral} loading={savingGeneral}>
            Guardar cambios
          </Button>
          {savedGeneral && (
            <Badge variant="success">Guardado correctamente</Badge>
          )}
        </div>
      </Card>

      {/* Card 2 — Visual identity */}
      <Card padding="md" className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-[#111827]">Identidad visual</h2>

        {/* Logo preview + upload */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium text-[#111827]">Logo</label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0">
                <Image src={logoPreview} alt="Logo" fill className="object-cover" />
              </div>
            ) : (
              <div
                className="w-16 h-16 rounded-lg shrink-0 flex items-center justify-center text-white font-semibold text-xl"
                style={{ backgroundColor: primaryColor }}
              >
                {business.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Cambiar logo
              </Button>
              <span className="text-xs text-[#374151]">PNG, JPG, WebP — max 2 MB</span>
            </div>
          </div>
        </div>

        {/* Color pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#111827]">Color primario</label>
            <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-sm text-[#111827] font-mono">{primaryColor}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#111827]">Color secundario</label>
            <div className="flex items-center gap-2 border border-[#E5E7EB] rounded-lg px-3 py-2">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-sm text-[#111827] font-mono">{secondaryColor}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={saveVisual} loading={savingVisual}>
            Guardar cambios
          </Button>
          {savedVisual && (
            <Badge variant="success">Guardado correctamente</Badge>
          )}
        </div>
      </Card>

      {/* Card 3 — My voice (Agency only) */}
      {business.plan === 'agency' && (
        <Card padding="md" className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-[#111827]">Mi voz personalizada</h2>
          <VoiceSection business={business} />
        </Card>
      )}

      {/* Card 4 — Account */}
      <Card padding="md" className="flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-[#111827]">Cuenta</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[#111827]">Email</label>
          <input
            type="email"
            value={userEmail}
            readOnly
            className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm text-[#374151] bg-[#F7F8FA] cursor-not-allowed"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              loading={sendingReset}
              onClick={handlePasswordReset}
            >
              Cambiar contrasena
            </Button>
            {resetSent && (
              <Badge variant="success">Email enviado</Badge>
            )}
          </div>
          <p className="text-xs text-[#374151]">
            Recibirás un email con instrucciones para cambiar tu contrasena.
          </p>
        </div>

        <div className="border-t border-[#E5E7EB] pt-4">
          <Button
            variant="danger"
            loading={signingOut}
            onClick={handleSignOut}
          >
            Cerrar sesion
          </Button>
        </div>
      </Card>
    </div>
  )
}

