'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function VerifyEmailContent() {
  const params = useSearchParams()
  const email = params.get('email') ?? 'tu correo'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#F9FAFB',
      padding: '24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #EAECF0',
        padding: '48px 40px',
        maxWidth: 440,
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,.06)',
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: '#EEF3FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Revisa tu correo
        </h1>
        <p style={{ fontSize: 14, color: '#5A6070', lineHeight: 1.6, marginBottom: 4 }}>
          Hemos enviado un enlace de verificacion a
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 24 }}>
          {email}
        </p>
        <p style={{ fontSize: 13, color: '#9EA3AE', lineHeight: 1.6, marginBottom: 28 }}>
          Haz clic en el enlace del correo para activar tu cuenta. Si no lo ves, revisa la carpeta de spam.
        </p>

        <Link
          href="/login"
          style={{
            display: 'block',
            width: '100%',
            padding: '11px 0',
            borderRadius: 8,
            background: '#111827',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}
        >
          Volver al inicio de sesion
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
        <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #1A56DB', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
