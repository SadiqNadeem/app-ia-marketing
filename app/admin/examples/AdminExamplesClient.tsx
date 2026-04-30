'use client'

import { useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X, Plus, Edit2, Trash2, ArrowLeft, Upload, ExternalLink } from 'lucide-react'

type ExampleCategory =
  | 'flyer' | 'post' | 'menu' | 'carta' | 'promocion'
  | 'story' | 'portada' | 'anuncio' | 'newsletter'

type Platform = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'linkedin' | 'youtube' | ''

interface AiExample {
  id: string
  title: string
  description: string
  image_url: string
  preview_url?: string
  category: ExampleCategory
  business_types: string[]
  style_tags: string[]
  style_description: string
  is_active: boolean
  is_template: boolean
  sort_order: number
  canvas_width?: number
  canvas_height?: number
  platform?: string
  post_type?: string
  created_at: string
}

interface ExampleForm {
  title: string
  description: string
  category: ExampleCategory
  image_url: string
  style_description: string
  business_types: string[]
  style_tags: string[]
  is_active: boolean
  sort_order: number
  platform: Platform
  post_type: string
  canvas_width: number
  canvas_height: number
}

const EMPTY_FORM: ExampleForm = {
  title: '',
  description: '',
  category: 'flyer',
  image_url: '',
  style_description: '',
  business_types: [],
  style_tags: [],
  is_active: true,
  sort_order: 0,
  platform: 'instagram',
  post_type: 'flyer',
  canvas_width: 1080,
  canvas_height: 1350,
}

const CATEGORIES: { value: ExampleCategory; label: string; color: string }[] = [
  { value: 'flyer',      label: 'Flyer',       color: '#2563EB' },
  { value: 'post',       label: 'Post',        color: '#16A34A' },
  { value: 'menu',       label: 'Menu',        color: '#CA8A04' },
  { value: 'carta',      label: 'Carta',       color: '#7C3AED' },
  { value: 'promocion',  label: 'Promocion',   color: '#DC2626' },
  { value: 'story',      label: 'Story',       color: '#DB2777' },
  { value: 'portada',    label: 'Portada',     color: '#4338CA' },
  { value: 'anuncio',    label: 'Anuncio',     color: '#EA580C' },
  { value: 'newsletter', label: 'Newsletter',  color: '#0891B2' },
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook',  label: 'Facebook' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'youtube',   label: 'YouTube' },
  { value: '',          label: 'Sin plataforma' },
]

const BUSINESS_TYPES = [
  { value: 'restaurante',  label: 'Restaurante' },
  { value: 'peluqueria',   label: 'Peluqueria' },
  { value: 'tienda',       label: 'Tienda' },
  { value: 'gimnasio',     label: 'Gimnasio' },
  { value: 'clinica',      label: 'Clinica' },
  { value: 'hotel',        label: 'Hotel' },
  { value: 'academia',     label: 'Academia' },
  { value: 'inmobiliaria', label: 'Inmobiliaria' },
]

const SUGGESTED_TAGS = [
  'moderno', 'minimalista', 'colorido', 'elegante', 'divertido',
  'oscuro', 'claro', 'tipografia-grande', 'fotografico', 'ilustrado',
  'premium', 'dorado', 'vibrante', 'corporativo',
]

function getCategoryColor(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.color ?? '#6B7280'
}

function getCategoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

type AdminFilter = 'all' | 'templates' | 'references'

