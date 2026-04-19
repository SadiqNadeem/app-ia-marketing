'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function OpenSurveyPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!id) return
    fetch('/api/surveys/public-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ survey_id: id }),
    })
      .then(r => {
        if (!r.ok) { setError(true); return null }
        return r.json()
      })
      .then(data => {
        if (data?.token) router.replace(`/encuesta/${data.token}`)
        else setError(true)
      })
      .catch(() => setError(true))
  }, [id, router])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7] px-4">
        <div className="text-center max-w-sm">
          <p className="text-[18px] font-semibold text-[#111827] mb-2">
            Esta encuesta no esta disponible
          </p>
          <p className="text-[14px] text-[#5A6070]">
            Es posible que haya sido desactivada o que el enlace no sea valido.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7]">
      <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

