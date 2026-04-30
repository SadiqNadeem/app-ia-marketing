import type { ReactNode } from 'react'

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 16px' }}>
      {children}
    </main>
  )
}
