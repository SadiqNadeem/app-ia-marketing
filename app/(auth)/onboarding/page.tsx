'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight, ArrowLeft, BedDouble, Dumbbell, GraduationCap, Heart,
  Home, Scissors, ShoppingBag, ShoppingCart, Stethoscope,
  TrendingUp, UtensilsCrossed, Eye,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateBusinessSlug } from '@/lib/business-slug'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3 | 4 | 5

interface BizType { id: string; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }
interface GoalType { id: string; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }

const BIZ_TYPES: BizType[] = [
  { id: 'restaurante',  label: 'Restaurante',  Icon: UtensilsCrossed },
  { id: 'peluqueria',   label: 'Peluqueria',   Icon: Scissors        },
  { id: 'tienda',       label: 'Tienda',        Icon: ShoppingBag     },
  { id: 'gimnasio',     label: 'Gimnasio',      Icon: Dumbbell        },
  { id: 'clinica',      label: 'Clinica',       Icon: Stethoscope     },
  { id: 'hotel',        label: 'Hotel',         Icon: BedDouble       },
  { id: 'academia',     label: 'Academia',      Icon: GraduationCap   },
  { id: 'inmobiliaria', label: 'Inmobiliaria',  Icon: Home            },
]

const GOALS: GoalType[] = [
  { id: 'clientes',    label: 'Conseguir mas clientes',        Icon: TrendingUp  },
  { id: 'ventas',      label: 'Aumentar mis ventas',           Icon: ShoppingCart},
  { id: 'visibilidad', label: 'Ganar mas visibilidad online',  Icon: Eye         },
  { id: 'fidelizar',   label: 'Fidelizar mis clientes actuales', Icon: Heart     },
]

// ── Progress bar widths per step ──────────────────────────────────────────────
const PROGRESS: Record<number, string> = { 2: '33%', 3: '66%', 4: '100%' }

