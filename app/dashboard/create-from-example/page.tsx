'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BookmarkPlus, ChevronLeft, Download, Send } from 'lucide-react'
import type { FabricEditorHandle } from '@/components/FabricEditor'

const FabricEditor = dynamic(() => import('@/components/FabricEditor'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────────────────
interface AiExample {
  id: string
  title: string
  image_url: string
  preview_url: string | null
  fabric_json: string | null
}

interface Business {
  id: string
  name: string
  primary_color: string | null
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function CreateFromExamplePage() {
  const router     = useRouter()
  const params     = useSearchParams()
  const exampleId  = params.get('example_id') ?? ''
  const editorRef  = useRef<FabricEditorHandle>(null)
  const supabase   = createClient()

  const [example,  setExample]  = useState<AiExample | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [toast,    setToast]    = useState<{ msg: string; ok: boolean } | null>(null)
  const [busy,     setBusy]     = useState(false)

  // Load data
  useEffect(() => {
    if (!exampleId) { setLoading(false); return }
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const [{ data: ex }, { data: biz }] = await Promise.all([
        supabase.from('ai_examples').select('id, title, image_url, preview_url, fabric_json').eq('id', exampleId).single(),
        supabase.from('businesses').select('id, name, primary_color').eq('owner_id', user.id).single(),
      ])

      if (ex) setExample(ex as AiExample)
      if (biz) setBusiness(biz as Business)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exampleId])

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Upload canvas PNG to Supabase, return public URL
  async function uploadCanvas(pathPrefix: string): Promise<string | null> {
    if (!business) return null
    const dataUrl = editorRef.current?.getDataUrl()
    if (!dataUrl) return null

    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], 'diseno.png', { type: 'image/png' })

    const path = `${business.id}/${pathPrefix}/${Date.now()}.png`
    const { error } = await supabase.storage.from('generated-images').upload(path, file, { contentType: 'image/png', upsert: false })
    if (error) { showToast('Error al subir la imagen', false); return null }

    const { data } = supabase.storage.from('generated-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleDownload() {
    editorRef.current?.downloadPng(`diseno-${example?.title ?? 'flyer'}.png`)
  }

  async function handleSaveLibrary() {
    if (busy || !business) return
    setBusy(true)
    const url = await uploadCanvas('editor')
    if (!url) { setBusy(false); return }
    await supabase.from('content_library').insert({ business_id: business.id, type: 'image', file_url: url })
    showToast('Guardado en tu biblioteca')
    setBusy(false)
  }

  async function handlePublish() {
    if (busy || !business) return
    setBusy(true)
    const url = await uploadCanvas('editor')
    if (!url) { setBusy(false); return }
    router.push(`/dashboard/create?image_url=${encodeURIComponent(url)}`)
    setBusy(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const exampleImg = example?.preview_url || example?.image_url || ''

  return (
    <div style={{ height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-jakarta, sans-serif)' }}>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, background: toast.ok ? '#15803D' : '#DC2626', color: '#fff', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {toast.msg}
        </div>
      )}

      {/* Topbar — 52px */}
      <div style={{ height: 52, flexShrink: 0, background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', gap: 12 }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => router.push('/dashboard/examples')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, padding: '4px 0' }}
          >
            <ChevronLeft size={16} /> Atras
          </button>
          {example && (
            <>
              <div style={{ width: 1, height: 20, background: '#E5E7EB' }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {example.title}
              </span>
            </>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, fontSize: 13, fontWeight: 500, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: 'pointer' }}
          >
            <Download size={14} /> Descargar PNG
          </button>
          <button
            onClick={handleSaveLibrary}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 7, fontSize: 13, fontWeight: 500, border: '1px solid #E5E7EB', background: '#fff', color: '#374151', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            <BookmarkPlus size={14} /> Guardar en biblioteca
          </button>
          <button
            onClick={handlePublish}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600, border: 'none', background: busy ? '#93C5FD' : '#1A56DB', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            <Send size={13} /> Publicar ahora
          </button>
        </div>
      </div>

      {/* Body — flex 1 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 36, border: '3px solid #E5E7EB', borderTopColor: '#1A56DB', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !example ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#6B7280' }}>
            <p style={{ fontSize: 14 }}>Ejemplo no encontrado.</p>
            <button onClick={() => router.push('/dashboard/examples')} style={{ fontSize: 13, color: '#1A56DB', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver ejemplos
            </button>
          </div>
        ) : (
          <FabricEditor
            ref={editorRef}
            exampleImageUrl={exampleImg}
            fabricJson={example.fabric_json}
            businessName={business?.name ?? ''}
            businessId={business?.id ?? ''}
          />
        )}
      </div>
    </div>
  )
}
