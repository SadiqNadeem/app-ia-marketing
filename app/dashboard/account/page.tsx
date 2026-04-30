'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, UserCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Helpers ────────────────────────────────────────────────────────────────────

function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return email
  const visible = user.slice(0, 2)
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 2))}@${domain}`
}

function strengthLabel(pwd: string): { label: string; color: string; width: string } {
  if (pwd.length === 0) return { label: '', color: '#E5E7EB', width: '0%' }
  const hasUpper = /[A-Z]/.test(pwd)
  const hasNum   = /\d/.test(pwd)
  const hasSpec  = /[^A-Za-z0-9]/.test(pwd)
  const score    = [pwd.length >= 8, hasUpper, hasNum, hasSpec].filter(Boolean).length
  if (score <= 1) return { label: 'Debil',  color: '#DC2626', width: '33%' }
  if (score <= 2) return { label: 'Media',  color: '#D97706', width: '66%' }
  return                { label: 'Fuerte', color: '#16A34A', width: '100%' }
}

function parseUA(ua: string): string {
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  return 'Navegador desconocido'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14, padding: '24px', marginBottom: 16 }
const LABEL: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 4, display: 'block' }
const INPUT: React.CSSProperties = { width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }
const BTN_PRIMARY: React.CSSProperties = { padding: '10px 18px', borderRadius: 8, border: 'none', background: '#2563EB', color: '#FFFFFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const BTN_GHOST: React.CSSProperties = { padding: '10px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const BTN_DANGER: React.CSSProperties = { padding: '10px 18px', borderRadius: 8, border: '1px solid #FECACA', background: 'transparent', color: '#DC2626', fontSize: 13, fontWeight: 500, cursor: 'pointer' }

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter()
  const supabase = createClient()

  const [userEmail, setUserEmail]   = useState('')
  const [sessionDate, setSessionDate] = useState('')
  const [userAgent, setUserAgent]   = useState('')
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)

  // Email modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail]             = useState('')
  const [confirmEmail, setConfirmEmail]     = useState('')
  const [emailLoading, setEmailLoading]     = useState(false)
  const [emailError, setEmailError]         = useState<string | null>(null)

  // Password modal
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [currentPwd, setCurrentPwd]     = useState('')
  const [newPwd, setNewPwd]             = useState('')
  const [confirmPwd, setConfirmPwd]     = useState('')
  const [pwdLoading, setPwdLoading]     = useState(false)
  const [pwdError, setPwdError]         = useState<string | null>(null)

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm]     = useState('')
  const [deleting, setDeleting]               = useState(false)

  const strength = strengthLabel(newPwd)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUserEmail(session.user.email ?? '')
      setSessionDate(new Date(session.user.last_sign_in_at ?? Date.now()).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))
    })
    setUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  // ── Change email ───────────────────────────────────────────────────────────
  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault()
    setEmailError(null)
    if (!newEmail.includes('@')) { setEmailError('Email no valido'); return }
    if (newEmail !== confirmEmail) { setEmailError('Los emails no coinciden'); return }
    setEmailLoading(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailLoading(false)
    if (error) { setEmailError(error.message); return }
    setShowEmailModal(false); setNewEmail(''); setConfirmEmail('')
    showToast('Te hemos enviado un email de confirmacion al nuevo correo')
  }

  // ── Change password ────────────────────────────────────────────────────────
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError(null)
    if (!currentPwd) { setPwdError('Introduce tu contrasena actual'); return }
    if (newPwd.length < 8) { setPwdError('La nueva contrasena debe tener al menos 8 caracteres'); return }
    if (newPwd !== confirmPwd) { setPwdError('Las contrasenas no coinciden'); return }

    setPwdLoading(true)
    // Verify current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPwd })
    if (signInErr) { setPwdLoading(false); setPwdError('La contrasena actual no es correcta'); return }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPwd })
    setPwdLoading(false)
    if (updateErr) { setPwdError(updateErr.message); return }
    setShowPwdModal(false); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    showToast('Contrasena actualizada correctamente')
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Delete account ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (deleteConfirm !== 'ELIMINAR') return
    setDeleting(true)
    // Delete business data first, then sign out (actual deletion needs admin API)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.from('businesses').delete().eq('owner_id', session.user.id)
    }
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Mi cuenta</h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Gestiona tu acceso y datos personales</p>
      </div>

      {/* Section 1: Datos de acceso */}
      <div style={CARD}>
        <p style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Datos de acceso</p>

        {/* Email row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #F3F4F6', marginBottom: 16 }}>
          <div>
            <span style={LABEL}>Email</span>
            <p style={{ margin: 0, fontSize: 14, color: '#374151', fontFamily: 'monospace' }}>{maskEmail(userEmail)}</p>
          </div>
          <button onClick={() => setShowEmailModal(true)} style={BTN_GHOST}>Cambiar email</button>
        </div>

        {/* Password row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={LABEL}>Contrasena</span>
            <p style={{ margin: 0, fontSize: 16, color: '#374151', letterSpacing: 3 }}>••••••••</p>
          </div>
          <button onClick={() => setShowPwdModal(true)} style={BTN_GHOST}>Cambiar contrasena</button>
        </div>
      </div>

      {/* Section 2: Sesion actual */}
      <div style={CARD}>
        <p style={{ margin: '0 0 18px', fontSize: 14, fontWeight: 700, color: '#111827' }}>Sesion actual</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <span style={LABEL}>Dispositivo</span>
            <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{parseUA(userAgent)}</p>
          </div>
          <div>
            <span style={LABEL}>Ultimo inicio de sesion</span>
            <p style={{ margin: 0, fontSize: 13, color: '#374151' }}>{sessionDate || '—'}</p>
          </div>
        </div>
        <button onClick={handleSignOut} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...BTN_GHOST }}>
          <LogOut size={14} /> Cerrar sesion
        </button>
      </div>

      {/* Section 3: Danger zone */}
      <div style={{ ...CARD, border: '1px solid #FECACA', marginBottom: 0 }}>
        <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#DC2626' }}>Zona de peligro</p>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6B7280' }}>
          Una vez eliminada tu cuenta, todos los datos se perderan de forma permanente.
        </p>
        <button onClick={() => setShowDeleteModal(true)} style={BTN_DANGER}>Eliminar mi cuenta</button>
      </div>

      {/* ── Modals ── */}

      {showEmailModal && (
        <Modal title="Cambiar email" onClose={() => { setShowEmailModal(false); setEmailError(null); setNewEmail(''); setConfirmEmail('') }}>
          <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {emailError && <div style={{ padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{emailError}</div>}
            <div>
              <label style={{ ...LABEL }}>Nuevo email</label>
              <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="nuevo@email.com" style={INPUT}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={{ ...LABEL }}>Confirmar nuevo email</label>
              <input type="email" required value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="nuevo@email.com" style={{ ...INPUT, borderColor: confirmEmail && confirmEmail !== newEmail ? '#DC2626' : '#E5E7EB' }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }} />
              {confirmEmail && confirmEmail !== newEmail && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>Los emails no coinciden</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => setShowEmailModal(false)} style={BTN_GHOST}>Cancelar</button>
              <button type="submit" disabled={emailLoading} style={{ ...BTN_PRIMARY, opacity: emailLoading ? 0.7 : 1, cursor: emailLoading ? 'not-allowed' : 'pointer' }}>
                {emailLoading ? 'Enviando...' : 'Enviar confirmacion'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showPwdModal && (
        <Modal title="Cambiar contrasena" onClose={() => { setShowPwdModal(false); setPwdError(null); setCurrentPwd(''); setNewPwd(''); setConfirmPwd('') }}>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pwdError && <div style={{ padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>{pwdError}</div>}
            <div>
              <label style={{ ...LABEL }}>Contrasena actual</label>
              <input type="password" required value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Tu contrasena actual" autoComplete="current-password" style={INPUT}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
            <div>
              <label style={{ ...LABEL }}>Nueva contrasena</label>
              <input type="password" required value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Minimo 8 caracteres" autoComplete="new-password" style={INPUT}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }} />
              {newPwd.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: strength.width, background: strength.color, borderRadius: 2, transition: 'width 0.3s' }} />
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label style={{ ...LABEL }}>Confirmar nueva contrasena</label>
              <input type="password" required value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repite la contrasena" autoComplete="new-password"
                style={{ ...INPUT, borderColor: confirmPwd && confirmPwd !== newPwd ? '#DC2626' : '#E5E7EB' }}
                onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }} />
              {confirmPwd && confirmPwd !== newPwd && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>Las contrasenas no coinciden</p>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={() => setShowPwdModal(false)} style={BTN_GHOST}>Cancelar</button>
              <button type="submit" disabled={pwdLoading} style={{ ...BTN_PRIMARY, opacity: pwdLoading ? 0.7 : 1, cursor: pwdLoading ? 'not-allowed' : 'pointer' }}>
                {pwdLoading ? 'Guardando...' : 'Cambiar contrasena'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showDeleteModal && (
        <Modal title="Eliminar cuenta" onClose={() => { setShowDeleteModal(false); setDeleteConfirm('') }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', lineHeight: 1.5 }}>
              Esta accion es permanente e irreversible. Se eliminaran todos los datos de tu negocio.
            </div>
            <div>
              <label style={{ ...LABEL }}>Escribe ELIMINAR para confirmar</label>
              <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="ELIMINAR" style={INPUT}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#DC2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={BTN_GHOST}>Cancelar</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'ELIMINAR' || deleting}
                style={{ ...BTN_PRIMARY, background: deleteConfirm === 'ELIMINAR' ? '#DC2626' : '#FCA5A5', cursor: deleteConfirm !== 'ELIMINAR' || deleting ? 'not-allowed' : 'pointer' }}
              >
                {deleting ? 'Eliminando...' : 'Eliminar cuenta'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 300, borderRadius: 10, padding: '10px 16px', color: '#FFFFFF', background: toast.ok ? '#059669' : '#DC2626', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontSize: 13, fontWeight: 600 }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
