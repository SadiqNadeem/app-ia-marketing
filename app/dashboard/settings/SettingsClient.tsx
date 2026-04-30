'use client'

/**
 * Configuración — Rediseño
 * Drop-in replacement for app/dashboard/settings/SettingsClient.tsx
 *
 * Cambios principales:
 *  - Layout de dos columnas por campo (label izq + input der)
 *  - Logo upload con drop zone
 *  - Color pickers con preview de swatch + hex
 *  - Preview de colores en tiempo real
 *  - Zona peligrosa aislada con confirmación inline
 *  - Acciones alineadas a la derecha de cada card
 *  - Sin emojis, tipografía Inter
 */

import { useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { VoiceRecorder } from '@/components/VoiceRecorder'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import type { Business, BusinessCategory, VoiceStatus } from '@/types'

// ── Icons ───────────────────────────────────────────────────────────────────

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  )
}
function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}
function IconLock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES: { value: BusinessCategory; label: string }[] = [
  { value: 'restaurante', label: 'Restaurante' },
  { value: 'peluqueria', label: 'Peluquería' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'gimnasio', label: 'Gimnasio' },
  { value: 'bar', label: 'Bar' },
  { value: 'otro', label: 'Otro' },
]

// ── Shared primitives ────────────────────────────────────────────────────────

function SectionRow({
  title,
  description,
  children,
  divider = true,
}: {
  title: string
  description?: string
  children: React.ReactNode
  divider?: boolean
}) {
  const isMobile = useIsMobile()
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '220px 1fr',
        gap: isMobile ? 8 : 32,
        padding: isMobile ? '16px' : '20px 24px',
        borderBottom: divider ? '1px solid #EAECF0' : 'none',
        alignItems: 'flex-start',
      }}
    >
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 3 }}>{title}</p>
        {description && (
          <p style={{ fontSize: 12, color: '#9EA3AE', lineHeight: 1.5 }}>{description}</p>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}

function SavedIndicator() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: '#16A34A' }}>
      <IconCheck /> Guardado
    </span>
  )
}

function CardFooter({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 24px',
        borderTop: '1px solid #EAECF0',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'flex-end',
      }}
    >
      {children}
    </div>
  )
}

// ── LogoUpload ───────────────────────────────────────────────────────────────

function LogoUpload({
  preview,
  primaryColor,
  businessName,
  onFileChange,
}: {
  preview: string | null
  primaryColor: string
  businessName: string
  onFileChange: (file: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: 10, border: '1px solid #EAECF0',
          background: '#F3F4F6', overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {preview ? (
          <Image src={preview} alt="Logo" width={64} height={64} style={{ objectFit: 'cover' }} />
        ) : (
          <div
            style={{ width: '100%', height: '100%', background: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 700 }}
          >
            {businessName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div
        onClick={() => ref.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false)
          const file = e.dataTransfer.files[0]
          if (file) onFileChange(file)
        }}
        style={{
          flex: 1, height: 64, borderRadius: 9,
          border: `1.5px dashed ${drag ? '#1A56DB' : '#EAECF0'}`,
          background: drag ? '#EEF3FE' : '#FAFAFA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, cursor: 'pointer', transition: 'all 120ms',
        }}
      >
        <span style={{ color: drag ? '#1A56DB' : '#9EA3AE', display: 'flex' }}>
          <IconUpload />
        </span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 500, color: drag ? '#1A56DB' : '#374151' }}>
            Cambiar logo
          </p>
          <p style={{ fontSize: 11, color: '#9EA3AE' }}>PNG, JPG, WebP — máx. 2 MB</p>
        </div>
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f) }}
      />
    </div>
  )
}

