'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function ConnectSocialsModal({ show }: { show: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (show) {
      const dismissed = localStorage.getItem('publify_socials_modal_dismissed')
      if (!dismissed) setVisible(true)
    }
  }, [show])

  function dismiss() {
    localStorage.setItem('publify_socials_modal_dismissed', '1')
    setVisible(false)
  }

  function goConnect() {
    dismiss()
    router.push('/dashboard/connections')
  }

  if (!visible) return null

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '36px 32px',
          maxWidth: 420,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: '#EEF3FE',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Conecta tus redes sociales
        </h2>
        <p style={{ fontSize: 14, color: '#5A6070', lineHeight: 1.6, marginBottom: 28 }}>
          Para empezar a publicar y gestionar tu contenido, conecta al menos una red social. Solo tarda un minuto.
        </p>

        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {[
            { name: 'Instagram', color: '#E1306C' },
            { name: 'Facebook',  color: '#1877F2' },
            { name: 'TikTok',   color: '#010101' },
            { name: 'Google',   color: '#4285F4' },
          ].map(({ name, color }) => (
            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{name[0]}</span>
              </div>
              <span style={{ fontSize: 10, color: '#9EA3AE' }}>{name}</span>
            </div>
          ))}
        </div>

        <button
          onClick={goConnect}
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: 9,
            background: '#2563EB',
            border: 'none',
            color: 'white',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        >
          Conectar redes sociales
        </button>

        <button
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 13,
            color: '#9EA3AE',
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'inherit',
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