export function AdminExamplesClient({ initialExamples }: { initialExamples: AiExample[] }) {
  const router = useRouter()
  const [examples, setExamples] = useState<AiExample[]>(initialExamples)
  const [adminFilter, setAdminFilter] = useState<AdminFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AiExample | null>(null)
  const [form, setForm] = useState<ExampleForm>(EMPTY_FORM)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setPendingFile(null)
    setLocalPreview('')
    setTagInput('')
    setModalOpen(true)
  }

  function openEdit(ex: AiExample) {
    setEditing(ex)
    setForm({
      title: ex.title,
      description: ex.description ?? '',
      category: ex.category,
      image_url: ex.image_url,
      style_description: ex.style_description,
      business_types: ex.business_types,
      style_tags: ex.style_tags,
      is_active: ex.is_active,
      sort_order: ex.sort_order,
      platform: (ex.platform as Platform) ?? 'instagram',
      post_type: ex.post_type ?? 'flyer',
      canvas_width: ex.canvas_width ?? 1080,
      canvas_height: ex.canvas_height ?? 1350,
    })
    setPendingFile(null)
    setLocalPreview('')
    setTagInput('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setPendingFile(null)
    setLocalPreview('')
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      showToast('Solo se admiten imagenes', false)
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('La imagen no puede superar 8 MB', false)
      return
    }
    setPendingFile(file)
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    setForm(f => ({ ...f, image_url: '' }))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }, []) // eslint-disable-line

  function clearImage() {
    setPendingFile(null)
    setLocalPreview('')
    setForm(f => ({ ...f, image_url: '' }))
  }

  function addTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!t || form.style_tags.includes(t)) return
    setForm(f => ({ ...f, style_tags: [...f.style_tags, t] }))
    setTagInput('')
  }

  function removeTag(i: number) {
    setForm(f => ({ ...f, style_tags: f.style_tags.filter((_, idx) => idx !== i) }))
  }

  function toggleBusinessType(val: string) {
    setForm(f => ({
      ...f,
      business_types: f.business_types.includes(val)
        ? f.business_types.filter(b => b !== val)
        : [...f.business_types, val],
    }))
  }

  const previewSrc = localPreview || form.image_url

  async function save() {
    if (!form.title.trim()) { showToast('El titulo es requerido', false); return }
    if (!previewSrc && !pendingFile) { showToast('Sube una imagen primero', false); return }
    if (form.style_description.trim().length < 50) {
      showToast('La descripcion del estilo debe tener al menos 50 caracteres', false)
      return
    }
    setSaving(true)

    if (editing) {
      // Edit: upload new image if pending, then update via Supabase client
      let imageUrl = form.image_url
      if (pendingFile) {
        const fd = new FormData()
        fd.append('file', pendingFile)
        fd.append('category', form.category)
        const res = await fetch('/api/admin/upload-example-image', { method: 'POST', body: fd })
        const result = await res.json()
        if (!res.ok) { setSaving(false); showToast(result.error ?? 'Error al subir imagen', false); return }
        imageUrl = result.url
      }

      const { data, error } = await supabase
        .from('ai_examples')
        .update({
          title: form.title.trim(),
          description: form.description.trim() || form.style_description.slice(0, 150),
          image_url: imageUrl,
          preview_url: imageUrl,
          category: form.category,
          style_description: form.style_description.trim(),
          business_types: form.business_types,
          style_tags: form.style_tags,
          is_active: form.is_active,
          sort_order: form.sort_order,
          platform: form.platform || null,
          post_type: form.post_type || null,
          canvas_width: form.canvas_width,
          canvas_height: form.canvas_height,
        })
        .eq('id', editing.id)
        .select()
        .single()
      setSaving(false)
      if (error) { showToast(error.message, false); return }
      setExamples(list => list.map(e => e.id === editing.id ? data as AiExample : e))
      showToast('Ejemplo actualizado')
      closeModal()
      return
    }

    // Create: send everything to the combined API route
    const fd = new FormData()
    if (pendingFile) fd.append('file', pendingFile)
    else if (form.image_url) fd.append('image_url', form.image_url)
    fd.append('title', form.title.trim())
    fd.append('description', form.description.trim())
    fd.append('style_description', form.style_description.trim())
    fd.append('category', form.category)
    fd.append('business_types', JSON.stringify(form.business_types))
    fd.append('style_tags', JSON.stringify(form.style_tags))
    fd.append('is_active', String(form.is_active))
    fd.append('sort_order', String(form.sort_order))
    fd.append('platform', form.platform)
    fd.append('post_type', form.post_type)
    fd.append('canvas_width', String(form.canvas_width))
    fd.append('canvas_height', String(form.canvas_height))

    const res = await fetch('/api/admin/upload-example', { method: 'POST', body: fd })
    const result = await res.json()
    setSaving(false)
    if (!res.ok) { showToast(result.error ?? 'Error al crear ejemplo', false); return }

    // Fetch the new record to add to the list
    const { data: newEx } = await supabase
      .from('ai_examples')
      .select('*')
      .eq('id', result.id)
      .single()
    if (newEx) setExamples(list => [newEx as AiExample, ...list])
    showToast('Ejemplo creado correctamente')
    closeModal()
  }

  async function toggleActive(ex: AiExample) {
    const { error } = await supabase
      .from('ai_examples')
      .update({ is_active: !ex.is_active })
      .eq('id', ex.id)
    if (!error) {
      setExamples(list => list.map(e => e.id === ex.id ? { ...e, is_active: !e.is_active } : e))
    }
  }

  async function deleteExample(id: string) {
    if (!confirm('Eliminar este ejemplo? Esta accion no se puede deshacer.')) return
    setDeletingId(id)
    const { error } = await supabase.from('ai_examples').delete().eq('id', id)
    setDeletingId(null)
    if (error) { showToast(error.message, false); return }
    setExamples(list => list.filter(e => e.id !== id))
    showToast('Ejemplo eliminado')
  }

  const filtered = examples.filter(ex =>
    adminFilter === 'all' ? true : adminFilter === 'templates' ? ex.is_template : !ex.is_template
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-jakarta, sans-serif)' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.ok ? '#15803D' : '#DC2626',
          color: '#fff', padding: '10px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 500, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6B7280', textDecoration: 'none', fontSize: 13 }}>
              <ArrowLeft size={14} /> Dashboard
            </a>
            <div style={{ width: 1, height: 16, background: '#E5E7EB' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.01em' }}>
                  Ejemplos de IA
                </h1>
                <span style={{ background: '#FEE2E2', color: '#DC2626', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                  Admin
                </span>
              </div>
              <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                Gestiona los ejemplos globales de referencia
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#2563EB', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Nuevo ejemplo
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px' }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {([{ v: 'all', l: 'Todos' }, { v: 'templates', l: 'Solo plantillas' }, { v: 'references', l: 'Solo referencias' }] as { v: AdminFilter; l: string }[]).map(f => (
            <button key={f.v} onClick={() => setAdminFilter(f.v)} style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 13,
              fontWeight: adminFilter === f.v ? 600 : 400,
              border: adminFilter === f.v ? '1.5px solid #1A56DB' : '1.5px solid #E5E7EB',
              background: adminFilter === f.v ? '#EEF3FE' : '#fff',
              color: adminFilter === f.v ? '#1A56DB' : '#374151',
              cursor: 'pointer',
            }}>{f.l}</button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9CA3AF' }}>
            <p style={{ fontSize: 15, margin: 0 }}>No hay ejemplos en este filtro todavia.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {filtered.map(ex => (
              <div key={ex.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                {/* Image */}
                <div style={{ position: 'relative', aspectRatio: '4/3', background: '#F3F4F6' }}>
                  {ex.image_url ? (
                    <Image src={ex.image_url} alt={ex.title} fill style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>
                      Sin imagen
                    </div>
                  )}
                  {!ex.is_active && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>Inactivo</span>
                    </div>
                  )}
                </div>
                {/* Body */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.title}
                    </span>
                    {ex.is_template && (
                      <span style={{ background: '#EEF3FE', color: '#1A56DB', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
                        Plantilla
                      </span>
                    )}
                    <span style={{ background: getCategoryColor(ex.category) + '18', color: getCategoryColor(ex.category), fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0 }}>
                      {getCategoryLabel(ex.category)}
                    </span>
                  </div>
                  {ex.platform && (
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{ex.platform}{ex.post_type ? ` · ${ex.post_type}` : ''}{ex.canvas_width ? ` · ${ex.canvas_width}x${ex.canvas_height}` : ''}</span>
                  )}
                  {ex.business_types.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ex.business_types.map(bt => (
                        <span key={bt} style={{ background: '#F3F4F6', color: '#374151', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                          {bt}
                        </span>
                      ))}
                    </div>
                  )}
                  {ex.style_tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ex.style_tags.map(tag => (
                        <span key={tag} style={{ background: '#EFF6FF', color: '#2563EB', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {ex.is_template && (
                    <button
                      onClick={() => router.push(`/dashboard/create?template_id=${ex.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', padding: '7px', borderRadius: 7, border: '1px solid #E5E7EB', background: '#F9FAFB', color: '#374151', fontSize: 12, fontWeight: 500, cursor: 'pointer', justifyContent: 'center' }}
                    >
                      <ExternalLink size={12} /> Abrir en editor
                    </button>
                  )}
                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => toggleActive(ex)}
                      style={{
                        width: 36, height: 20, borderRadius: 99,
                        background: ex.is_active ? '#2563EB' : '#D1D5DB',
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s', flexShrink: 0,
                      }}
                      title={ex.is_active ? 'Desactivar' : 'Activar'}
                    >
                      <span style={{
                        position: 'absolute', top: 2,
                        left: ex.is_active ? 18 : 2,
                        width: 16, height: 16,
                        borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                    <span style={{ fontSize: 11, color: '#6B7280', flex: 1 }}>
                      {ex.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                    <button
                      onClick={() => openEdit(ex)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => deleteExample(ex.id)}
                      disabled={deletingId === ex.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4 }}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', position: 'relative' }}>
            {/* Modal header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>
                {editing ? 'Editar ejemplo' : 'Nuevo ejemplo'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Title */}
              <div>
                <label style={labelStyle}>Titulo *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Flyer 2x1 restaurante elegante"
                  style={inputStyle}
                />
              </div>

              {/* Description */}
              <div>
                <label style={labelStyle}>Descripcion breve</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Flyer premium para promocion 2x1 en restaurante"
                  style={inputStyle}
                />
              </div>

              {/* Category + Platform row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Categoria *</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value as ExampleCategory }))}
                    style={inputStyle}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Plataforma</label>
                  <select
                    value={form.platform}
                    onChange={e => setForm(f => ({ ...f, platform: e.target.value as Platform }))}
                    style={inputStyle}
                  >
                    {PLATFORMS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Post type + Canvas dimensions row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tipo de post</label>
                  <input
                    type="text"
                    value={form.post_type}
                    onChange={e => setForm(f => ({ ...f, post_type: e.target.value }))}
                    placeholder="flyer, post, story..."
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Ancho (px)</label>
                  <input
                    type="number"
                    value={form.canvas_width}
                    onChange={e => setForm(f => ({ ...f, canvas_width: Number(e.target.value) || 1080 }))}
                    style={inputStyle}
                    min={1}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Alto (px)</label>
                  <input
                    type="number"
                    value={form.canvas_height}
                    onChange={e => setForm(f => ({ ...f, canvas_height: Number(e.target.value) || 1350 }))}
                    style={inputStyle}
                    min={1}
                  />
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label style={labelStyle}>Imagen * {!editing && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(se sube al guardar)</span>}</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? '#2563EB' : '#D1D5DB'}`,
                    borderRadius: 8, padding: 16, textAlign: 'center',
                    cursor: 'pointer', background: dragOver ? '#EFF6FF' : '#FAFAFA',
                    transition: 'all 0.15s',
                  }}
                >
                  {previewSrc ? (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden' }}>
                      <Image src={previewSrc} alt="preview" fill style={{ objectFit: 'contain' }} unoptimized />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#6B7280', padding: '8px 0' }}>
                      <Upload size={24} />
                      <span style={{ fontSize: 13 }}>Arrastra el PNG aqui o haz clic para seleccionar</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>PNG, JPG, WebP — max 8 MB</span>
                    </div>
                  )}
                </div>
                {previewSrc && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    {pendingFile && (
                      <span style={{ fontSize: 11, color: '#6B7280', flex: 1 }}>
                        {pendingFile.name} ({(pendingFile.size / 1024).toFixed(0)} KB) — se subira al guardar
                      </span>
                    )}
                    <button
                      onClick={clearImage}
                      style={{ fontSize: 12, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Cambiar imagen
                    </button>
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = '' }}
                />
              </div>

              {/* Style description */}
              <div>
                <label style={labelStyle}>Descripcion del estilo * <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(min. 50 chars)</span></label>
                <textarea
                  value={form.style_description}
                  onChange={e => setForm(f => ({ ...f, style_description: e.target.value }))}
                  rows={4}
                  placeholder="Describe el estilo visual: colores, tipografia, composicion, elementos destacados, para que tipo de negocio..."
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 90 }}
                />
                <span style={{ fontSize: 11, color: form.style_description.length >= 50 ? '#16A34A' : '#9CA3AF' }}>
                  {form.style_description.length} caracteres
                </span>
              </div>

              {/* Business types */}
              <div>
                <label style={labelStyle}>Tipos de negocio</label>
                <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 8px' }}>
                  Sin seleccion = aplica a todos los negocios
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                  {BUSINESS_TYPES.map(bt => (
                    <label key={bt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                      <input
                        type="checkbox"
                        checked={form.business_types.includes(bt.value)}
                        onChange={() => toggleBusinessType(bt.value)}
                        style={{ width: 14, height: 14, accentColor: '#2563EB' }}
                      />
                      {bt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Style tags */}
              <div>
                <label style={labelStyle}>Tags de estilo</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                    placeholder="Escribe un tag y pulsa Enter"
                    style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
                  />
                  <button
                    onClick={() => addTag(tagInput)}
                    style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontSize: 13 }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {SUGGESTED_TAGS.filter(t => !form.style_tags.includes(t)).map(t => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      style={{ background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      + {t}
                    </button>
                  ))}
                </div>
                {form.style_tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {form.style_tags.map((tag, i) => (
                      <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#EFF6FF', color: '#2563EB', fontSize: 12, padding: '3px 8px', borderRadius: 4 }}>
                        {tag}
                        <button onClick={() => removeTag(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', padding: 0, lineHeight: 1, display: 'flex' }}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Active + Sort order */}
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Orden</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    style={{ ...inputStyle, width: 80 }}
                    min={0}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Activo</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      style={{
                        width: 44, height: 24, borderRadius: 99,
                        background: form.is_active ? '#2563EB' : '#D1D5DB',
                        border: 'none', cursor: 'pointer', position: 'relative',
                        transition: 'background 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 3,
                        left: form.is_active ? 22 : 3,
                        width: 18, height: 18, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                    <span style={{ fontSize: 13, color: '#374151' }}>
                      {form.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={closeModal}
                style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#374151', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  background: saving ? '#93C5FD' : '#2563EB',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '8px 20px', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear ejemplo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: '#111827', marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #D1D5DB', borderRadius: 8,
  padding: '8px 12px', fontSize: 13, color: '#111827',
  background: '#fff', outline: 'none',
}