// ── ColorPicker ──────────────────────────────────────────────────────────────

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      <div
        onClick={() => ref.current?.click()}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          border: '1px solid #EAECF0', borderRadius: 8, padding: '7px 12px',
          cursor: 'pointer', background: '#fff', transition: 'border-color 120ms',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#D1D5DB' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#EAECF0' }}
      >
        <div
          style={{ width: 22, height: 22, borderRadius: 6, background: value, border: '1px solid rgba(0,0,0,.1)', flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, color: '#111827' }}>{value}</span>
        <input
          ref={ref}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      </div>
    </div>
  )
}

// ── Voice section (Agency only) ──────────────────────────────────────────────

function VoiceSection({ business }: { business: Business }) {
  const router = useRouter()
  const supabase = createClient()
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>(business.voice_status ?? 'none')
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
    setCloning(true); setCloneError(null)
    const form = new FormData()
    const ext = pendingBlob.type.includes('mp4') ? 'm4a' : pendingBlob.type.includes('ogg') ? 'ogg' : pendingBlob.type.includes('webm') ? 'webm' : 'mp3'
    form.append('audio_file', pendingBlob, `voice.${ext}`)
    form.append('business_id', business.id)
    form.append('voice_name', voiceNameInput.trim())
    const res = await fetch('/api/voice/clone', { method: 'POST', body: form })
    const data = await res.json()
    setCloning(false)
    if (data.success) { setVoiceStatus('ready'); setVoiceName(voiceNameInput.trim()); setPendingBlob(null); router.refresh() }
    else { setCloneError(data.error ?? 'Error al clonar la voz'); setVoiceStatus('failed') }
  }

  async function handleCheckStatus() {
    setChecking(true)
    const { data } = await supabase.from('businesses').select('voice_status, voice_name').eq('id', business.id).single()
    setChecking(false)
    if (data) { setVoiceStatus(data.voice_status as VoiceStatus); if (data.voice_name) setVoiceName(data.voice_name) }
  }

  async function handlePreview() {
    setLoadingPreview(true)
    const res = await fetch('/api/voice/generate', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ business_id: business.id, text: 'Bienvenidos a ' + business.name + '. Estamos encantados de atenderte.' }) })
    const data = await res.json()
    setLoadingPreview(false)
    if (data.audio_url) { setPreviewUrl(data.audio_url); setTimeout(() => previewAudioRef.current?.play(), 100) }
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch('/api/voice/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify({ business_id: business.id }) })
    setDeleting(false)
    if (res.ok) { setVoiceStatus('none'); setVoiceName(''); setConfirmDelete(false); router.refresh() }
  }

  if (voiceStatus === 'none') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <VoiceRecorder onRecordingComplete={(blob) => setPendingBlob(blob)} />
      {pendingBlob && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input label="Nombre para tu voz" placeholder="Ej: Voz de María, Voz del chef" value={voiceNameInput} onChange={(e) => setVoiceNameInput(e.target.value)} />
          {cloneError && <p style={{ fontSize: 13, color: '#DC2626' }}>{cloneError}</p>}
          <Button onClick={handleClone} loading={cloning} disabled={!voiceNameInput.trim()}>
            {cloning ? 'Clonando tu voz...' : 'Clonar mi voz'}
          </Button>
        </div>
      )}
    </div>
  )

  if (voiceStatus === 'processing') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Badge variant="warning">Procesando tu voz...</Badge>
      <p style={{ fontSize: 13, color: '#374151' }}>ElevenLabs está procesando tu muestra. Puede tardar 1–2 minutos.</p>
      <Button variant="secondary" loading={checking} onClick={handleCheckStatus}>Comprobar estado</Button>
    </div>
  )

  if (voiceStatus === 'ready') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge variant="success">Voz lista</Badge>
        <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{voiceName}</span>
      </div>
      {business.voice_sample_url && <audio controls src={business.voice_sample_url} style={{ width: '100%' }} />}
      <Button variant="secondary" loading={loadingPreview} onClick={handlePreview}>Probar voz</Button>
      {previewUrl && <audio ref={previewAudioRef} controls src={previewUrl} style={{ width: '100%' }} />}
      {!confirmDelete ? (
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>Eliminar voz</Button>
      ) : (
        <div style={{ padding: 16, borderRadius: 8, border: '1px solid #FCA5A5', background: '#FEF2F2', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: '#991B1B', fontWeight: 500 }}>Se eliminará tu voz de ElevenLabs y la plataforma. Los próximos videos usarán la voz genérica.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>Confirmar eliminación</Button>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Badge variant="error">Error al clonar la voz</Badge>
      {cloneError && <p style={{ fontSize: 13, color: '#DC2626' }}>{cloneError}</p>}
      <Button variant="secondary" onClick={() => setVoiceStatus('none')}>Intentar de nuevo</Button>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

interface SettingsClientProps {
  business: Business
  userEmail: string
  isAdmin?: boolean
}

export function SettingsClient({ business, userEmail, isAdmin }: SettingsClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // General
  const [name, setName] = useState(business.name)
  const [category, setCategory] = useState<BusinessCategory>(business.category)
  const [phone, setPhone] = useState(business.phone ?? '')
  const [address, setAddress] = useState(business.address ?? '')
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [savedGeneral, setSavedGeneral] = useState(false)

  async function saveGeneral() {
    setSavingGeneral(true)
    const { error } = await supabase.from('businesses').update({ name, category, phone: phone || null, address: address || null }).eq('id', business.id)
    setSavingGeneral(false)
    if (!error) { setSavedGeneral(true); router.refresh(); setTimeout(() => setSavedGeneral(false), 3000) }
  }

  // Visual
  const [primaryColor, setPrimaryColor] = useState(business.primary_color)
  const [secondaryColor, setSecondaryColor] = useState(business.secondary_color)
  const [logoPreview, setLogoPreview] = useState<string | null>(business.logo_url)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [savingVisual, setSavingVisual] = useState(false)
  const [savedVisual, setSavedVisual] = useState(false)

  function handleLogoChange(file: File) {
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
        const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, logoFile, { upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('business-assets').getPublicUrl(path)
          logoUrl = urlData.publicUrl
        }
      }
      const { error } = await supabase.from('businesses').update({ primary_color: primaryColor, secondary_color: secondaryColor, logo_url: logoUrl }).eq('id', business.id)
      if (!error) { setSavedVisual(true); router.refresh(); setTimeout(() => setSavedVisual(false), 3000) }
    } finally {
      setSavingVisual(false)
    }
  }

  // Account
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handlePasswordReset() {
    setSendingReset(true)
    await supabase.auth.resetPasswordForEmail(userEmail, { redirectTo: `${window.location.origin}/auth/update-password` })
    setSendingReset(false); setResetSent(true); setTimeout(() => setResetSent(false), 3000)
  }

  async function handleSignOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isMobile = useIsMobile()

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #EAECF0',
    borderRadius: 12,
    boxShadow: '0 1px 3px rgba(0,0,0,.04)',
    overflow: 'hidden',
  }

  const cardHeaderStyle: React.CSSProperties = {
    padding: isMobile ? '12px 16px' : '16px 24px',
    borderBottom: '1px solid #EAECF0',
    fontSize: 13,
    fontWeight: 600,
    color: '#111827',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #EAECF0',
    borderRadius: 8,
    padding: '8px 36px 8px 12px',
    fontSize: 13,
    color: '#111827',
    background: `#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239EA3AE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center`,
    appearance: 'none' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
    cursor: 'pointer',
  }

  return (
    <div style={{ maxWidth: 720, width: '100%', display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20 }}>

      {/* Datos generales */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Datos generales</div>

        <SectionRow title="Nombre del negocio" description="Aparecerá en el contenido generado.">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </SectionRow>

        <SectionRow title="Categoría" description="Define el tipo de negocio para el contenido.">
          <select value={category} onChange={(e) => setCategory(e.target.value as BusinessCategory)} style={selectStyle}>
            {CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </SectionRow>

        <SectionRow title="Teléfono">
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" />
        </SectionRow>

        <SectionRow title="Dirección" divider={false}>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, ciudad, país" />
        </SectionRow>

        <CardFooter>
          {savedGeneral && <SavedIndicator />}
          <Button onClick={saveGeneral} loading={savingGeneral}>Guardar cambios</Button>
        </CardFooter>
      </div>

      {/* Identidad visual */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Identidad visual</div>

        <SectionRow title="Logo" description="Visible en materiales y publicaciones generadas.">
          <LogoUpload
            preview={logoPreview}
            primaryColor={primaryColor}
            businessName={business.name}
            onFileChange={handleLogoChange}
          />
        </SectionRow>

        <SectionRow title="Colores de marca" description="Se usan en el contenido visual generado." divider={false}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ColorPicker label="Color primario"   value={primaryColor}   onChange={setPrimaryColor} />
            <ColorPicker label="Color secundario" value={secondaryColor} onChange={setSecondaryColor} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <div style={{ height: 28, padding: '0 12px', borderRadius: 6, background: primaryColor, display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>Color primario</span>
            </div>
            <div style={{ height: 28, padding: '0 12px', borderRadius: 6, background: secondaryColor, display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>Color secundario</span>
            </div>
          </div>
        </SectionRow>

        <CardFooter>
          {savedVisual && <SavedIndicator />}
          <Button onClick={saveVisual} loading={savingVisual}>Guardar cambios</Button>
        </CardFooter>
      </div>

      {/* Voz personalizada (Agency) */}
      {business.plan === 'agency' && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>Voz personalizada</div>
          <div style={{ padding: '20px 24px' }}>
            <VoiceSection business={business} />
          </div>
        </div>
      )}

      {/* Cuenta */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Cuenta</div>

        <SectionRow title="Email" description="No es posible cambiarlo.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', border: '1px solid #EAECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9EA3AE', flexShrink: 0 }}>
              <IconMail />
            </div>
            <input
              type="email" value={userEmail} readOnly
              style={{ flex: 1, border: '1px solid #EAECF0', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#5A6070', background: '#F9FAFB', outline: 'none', cursor: 'not-allowed', boxSizing: 'border-box' as const }}
            />
          </div>
        </SectionRow>

        <SectionRow title="Contraseña" description="Recibirás un email con el enlace de cambio.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" loading={sendingReset} onClick={handlePasswordReset}>
              <IconLock /> Cambiar contraseña
            </Button>
            {resetSent && <SavedIndicator />}
          </div>
        </SectionRow>

        {/* Danger zone */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #EAECF0' }}>
          <div style={{ padding: 16, borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#DC2626', marginBottom: 4 }}>Zona peligrosa</p>
            <p style={{ fontSize: 12, color: '#991B1B', lineHeight: 1.5, marginBottom: 12 }}>
              Cerrar sesión te desconectará de la plataforma en este dispositivo.
            </p>
            {!confirmLogout ? (
              <Button variant="danger" onClick={() => setConfirmLogout(true)}>
                <IconLogout /> Cerrar sesión
              </Button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#991B1B' }}>¿Confirmas cerrar sesión?</span>
                <Button variant="secondary" size="sm" onClick={() => setConfirmLogout(false)}>Cancelar</Button>
                <Button variant="danger" size="sm" loading={signingOut} onClick={handleSignOut}>Confirmar</Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Administrador */}
      {isAdmin && (
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>Administrador</div>
          <SectionRow title="Ejemplos de IA" description="Gestiona los ejemplos usados para el entrenamiento." divider={false}>
            <a
              href="/admin/examples"
              style={{ fontSize: 13, color: '#1A56DB', fontWeight: 500, textDecoration: 'none' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none' }}
            >
              Gestionar ejemplos de IA
            </a>
          </SectionRow>
        </div>
      )}

    </div>
  )
}
