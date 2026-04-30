'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PageState = 'loading' | 'ready' | 'expired' | 'success'

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

export default function ResetPasswordPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Check if we already have a session (token from URL auto-exchanges)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setPageState('ready'); return }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setPageState('ready')
      if (event === 'SIGNED_IN')         setPageState('ready')
    })

    // If no event after 4s, token is expired/invalid
    const timeout = setTimeout(() => {
      setPageState((s) => s === 'loading' ? 'expired' : s)
    }, 4000)

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La contrasena debe tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contrasenas no coinciden'); return }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) { setError(updateError.message); return }
    setPageState('success')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  const strength = strengthLabel(password)

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        <div style={{ width: 36, height: 36, borderRadius: 9, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>P</div>

        {pageState === 'loading' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
            <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>Verificando enlace...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {pageState === 'expired' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Enlace expirado</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px', lineHeight: 1.5 }}>Este enlace ha expirado o ya fue utilizado. Solicita uno nuevo.</p>
            <Link href="/forgot-password" style={{ display: 'block', width: '100%', padding: '11px 0', borderRadius: 10, background: '#2563EB', color: '#FFFFFF', fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>
              Solicitar nuevo enlace
            </Link>
          </div>
        )}

        {pageState === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Contrasena actualizada</h2>
            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Redirigiendo al dashboard...</p>
          </div>
        )}

        {pageState === 'ready' && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Nueva contrasena</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 24px' }}>Elige una contrasena segura para tu cuenta</p>

            {error && (
              <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Nueva contrasena</label>
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 8 caracteres" autoComplete="new-password"
                  style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
                />
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: strength.width, background: strength.color, borderRadius: 2, transition: 'width 0.3s, background 0.3s' }} />
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: strength.color, fontWeight: 600 }}>{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Confirmar contrasena</label>
                <input
                  type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contrasena" autoComplete="new-password"
                  style={{ width: '100%', border: `1px solid ${confirm && confirm !== password ? '#DC2626' : '#E5E7EB'}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                  onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                  onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                />
                {confirm && confirm !== password && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>Las contrasenas no coinciden</p>
                )}
              </div>

              <button
                type="submit" disabled={loading}
                style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: loading ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
              >
                {loading ? 'Guardando...' : 'Cambiar contrasena'}
              </button>
            </form>

            <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
              <Link href="/login" style={{ color: '#2563EB', fontWeight: 500, textDecoration: 'none' }}>Volver al inicio de sesion</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
