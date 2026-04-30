'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

interface FbPage {
  id: string
  name: string
  token: string
}

function FacebookPagesInner() {
  const params = useSearchParams()
  const router = useRouter()
  const pages: FbPage[] = JSON.parse(decodeURIComponent(params.get('pages') ?? '[]'))
  const businessId = params.get('business_id')
  const [selecting, setSelecting] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  async function selectPage(page: FbPage) {
    setSelecting(true)
    setSelectedId(page.id)
    await fetch('/api/connections/facebook-select-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        page_id: page.id,
        page_name: page.name,
        page_token: page.token,
      }),
    })
    router.push('/dashboard/connections?success=facebook')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F9FAFB',
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          border: '1px solid #EAECF0',
          padding: '32px',
          maxWidth: 440,
          width: '90%',
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#111827',
            marginBottom: 8,
            margin: '0 0 8px 0',
          }}
        >
          Selecciona tu pagina de Facebook
        </h2>
        <p
          style={{
            fontSize: 13,
            color: '#5A6070',
            marginBottom: 20,
            margin: '0 0 20px 0',
          }}
        >
          Elige la pagina desde la que quieres publicar.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => selectPage(page)}
              disabled={selecting}
              style={{
                padding: '12px 16px',
                borderRadius: 9,
                border: selectedId === page.id ? '1px solid #2563EB' : '1px solid #EAECF0',
                background: selectedId === page.id ? '#EFF6FF' : '#fff',
                textAlign: 'left',
                cursor: selecting ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 500,
                color: '#111827',
                opacity: selecting && selectedId !== page.id ? 0.5 : 1,
              }}
            >
              {page.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function FacebookPagesPage() {
  return (
    <Suspense>
      <FacebookPagesInner />
    </Suspense>
  )
}
