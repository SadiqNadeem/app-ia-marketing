'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Layout } from 'lucide-react'

type ExampleCategory =
  | 'flyer' | 'post' | 'menu' | 'carta' | 'promocion'
  | 'story' | 'portada' | 'anuncio' | 'newsletter' | 'historia'

interface AiExample {
  id: string
  title: string
  category: ExampleCategory
  image_url: string
  preview_url: string | null
  style_tags: string[]
  business_types: string[]
  is_template: boolean
  platform: string | null
}

const CATEGORIES: { value: ExampleCategory | 'all'; label: string }[] = [
  { value: 'all',       label: 'Todos' },
  { value: 'flyer',     label: 'Flyer' },
  { value: 'post',      label: 'Post' },
  { value: 'menu',      label: 'Menu' },
  { value: 'carta',     label: 'Carta' },
  { value: 'promocion', label: 'Promocion' },
  { value: 'story',     label: 'Story' },
  { value: 'historia',  label: 'Historia' },
  { value: 'portada',   label: 'Portada' },
  { value: 'anuncio',   label: 'Anuncio' },
  { value: 'newsletter', label: 'Newsletter' },
]

const CATEGORY_COLOR: Record<string, string> = {
  flyer:      '#2563EB',
  post:       '#16A34A',
  menu:       '#CA8A04',
  carta:      '#7C3AED',
  promocion:  '#DC2626',
  story:      '#DB2777',
  historia:   '#DB2777',
  portada:    '#4338CA',
  anuncio:    '#EA580C',
  newsletter: '#0891B2',
}

type PageTab = 'templates' | 'references'

export default function ExamplesPage() {
  const router = useRouter()
  const [examples, setExamples] = useState<AiExample[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<ExampleCategory | 'all'>('all')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pageTab, setPageTab] = useState<PageTab>('templates')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('ai_examples')
      .select('id, title, category, image_url, preview_url, style_tags, business_types, is_template, platform')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setExamples((data ?? []) as AiExample[])
        setLoading(false)
      })
  }, [])

  function getExampleRoute(ex: AiExample): string {
    if (ex.is_template) return `/dashboard/create?template_id=${ex.id}`
    if (ex.category === 'flyer' && ex.title.toLowerCase().includes('kebab'))
      return `/dashboard/template-editor`
    return `/dashboard/create-from-example?example_id=${ex.id}`
  }

  const tabExamples = pageTab === 'templates'
    ? examples.filter(e => e.is_template)
    : examples.filter(e => !e.is_template)

  const filtered = activeCategory === 'all'
    ? tabExamples
    : tabExamples.filter(e => e.category === activeCategory)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px', fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? '#1A56DB' : '#6B7280', border: 'none',
    borderBottom: active ? '2px solid #1A56DB' : '2px solid transparent',
    marginBottom: -1, background: 'none', cursor: 'pointer', transition: 'all 120ms',
  })

  return (
    <div className="flex flex-col gap-6 p-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>
          Ejemplos y plantillas
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
          Plantillas editables y referencias de estilo para tu contenido
        </p>
      </div>

      {/* Page tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
        <button style={tabStyle(pageTab === 'templates')} onClick={() => setPageTab('templates')}>
          Plantillas editables
        </button>
        <button style={tabStyle(pageTab === 'references')} onClick={() => setPageTab('references')}>
          Referencias de estilo
        </button>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            style={{
              padding: '6px 14px', borderRadius: 99, fontSize: 13,
              fontWeight: activeCategory === cat.value ? 600 : 400,
              border: activeCategory === cat.value ? '1.5px solid #1A56DB' : '1.5px solid #E5E7EB',
              background: activeCategory === cat.value ? '#EEF3FE' : '#fff',
              color: activeCategory === cat.value ? '#1A56DB' : '#374151',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: '#F3F4F6', borderRadius: 12, aspectRatio: '4/3', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '60px 0', textAlign: 'center' }}>
          <Layout size={36} color="#D1D5DB" strokeWidth={1.5} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
              {pageTab === 'templates' ? 'Todavia no hay plantillas disponibles' : 'No hay ejemplos en esta categoria'}
            </p>
            <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0, maxWidth: 280 }}>
              {pageTab === 'templates'
                ? 'Pronto encontraras aqui disenos listos para personalizar'
                : 'Prueba con otra categoria'}
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}
          className="examples-grid"
        >
          {filtered.map(ex => {
            const imgSrc = ex.preview_url || ex.image_url
            return (
              <div
                key={ex.id}
                style={{ background: '#fff', borderRadius: 12, border: '1px solid #E5E7EB', overflow: 'hidden' }}
              >
                {/* Image with hover overlay */}
                <div
                  style={{ position: 'relative', aspectRatio: '4/3', background: '#F3F4F6', cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredId(ex.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => router.push(getExampleRoute(ex))}
                >
                  {imgSrc ? (
                    <Image src={imgSrc} alt={ex.title} fill style={{ objectFit: 'cover' }} unoptimized />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 12 }}>
                      Sin imagen
                    </div>
                  )}

                  {/* Hover overlay */}
                  {hoveredId === ex.id && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'rgba(0,0,0,0.55)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <span style={{
                        background: ex.is_template ? '#1A56DB' : '#fff',
                        color: ex.is_template ? '#fff' : '#111827',
                        fontSize: 13, fontWeight: 600,
                        padding: '9px 18px', borderRadius: 8,
                      }}>
                        {ex.is_template ? 'Editar esta plantilla' : 'Usar como referencia'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.title}
                    </span>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {ex.is_template && (
                        <span style={{ background: '#EEF3FE', color: '#1A56DB', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
                          Editable
                        </span>
                      )}
                      <span style={{ background: (CATEGORY_COLOR[ex.category] ?? '#6B7280') + '18', color: CATEGORY_COLOR[ex.category] ?? '#6B7280', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
                        {CATEGORIES.find(c => c.value === ex.category)?.label ?? ex.category}
                      </span>
                    </div>
                  </div>

                  {ex.platform && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{ex.platform}</span>
                  )}

                  {ex.style_tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ex.style_tags.map(tag => (
                        <span key={tag} style={{ background: '#EEF3FE', color: '#1A56DB', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action button */}
                  <button
                    onClick={() => router.push(getExampleRoute(ex))}
                    style={{
                      marginTop: 4, width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: ex.is_template ? 'none' : '1px solid #E5E7EB',
                      background: ex.is_template ? '#1A56DB' : '#F9FAFB',
                      color: ex.is_template ? '#FFFFFF' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {ex.is_template ? 'Editar esta plantilla' : 'Usar como referencia'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) { .examples-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px) { .examples-grid { grid-template-columns: 1fr !important; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  )
}