// ── Transition timing ─────────────────────────────────────────────────────────
const FADE_OUT_MS = 280
const FADE_IN_MS  = 500

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking,   setChecking]   = useState(true)
  const [step,       setStep]       = useState<Step>(0)
  const [visible,    setVisible]    = useState(true)   // content opacity
  const [userName,   setUserName]   = useState('')
  const [userId,     setUserId]     = useState('')
  const [userEmail,  setUserEmail]  = useState('')

  // Form state
  const [bizType,    setBizType]    = useState('')
  const [bizName,    setBizName]    = useState('')
  const [city,       setCity]       = useState('')
  const [goal,       setGoal]       = useState('')
  const [saving,     setSaving]     = useState(false)

  // Detect first render for step 5 animations
  const step5Rendered = useRef(false)

  // ── Initial check ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      setUserId(user.id)
      setUserEmail(user.email ?? '')
      // Use email prefix as name until they provide one
      const rawName = (user.user_metadata?.full_name as string | undefined)
        || user.email?.split('@')[0]
        || 'usuario'
      // First word only, max 14 chars to avoid overflow on hero
      const firstName = rawName.split(/[\s._@]/)[0]
      setUserName(firstName.length > 14 ? firstName.slice(0, 14) : firstName)

      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (biz) { router.push('/dashboard'); return }
      setChecking(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-advance: step 0 → 1 (2.5s), step 1 → 2 (3s) ─────────────────────
  useEffect(() => {
    if (checking) return
    if (step === 0) {
      const t = setTimeout(() => goTo(1), 2500)
      return () => clearTimeout(t)
    }
    if (step === 1) {
      const t = setTimeout(() => goTo(2), 3000)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, checking])

  // ── Save on step 5 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (step === 5 && !step5Rendered.current) {
      step5Rendered.current = true
      saveBusiness()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // ── Transition helper ──────────────────────────────────────────────────────
  function goTo(next: Step) {
    setVisible(false)
    setTimeout(() => {
      setStep(next)
      setVisible(true)
    }, FADE_OUT_MS)
  }

  // ── Save business ──────────────────────────────────────────────────────────
  async function saveBusiness() {
    if (!userId || !bizName) return
    setSaving(true)
    try {
      const payload = {
        owner_id:        userId,
        name:            bizName.trim(),
        category:        bizType || 'otro',
        address:         city.trim() || null,
        plan:            'basic' as const,
        primary_color:   '#2563EB',
        secondary_color: '#111827',
      }

      // Upsert in case there's a partial record
      const { data: inserted } = await supabase
        .from('businesses')
        .insert(payload)
        .select('id')
        .single()

      if (inserted) {
        const slug = generateBusinessSlug(bizName.trim(), inserted.id)
        await supabase.from('businesses').update({ slug }).eq('id', inserted.id)
      }
    } catch { /* swallow — user can still navigate to dashboard */ }
    finally { setSaving(false) }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  const showProgress = step >= 2 && step <= 4
  const progressWidth = PROGRESS[step] ?? '0%'
  const canContinue2 = bizType !== ''
  const canContinue3 = bizName.trim().length > 0 && city.trim().length > 0
  const canContinue4 = goal !== ''

  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF', position: 'relative', overflow: 'hidden' }}>

      {/* Decorative background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 60% 40%, rgba(200,210,255,0.25) 0%, transparent 60%),
          radial-gradient(ellipse at 30% 70%, rgba(180,200,255,0.15) 0%, transparent 50%)
        `,
      }} />

      {/* Progress bar */}
      {showProgress && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: '#E5E7EB', zIndex: 50 }}>
          <div style={{ height: '100%', width: progressWidth, background: '#1A56DB', transition: 'width 500ms cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
      )}

      {/* Content */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: step === 0 || step === 1 ? 'center' : 'flex-start',
          justifyContent: 'center',
          padding: step === 0 || step === 1 ? '0 24px' : '56px 24px 60px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: `opacity ${visible ? FADE_IN_MS : FADE_OUT_MS}ms cubic-bezier(0.16,1,0.3,1), transform ${visible ? FADE_IN_MS : FADE_OUT_MS}ms cubic-bezier(0.16,1,0.3,1)`,
        }}
      >
        <div className="onb-wrapper">

          {/* ── STEP 0: Welcome ───────────────────────────────────── */}
          {step === 0 && (
            <div style={{ textAlign: 'center' }}>
              <p className="onb-eyebrow" style={{ opacity: 0, animation: 'fadeIn 800ms ease 100ms forwards' }}>
                BIENVENIDO A PUBLIFY
              </p>
              <h1 className="onb-hero-name" style={{ opacity: 0, animation: 'fadeSlideUp 700ms cubic-bezier(0.16,1,0.3,1) 300ms forwards' }}>
                {userName}
              </h1>
            </div>
          )}

          {/* ── STEP 1: Value prop ────────────────────────────────── */}
          {step === 1 && (
            <div style={{ textAlign: 'center' }}>
              <p className="onb-value-line" style={{ opacity: 0, animation: 'fadeSlideUp 600ms cubic-bezier(0.16,1,0.3,1) 0ms forwards' }}>
                Haz crecer tu negocio
              </p>
              <p className="onb-value-line" style={{ opacity: 0, animation: 'fadeSlideUp 600ms cubic-bezier(0.16,1,0.3,1) 150ms forwards' }}>
                con el marketing <span style={{ color: '#1A56DB' }}>adecuado</span>
              </p>
            </div>
          )}

          {/* ── STEP 2: Business type ─────────────────────────────── */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <p className="onb-eyebrow">PASO 1 DE 3</p>
              <h2 className="onb-title">Que tipo de negocio tienes?</h2>
              <p className="onb-subtitle">Personalizaremos la app para ti</p>

              <div className="onb-biz-grid">
                {BIZ_TYPES.map((bt, i) => {
                  const sel = bizType === bt.id
                  return (
                    <button
                      key={bt.id}
                      onClick={() => setBizType(bt.id)}
                      className={`onb-biz-card${sel ? ' onb-biz-card--sel' : ''}`}
                      style={{
                        opacity: 0,
                        animation: `scaleIn 400ms cubic-bezier(0.34,1.56,0.64,1) ${i * 55}ms forwards`,
                      }}
                    >
                      <bt.Icon size={32} color={sel ? '#1A56DB' : '#6B7280'} />
                      <span className="onb-biz-label">{bt.label}</span>
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 36 }}>
                <ContinueButton show={canContinue2} onClick={() => goTo(3)} />
              </div>
            </div>
          )}

          {/* ── STEP 3: Name & city ───────────────────────────────── */}
          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <BackButton onClick={() => goTo(2)} />
              <p className="onb-eyebrow">PASO 2 DE 3</p>
              <h2 className="onb-title">Cuentanos sobre tu negocio</h2>

              <div className="onb-inputs-row">
                <div className="onb-input-wrap" style={{ opacity: 0, animation: 'fadeSlideUp 600ms cubic-bezier(0.16,1,0.3,1) 150ms forwards' }}>
                  <label className="onb-input-label">Nombre del negocio</label>
                  <input
                    type="text" value={bizName} onChange={(e) => setBizName(e.target.value)}
                    placeholder="Restaurante El Rincon"
                    className="onb-input"
                    onFocus={(e) => { e.currentTarget.style.borderBottomColor = '#1A56DB' }}
                    onBlur={(e)  => { e.currentTarget.style.borderBottomColor = '#D1D5DB' }}
                  />
                </div>
                <div className="onb-input-wrap" style={{ opacity: 0, animation: 'fadeSlideUp 600ms cubic-bezier(0.16,1,0.3,1) 280ms forwards' }}>
                  <label className="onb-input-label">Ciudad</label>
                  <input
                    type="text" value={city} onChange={(e) => setCity(e.target.value)}
                    placeholder="Sevilla"
                    className="onb-input"
                    onFocus={(e) => { e.currentTarget.style.borderBottomColor = '#1A56DB' }}
                    onBlur={(e)  => { e.currentTarget.style.borderBottomColor = '#D1D5DB' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: 44 }}>
                <ContinueButton show={canContinue3} onClick={() => goTo(4)} />
              </div>
            </div>
          )}

          {/* ── STEP 4: Goal ─────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ textAlign: 'center' }}>
              <BackButton onClick={() => goTo(3)} />
              <p className="onb-eyebrow">PASO 3 DE 3</p>
              <h2 className="onb-title">Que quieres conseguir?</h2>
              <p className="onb-subtitle">Puedes cambiar esto mas adelante</p>

              <div className="onb-goals-grid">
                {GOALS.map((g, i) => {
                  const sel = goal === g.id
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={`onb-goal-card${sel ? ' onb-goal-card--sel' : ''}`}
                      style={{ opacity: 0, animation: `fadeSlideUp 500ms cubic-bezier(0.16,1,0.3,1) ${i * 70}ms forwards` }}
                    >
                      <g.Icon size={22} color={sel ? '#1A56DB' : '#9CA3AF'} />
                      <span style={{ fontSize: 15, fontWeight: sel ? 600 : 500, color: sel ? '#1A56DB' : '#374151' }}>{g.label}</span>
                    </button>
                  )
                })}
              </div>

              <div style={{ marginTop: 28 }}>
                <ContinueButton show={canContinue4} onClick={() => goTo(5)} />
              </div>
            </div>
          )}

          {/* ── STEP 5: Done ──────────────────────────────────────── */}
          {step === 5 && (
            <div className="onb-final">
              {/* Left: text + CTA */}
              <div className="onb-final-text">
                <p className="onb-eyebrow" style={{ opacity: 0, animation: 'fadeIn 600ms ease 100ms forwards' }}>TODO LISTO</p>
                <h1 className="onb-final-title" style={{ opacity: 0, animation: 'fadeSlideUp 700ms cubic-bezier(0.16,1,0.3,1) 200ms forwards' }}>
                  Bienvenido a Publify{bizName ? `,\n${bizName}` : ''}
                </h1>
                <p style={{ fontSize: 16, color: '#6B7280', margin: '12px 0 0', lineHeight: 1.5, opacity: 0, animation: 'fadeSlideUp 600ms cubic-bezier(0.16,1,0.3,1) 350ms forwards' }}>
                  Tu plataforma de marketing esta lista para trabajar.
                </p>
                <div style={{ marginTop: 40, opacity: 0, animation: 'scaleIn 400ms cubic-bezier(0.34,1.56,0.64,1) 700ms forwards' }}>
                  <button
                    onClick={() => router.push('/dashboard')}
                    disabled={saving}
                    className="onb-cta-btn"
                    onMouseEnter={(e) => { if (!saving) { e.currentTarget.style.background = '#1A56DB' } }}
                    onMouseLeave={(e) => { if (!saving) { e.currentTarget.style.background = '#111827' } }}
                  >
                    {saving
                      ? <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      : <><ArrowRight size={18} color="#FFFFFF" /><span>Ir al dashboard</span></>
                    }
                  </button>
                </div>
              </div>

              {/* Right: dashboard mockup */}
              <div className="onb-mockup" style={{ opacity: 0, animation: 'slideUpIn 900ms cubic-bezier(0.16,1,0.3,1) 500ms forwards' }}>
                <div style={{ background: '#111827', height: 44, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {['#FF5F57','#FFBD2E','#28CA41'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
                  </div>
                  <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600, marginLeft: 8 }}>Publify</span>
                </div>
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                  {/* Sidebar mockup */}
                  <div style={{ width: 52, background: '#111827', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 8px' }}>
                    {[...Array(6)].map((_, i) => <div key={i} style={{ height: 28, borderRadius: 6, background: i === 0 ? '#2563EB' : '#1F2937' }} />)}
                  </div>
                  {/* Content mockup */}
                  <div style={{ flex: 1, background: '#F9FAFB', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
                    <div style={{ background: '#1A56DB', height: 70, borderRadius: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: 44, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8 }} />)}
                    </div>
                    {[72,55,55].map((w, i) => (
                      <div key={i} style={{ height: 42, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 5, background: '#EEF3FE', flexShrink: 0 }} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ height: 7, background: '#E5E7EB', borderRadius: 4, width: `${w}%` }} />
                          <div style={{ height: 5, background: '#F3F4F6', borderRadius: 4, width: '40%' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes fadeIn      { from{opacity:0} to{opacity:1} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUpIn   { from{opacity:0;transform:translateY(36px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scaleIn     { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
        @keyframes spin        { to{transform:rotate(360deg)} }

        /* Shared */
        .onb-wrapper    { width:100%; max-width:520px; }
        .onb-eyebrow    { font-size:11px; font-weight:600; letter-spacing:0.14em; color:#9CA3AF; text-transform:uppercase; margin:0 0 14px; }
        .onb-title      { font-size:26px; font-weight:700; color:#111827; letter-spacing:-0.02em; margin:0 0 8px; }
        .onb-subtitle   { font-size:14px; color:#6B7280; margin:0 0 28px; }
        .onb-hero-name  { font-size:48px; font-weight:700; color:#111827; letter-spacing:-0.03em; margin:0; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .onb-value-line { font-size:34px; font-weight:700; color:#111827; letter-spacing:-0.02em; line-height:1.2; margin:4px 0; }

        /* Step 2 grid */
        .onb-biz-grid   { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:4px; }
        .onb-biz-card   { background:#FFFFFF; border:1.5px solid #E5E7EB; border-radius:14px; padding:22px 10px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; width:100%; transition:all 200ms cubic-bezier(0.16,1,0.3,1); }
        .onb-biz-card:hover { border-color:#BFDBFE; box-shadow:0 2px 10px rgba(26,86,219,0.08); transform:translateY(-2px); }
        .onb-biz-card--sel  { border-color:#1A56DB !important; background:#EEF3FE !important; transform:scale(1.04) !important; box-shadow:0 4px 16px rgba(26,86,219,0.18) !important; }
        .onb-biz-label  { font-size:13px; font-weight:500; color:#374151; }
        .onb-biz-card--sel .onb-biz-label { color:#1A56DB; font-weight:600; }

        /* Step 3 inputs */
        .onb-inputs-row { display:flex; flex-direction:column; gap:28px; max-width:400px; margin:0 auto; }
        .onb-input-wrap { display:flex; flex-direction:column; gap:6px; text-align:left; }
        .onb-input-label{ font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.08em; }
        .onb-input      { border:none; border-bottom:2px solid #D1D5DB; font-size:22px; font-weight:500; color:#111827; padding:10px 0; outline:none; background:transparent; width:100%; transition:border-color 200ms; }
        .onb-input::placeholder { color:#D1D5DB; }

        /* Step 4 goals */
        .onb-goals-grid { display:flex; flex-direction:column; gap:10px; max-width:420px; margin:0 auto; }
        .onb-goal-card  { background:#FFFFFF; border:1.5px solid #E5E7EB; border-radius:12px; padding:16px 20px; display:flex; align-items:center; gap:14px; cursor:pointer; text-align:left; width:100%; transition:all 200ms; }
        .onb-goal-card:hover { border-color:#BFDBFE; background:#F8FAFF; }
        .onb-goal-card--sel  { border-color:#1A56DB !important; background:#EEF3FE !important; }

        /* Step 5 final */
        .onb-final       { display:flex; flex-direction:column; align-items:center; gap:32px; text-align:center; }
        .onb-final-text  { display:flex; flex-direction:column; align-items:center; }
        .onb-final-title { font-size:28px; font-weight:700; color:#111827; letter-spacing:-0.02em; margin:0; white-space:pre-line; line-height:1.2; }
        .onb-mockup      { width:100%; max-width:420px; height:320px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:16px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.12); display:flex; flex-direction:column; }
        .onb-cta-btn     { display:inline-flex; align-items:center; gap:10px; padding:14px 28px; border-radius:999px; border:none; background:#111827; color:#FFFFFF; font-size:15px; font-weight:600; cursor:pointer; transition:background 200ms, transform 200ms; }
        .onb-cta-btn:hover { transform:scale(1.03); }

        /* Desktop overrides */
        @media(min-width:720px) {
          .onb-wrapper    { max-width:860px; }
          .onb-title      { font-size:34px; }
          .onb-hero-name  { font-size:64px; }
          .onb-value-line { font-size:48px; }
          .onb-biz-grid   { grid-template-columns:repeat(4,1fr); gap:14px; }
          .onb-biz-card   { padding:28px 14px; }
          .onb-biz-label  { font-size:14px; }
          .onb-inputs-row { flex-direction:row; gap:32px; max-width:640px; }
          .onb-goals-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; max-width:640px; }
          .onb-goal-card  { padding:20px 24px; }
          .onb-final      { flex-direction:row; align-items:center; gap:64px; text-align:left; }
          .onb-final-text { align-items:flex-start; max-width:380px; }
          .onb-final-title{ font-size:40px; }
          .onb-mockup     { max-width:none; width:420px; height:380px; flex-shrink:0; }
        }
      `}</style>
    </div>
  )
}

// ── Back button ───────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#9CA3AF', fontSize: 13, fontWeight: 500,
        padding: '4px 0', marginBottom: 20,
        transition: 'color 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#374151' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF' }}
    >
      <ArrowLeft size={15} />
      Volver
    </button>
  )
}

// ── Continue button (circular arrow) ─────────────────────────────────────────

function ContinueButton({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null
  return (
    <button
      onClick={onClick}
      style={{
        width: 56, height: 56, borderRadius: '50%',
        background: '#111827', border: 'none', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 200ms, transform 200ms',
        animation: 'scaleIn 400ms cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#1A56DB'; e.currentTarget.style.transform = 'scale(1.05)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#111827'; e.currentTarget.style.transform = 'scale(1)' }}
    >
      <ArrowRight size={20} color="#FFFFFF" />
    </button>
  )
}
