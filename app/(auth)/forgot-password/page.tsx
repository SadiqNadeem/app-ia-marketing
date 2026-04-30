'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCountdown, setResendCountdown] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (resendCountdown <= 0) return
    const t = setTimeout(() => setResendCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCountdown])

  async function sendEmail(addr: string) {
    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(addr, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return resetError
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await sendEmail(email)
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
    setResendCountdown(60)
  }

  async function handleResend() {
    setResending(true)
    await sendEmail(email)
    setResending(false)
    setResendCountdown(60)
  }

  return (
    <div style={{ width: '100%', maxWidth: 400 }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 16, padding: '32px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

        {/* Brand */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>P</div>
          {!sent && (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Recuperar contrasena</h1>
              <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Te enviaremos un enlace para restablecer tu contrasena</p>
            </>
          )}
        </div>

        {sent ? (
          /* Success state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <Mail size={28} color="#2563EB" />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>Revisa tu email</h2>
            <p style={{ fontSize: 13, color: '#374151', margin: 0, lineHeight: 1.6 }}>
              Hemos enviado un enlace a <strong>{email}</strong>.<br />Puede tardar unos minutos.
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>No lo encuentras? Revisa la carpeta de spam.</p>

            <button
              onClick={handleResend}
              disabled={resendCountdown > 0 || resending}
              style={{
                marginTop: 8, width: '100%', padding: '10px 0', borderRadius: 10,
                border: '1px solid #E5E7EB', background: '#F9FAFB',
                fontSize: 13, fontWeight: 500, color: resendCountdown > 0 ? '#9CA3AF' : '#374151',
                cursor: resendCountdown > 0 || resending ? 'not-allowed' : 'pointer',
              }}
            >
              {resending ? 'Reenviando...' : resendCountdown > 0 ? `Reenviar email (${resendCountdown}s)` : 'Reenviar email'}
            </button>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{ padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, color: '#DC2626' }}>
                {error}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com" autoComplete="email"
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', background: loading ? '#93C5FD' : '#2563EB', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Enviando...' : 'Enviar enlace'}
            </button>
          </form>
        )}

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
          <Link href="/login" style={{ color: '#2563EB', fontWeight: 500, textDecoration: 'none' }}>
            Volver al inicio de sesion
          </Link>
        </p>
      </div>
    </div>
  )
}
