export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex' }}>

      {/* ── Left panel — form ─────────────────────────────────────────── */}
      <div
        className="relative w-full md:w-1/2 flex items-center justify-center px-6 py-12
                   bg-transparent md:bg-white"
        style={{ zIndex: 1 }}
      >
        {/* Mobile: image as full-screen background (hidden on desktop) */}
        <div
          className="md:hidden"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: -1,
            backgroundImage: 'url(/auth-bg.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Dark overlay so the text is readable */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.55)' }} />
        </div>

        {/* Form content */}
        <div style={{ width: '100%', maxWidth: 400 }}>
          {children}
        </div>
      </div>

      {/* ── Right panel — image (desktop only) ───────────────────────── */}
      <div
        className="hidden md:block md:w-1/2 relative overflow-hidden"
        style={{
          backgroundImage: 'url(/auth-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          /* Fallback while the image isn't set yet */
          background: 'linear-gradient(135deg, #1A56DB 0%, #111827 100%)',
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(160deg, rgba(26,86,219,0.25) 0%, rgba(17,24,39,0.50) 100%)',
          }}
        />

        {/* Branding at bottom-left */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 48,
            color: '#FFFFFF',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1A56DB',
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              P
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
              Publify
            </span>
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 500,
              opacity: 0.85,
              margin: 0,
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            Marketing con IA para hacer crecer tu negocio
          </p>
        </div>
      </div>

    </div>
  )
}
