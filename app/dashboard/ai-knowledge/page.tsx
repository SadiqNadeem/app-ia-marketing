'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import type { AiKnowledge, AiExampleType } from '@/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { value: AiExampleType; label: string; description: string }[] = [
  { value: 'post',    label: 'Post',    description: 'Publicaciones para redes sociales' },
  { value: 'flyer',   label: 'Flyer',   description: 'Textos para disenos visuales y publicidad' },
  { value: 'campana', label: 'Campana', description: 'Textos de campanas y promociones' },
]

const TYPE_VARIANT: Record<AiExampleType, 'info' | 'warning' | 'success'> = {
  post:    'info',
  flyer:   'warning',
  campana: 'success',
}

const MAX_CONTENT = 2000

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AiKnowledgePage() {
  const [examples, setExamples] = useState<AiKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<AiExampleType | 'all'>('all')

  // ── Form state ──────────────────────────────────────────────────
  const [newType, setNewType]       = useState<AiExampleType>('post')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const fetchExamples = useCallback(async () => {
    setLoading(true)
    const url = filterType === 'all'
      ? '/api/ai-knowledge'
      : `/api/ai-knowledge?type=${filterType}`
    try {
      const res  = await fetch(url)
      const data = await res.json()
      setExamples(data.examples ?? [])
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [filterType])

  useEffect(() => { fetchExamples() }, [fetchExamples])

  async function handleSave() {
    if (!newContent.trim()) return
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/ai-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ type: newType, content: newContent.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError(data.error ?? 'Error al guardar'); return }
      setNewContent('')
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
      await fetchExamples()
    } catch {
      setSaveError('Error de red. Intentalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este ejemplo?')) return
    await fetch(`/api/ai-knowledge?id=${id}`, { method: 'DELETE' })
    setExamples((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div style={{ padding: '32px', background: '#F7F8FA', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111827', margin: 0 }}>
          Ejemplos para la IA
        </h1>
        <p style={{ marginTop: '4px', fontSize: '14px', color: '#374151' }}>
          Cuantos mejores ejemplos guardes, mejor sera el contenido generado
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', alignItems: 'start' }}>

        {/* ── LEFT: Example list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E5E7EB', paddingBottom: '0' }}>
            {([{ value: 'all', label: 'Todos' }, ...TYPE_OPTIONS] as const).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterType(value as AiExampleType | 'all')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: filterType === value ? 600 : 400,
                  color: filterType === value ? '#2563EB' : '#374151',
                  borderBottom: filterType === value ? '2px solid #2563EB' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            <p style={{ fontSize: '14px', color: '#374151' }}>Cargando...</p>
          ) : examples.length === 0 ? (
            <Card padding="md">
              <p style={{ fontSize: '14px', color: '#374151', margin: 0 }}>
                No hay ejemplos guardados todavia. Usa el formulario para anadir el primero.
              </p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {examples.map((ex) => (
                <ExampleCard key={ex.id} example={ex} onDelete={() => handleDelete(ex.id)} />
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT: Add form ── */}
        <Card padding="md">
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>
            Anadir ejemplo
          </h2>

          {/* Type selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#111827', display: 'block', marginBottom: '8px' }}>
              Tipo de contenido
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {TYPE_OPTIONS.map(({ value, label, description }) => (
                <label
                  key={value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '10px 12px',
                    border: `1px solid ${newType === value ? '#2563EB' : '#E5E7EB'}`,
                    borderRadius: '8px',
                    background: newType === value ? '#EEF3FE' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={newType === value}
                    onChange={() => setNewType(value)}
                    style={{ marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: '12px', color: '#374151', margin: '2px 0 0' }}>{description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Content textarea */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: '#111827', display: 'block', marginBottom: '6px' }}>
              Ejemplo de contenido de alta calidad
            </label>
            <textarea
              value={newContent}
              onChange={(e) => { if (e.target.value.length <= MAX_CONTENT) setNewContent(e.target.value) }}
              placeholder={
                newType === 'post'
                  ? 'Pega aqui un post real que haya funcionado bien...'
                  : newType === 'flyer'
                  ? 'Escribe el texto de un flyer que haya generado resultados...'
                  : 'Escribe el texto de una campana exitosa...'
              }
              style={{
                width: '100%',
                height: '160px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                color: '#111827',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                lineHeight: '1.5',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <span style={{ fontSize: '12px', color: newContent.length > MAX_CONTENT * 0.9 ? '#EF4444' : '#374151' }}>
                {newContent.length} / {MAX_CONTENT}
              </span>
            </div>
          </div>

          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!newContent.trim() || saving}
            style={{ width: '100%' }}
          >
            Guardar ejemplo
          </Button>

          {saveError   && <p style={{ fontSize: '13px', color: '#EF4444', marginTop: '10px' }}>{saveError}</p>}
          {saveSuccess && <div style={{ marginTop: '10px' }}><Badge variant="success">Ejemplo guardado correctamente</Badge></div>}
        </Card>
      </div>
    </div>
  )
}

// ── ExampleCard ────────────────────────────────────────────────────────────────

function ExampleCard({ example, onDelete }: { example: AiKnowledge; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = example.content.length > 160

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant={TYPE_VARIANT[example.type]}>
            {TYPE_OPTIONS.find((t) => t.value === example.type)?.label ?? example.type}
          </Badge>
          <span style={{ fontSize: '12px', color: '#4B5563' }}>{formatDate(example.created_at)}</span>
        </div>
        <button
          onClick={onDelete}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#EF4444', padding: '2px 4px' }}
        >
          Eliminar
        </button>
      </div>

      <p
        style={{
          fontSize: '13px',
          color: '#374151',
          lineHeight: '1.6',
          margin: 0,
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: expanded ? undefined : 3,
          WebkitBoxOrient: 'vertical' as const,
        }}
      >
        {example.content}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2563EB', padding: 0, textAlign: 'left' }}
        >
          {expanded ? 'Ver menos' : 'Ver mas'}
        </button>
      )}
    </div>
  )
}


