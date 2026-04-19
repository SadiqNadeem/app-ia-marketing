'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'

interface Question {
  id: string
  type: 'rating' | 'text'
  text: string
  required: boolean
}

interface SurveyData {
  id: string
  name: string
  questions: Question[]
}

interface BusinessData {
  id: string
  name: string
  logo_url: string | null
  primary_color: string
  slug: string | null
  landing_enabled: boolean
}

type Answer = { question_id: string; value: number | string }

type PageState = 'loading' | 'invalid' | 'survey' | 'done'

export default function SurveyPage() {
  const { token } = useParams<{ token: string }>()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [survey, setSurvey] = useState<SurveyData | null>(null)
  const [business, setBusiness] = useState<BusinessData | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`/api/surveys/get-by-token?token=${token}`)
      .then(r => {
        if (r.status === 410 || r.status === 404) {
          setPageState('invalid')
          return null
        }
        return r.json()
      })
      .then(data => {
        if (!data) return
        setSurvey(data.survey)
        setBusiness(data.business)
        setPageState('survey')
      })
      .catch(() => setPageState('invalid'))
  }, [token])

  const primary = business?.primary_color ?? '#2563EB'
  const questions = survey?.questions ?? []
  const currentQuestion = questions[currentIndex]
  const isLast = currentIndex === questions.length - 1

  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined

  const canAdvance =
    currentQuestion &&
    (currentQuestion.required
      ? currentAnswer !== undefined && currentAnswer !== ''
      : true)

  const goNext = useCallback(() => {
    if (!canAdvance) return
    if (isLast) return
    setAnimating(true)
    setTimeout(() => {
      setCurrentIndex(i => i + 1)
      setAnimating(false)
    }, 200)
  }, [canAdvance, isLast])

  const handleSubmit = useCallback(async () => {
    if (!canAdvance || submitting) return
    setSubmitting(true)
    const answersArray: Answer[] = Object.entries(answers).map(([question_id, value]) => ({
      question_id,
      value,
    }))
    try {
      await fetch('/api/surveys/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ token, answers: answersArray }),
      })
      setPageState('done')
    } catch {
      setSubmitting(false)
    }
  }, [canAdvance, submitting, answers, token])

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] px-4">
        <div className="text-center max-w-sm">
          <p className="text-[18px] font-semibold text-[#111827] mb-2">
            Esta encuesta ya no esta disponible
          </p>
          <p className="text-[14px] text-[#374151]">
            Es posible que ya hayas respondido o que el enlace haya expirado.
          </p>
        </div>
      </div>
    )
  }

  if (pageState === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] px-4">
        <div className="text-center max-w-sm">
          <div className="flex justify-center mb-6">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill={primary} fillOpacity="0.12" />
              <circle cx="32" cy="32" r="24" fill={primary} />
              <path
                d="M22 32l7 7 13-13"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-[22px] font-semibold text-[#111827] mb-2">
            Gracias por tu opinion
          </p>
          <p className="text-[14px] text-[#374151] mb-6">
            Tu valoracion nos ayuda a seguir mejorando cada dia
          </p>
          {business?.landing_enabled && business.slug && (
            <Link
              href={`/negocio/${business.slug}` as Route}
              className="text-sm font-medium"
              style={{ color: primary }}
            >
              Ver nuestra pagina
            </Link>
          )}
        </div>
      </div>
    )
  }

  // Survey state
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          {business?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt={business?.name}
              className="w-16 h-16 rounded-xl object-cover mb-3"
            />
          )}
          <p className="text-[20px] font-semibold text-[#111827]">{business?.name}</p>
          <p className="text-[14px] text-[#374151] mt-1">Tu opinion nos ayuda a mejorar</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-[13px] text-[#374151]">
            Pregunta {currentIndex + 1} de {questions.length}
          </p>
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i <= currentIndex ? '24px' : '8px',
                  backgroundColor: i <= currentIndex ? primary : '#E5E7EB',
                }}
              />
            ))}
          </div>
        </div>

        {/* Question card */}
        <div
          className="bg-white rounded-2xl border border-[#E5E7EB] p-6 transition-all duration-200"
          style={{ opacity: animating ? 0 : 1, transform: animating ? 'translateY(8px)' : 'translateY(0)' }}
        >
          {currentQuestion && (
            <>
              <p className="text-[17px] font-semibold text-[#111827] mb-6 leading-snug">
                {currentQuestion.text}
                {!currentQuestion.required && (
                  <span className="ml-2 text-[12px] font-normal text-[#4B5563]">Opcional</span>
                )}
              </p>

              {currentQuestion.type === 'rating' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map(n => {
                      const selected = answers[currentQuestion.id] === n
                      return (
                        <button
                          key={n}
                          onClick={() =>
                            setAnswers(prev => ({ ...prev, [currentQuestion.id]: n }))
                          }
                          className="w-12 h-12 rounded-full border-2 text-[16px] font-semibold transition-all duration-150"
                          style={{
                            borderColor: selected ? primary : '#D1D5DB',
                            backgroundColor: selected ? primary : '#fff',
                            color: selected ? '#fff' : '#374151',
                          }}
                        >
                          {n}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex justify-between w-full text-[12px] text-[#4B5563] px-1">
                    <span>Muy malo</span>
                    <span>Excelente</span>
                  </div>
                </div>
              )}

              {currentQuestion.type === 'text' && (
                <textarea
                  rows={4}
                  placeholder="Escribe tu respuesta aqui..."
                  value={(answers[currentQuestion.id] as string) ?? ''}
                  onChange={e =>
                    setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))
                  }
                  className="w-full border border-[#D1D5DB] rounded-xl px-4 py-3 text-[14px] text-[#111827] placeholder-[#4B5563] resize-none focus:outline-none focus:ring-2"
                  style={{ focusRingColor: primary } as React.CSSProperties}
                />
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-end">
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={!canAdvance || submitting}
              className="px-6 py-3 rounded-xl text-[15px] font-medium text-white transition-all duration-150 disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              {submitting ? 'Enviando...' : 'Enviar'}
            </button>
          ) : (
            <button
              onClick={goNext}
              disabled={!canAdvance}
              className="px-6 py-3 rounded-xl text-[15px] font-medium text-white transition-all duration-150 disabled:opacity-50"
              style={{ backgroundColor: primary }}
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

