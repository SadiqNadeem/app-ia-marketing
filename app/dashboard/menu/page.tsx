'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string
  name: string
  description: string
  price: number | ''
  image_url: string | null
  is_available: boolean
  allergens: string[]
  position: number
}

interface MenuSection {
  id: string
  name: string
  description: string
  position: number
  items: MenuItem[]
}

interface Menu {
  id: string
  business_id: string
  slug: string
  is_published: boolean
  show_prices: boolean
  accent_color: string
  sections: MenuSection[]
  updated_at: string
}

interface Business {
  id: string
  name: string
  category: string
  logo_url: string | null
  primary_color: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLERGENS = [
  'Gluten', 'Lacteos', 'Huevos', 'Pescado', 'Mariscos',
  'Frutos secos', 'Soja', 'Apio', 'Mostaza', 'Sesamo',
  'Sulfitos', 'Altramuces', 'Moluscos',
]

function newId() {
  return crypto.randomUUID()
}

function emptyItem(position: number): MenuItem {
  return {
    id: newId(),
    name: '',
    description: '',
    price: '',
    image_url: null,
    is_available: true,
    allergens: [],
    position,
  }
}

function emptySection(position: number): MenuSection {
  return {
    id: newId(),
    name: 'Nueva seccion',
    description: '',
    position,
    items: [],
  }
}

// ── Sortable item ─────────────────────────────────────────────────────────────

interface SortableItemRowProps {
  item: MenuItem
  accentColor: string
  onChange: (updated: MenuItem) => void
  onDelete: () => void
  onImageUpload: (file: File) => Promise<string | null>
}

function SortableItemRow({ item, accentColor, onChange, onDelete, onImageUpload }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const url = await onImageUpload(file)
    if (url) onChange({ ...item, image_url: url })
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function toggleAllergen(allergen: string) {
    const lower = allergen.toLowerCase()
    const next = item.allergens.includes(lower)
      ? item.allergens.filter((a) => a !== lower)
      : [...item.allergens, lower]
    onChange({ ...item, allergens: next })
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-3">
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="mt-1 text-[#4B5563] hover:text-[#374151] cursor-grab active:cursor-grabbing"
          title="Arrastrar"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="3" width="2" height="2" rx="1" />
            <rect x="7" y="3" width="2" height="2" rx="1" />
            <rect x="11" y="3" width="2" height="2" rx="1" />
            <rect x="3" y="7" width="2" height="2" rx="1" />
            <rect x="7" y="7" width="2" height="2" rx="1" />
            <rect x="11" y="7" width="2" height="2" rx="1" />
            <rect x="3" y="11" width="2" height="2" rx="1" />
            <rect x="7" y="11" width="2" height="2" rx="1" />
            <rect x="11" y="11" width="2" height="2" rx="1" />
          </svg>
        </button>

        <div className="flex-1 min-w-0 space-y-3">
          {/* Name + price row */}
          <div className="flex gap-2">
            <input
              className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nombre del producto"
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
            />
            <input
              type="number"
              min={0}
              step={0.01}
              className="w-24 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Precio"
              value={item.price}
              onChange={(e) => onChange({ ...item, price: e.target.value === '' ? '' : parseFloat(e.target.value) })}
            />
          </div>

          {/* Description */}
          <input
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Descripcion (opcional)"
            value={item.description}
            onChange={(e) => onChange({ ...item, description: e.target.value })}
          />

          {/* Image + available + delete */}
          <div className="flex items-center gap-3 flex-wrap">
            {item.image_url ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => onChange({ ...item, image_url: null })}
                  className="text-xs text-red-500 hover:underline"
                >
                  Quitar foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-[#2563EB] hover:underline"
              >
                {uploading ? 'Subiendo...' : 'Anadir foto'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />

            <label className="flex items-center gap-1.5 text-xs text-[#374151] cursor-pointer">
              <input
                type="checkbox"
                checked={item.is_available}
                onChange={(e) => onChange({ ...item, is_available: e.target.checked })}
              />
              Disponible
            </label>

            <button type="button" onClick={onDelete} className="ml-auto text-xs text-red-400 hover:text-red-600">
              Eliminar
            </button>
          </div>

          {/* Allergens */}
          <div>
            <p className="text-xs text-[#374151] mb-1">Alergenos:</p>
            <div className="flex flex-wrap gap-1">
              {ALLERGENS.map((a) => {
                const isSelected = item.allergens.includes(a.toLowerCase())
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAllergen(a)}
                    className="text-xs px-2 py-0.5 rounded-full border transition-colors"
                    style={{
                      borderColor: isSelected ? accentColor : '#E5E7EB',
                      backgroundColor: isSelected ? accentColor : 'transparent',
                      color: isSelected ? '#fff' : '#374151',
                    }}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sortable section ──────────────────────────────────────────────────────────

interface SortableSectionProps {
  section: MenuSection
  accentColor: string
  businessId: string
  onChange: (updated: MenuSection) => void
  onDelete: () => void
}

function SortableSection({ section, accentColor, businessId, onChange, onDelete }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [expanded, setExpanded] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = section.items.findIndex((i) => i.id === active.id)
    const newIdx = section.items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(section.items, oldIdx, newIdx).map((item, idx) => ({ ...item, position: idx }))
    onChange({ ...section, items: reordered })
  }

  function addItem() {
    const newItem = emptyItem(section.items.length)
    onChange({ ...section, items: [...section.items, newItem] })
  }

  function updateItem(id: string, updated: MenuItem) {
    onChange({ ...section, items: section.items.map((i) => (i.id === id ? updated : i)) })
  }

  function deleteItem(id: string) {
    onChange({ ...section, items: section.items.filter((i) => i.id !== id) })
  }

  async function uploadImage(file: File): Promise<string | null> {
    const form = new FormData()
    form.append('file', file)
    form.append('business_id', businessId)
    const res = await fetch('/api/menu/upload-item-image', { method: 'POST', body: form })
    if (!res.ok) return null
    const data = await res.json()
    return data.image_url ?? null
  }

  return (
    <div ref={setNodeRef} style={style} className="border border-[#E5E7EB] rounded-xl bg-[#F9FAFB] mb-4">
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="text-[#4B5563] hover:text-[#374151] cursor-grab active:cursor-grabbing shrink-0"
          title="Arrastrar seccion"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="2" y="5" width="12" height="2" rx="1" />
            <rect x="2" y="9" width="12" height="2" rx="1" />
          </svg>
        </button>

        {/* Name editable */}
        <input
          className="flex-1 bg-transparent border-b border-transparent hover:border-[#D1D5DB] focus:border-[#2563EB] focus:outline-none text-sm font-semibold text-[#111827] py-0.5"
          value={section.name}
          onChange={(e) => onChange({ ...section, name: e.target.value })}
        />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[#374151] hover:text-[#111827] text-xs px-2"
        >
          {expanded ? 'Colapsar' : 'Expandir'}
        </button>

        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <button type="button" onClick={onDelete} className="text-red-500 font-medium">Confirmar</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-[#374151]">Cancelar</button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-400 hover:text-red-600 text-xs">
            Eliminar
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Section description */}
          <input
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            placeholder="Descripcion de la seccion (opcional)"
            value={section.description}
            onChange={(e) => onChange({ ...section, description: e.target.value })}
          />

          {/* Items */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
            <SortableContext items={section.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              {section.items.map((item) => (
                <SortableItemRow
                  key={item.id}
                  item={item}
                  accentColor={accentColor}
                  onChange={(updated) => updateItem(item.id, updated)}
                  onDelete={() => deleteItem(item.id)}
                  onImageUpload={uploadImage}
                />
              ))}
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={addItem}
            className="text-sm text-[#2563EB] hover:underline mt-1"
          >
            + Anadir producto
          </button>
        </div>
      )}
    </div>
  )
}

// ── Mobile preview ────────────────────────────────────────────────────────────

interface MobilePreviewProps {
  sections: MenuSection[]
  accentColor: string
  showPrices: boolean
  businessName: string
  logoUrl: string | null
}

function MobilePreview({ sections, accentColor, showPrices, businessName, logoUrl }: MobilePreviewProps) {
  const ALLERGEN_LABELS: Record<string, string> = {
    gluten: 'Gluten', lacteos: 'Lacteos', huevos: 'Huevos', pescado: 'Pescado',
    mariscos: 'Mariscos', 'frutos secos': 'Frutos secos', soja: 'Soja',
    apio: 'Apio', mostaza: 'Mostaza', sesamo: 'Sesamo', sulfitos: 'Sulfitos',
    altramuces: 'Altramuces', moluscos: 'Moluscos',
  }

  const sorted = [...sections].sort((a, b) => a.position - b.position)

  return (
    <div
      className="overflow-y-auto rounded-2xl border border-[#E5E7EB] shadow-lg bg-[#F9FAFB]"
      style={{ width: 375, maxHeight: 680, fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Header */}
      <div style={{ backgroundColor: accentColor }} className="px-4 pt-8 pb-5 flex flex-col items-center text-center">
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-14 h-14 rounded-full object-cover mb-2 border-2 border-white/30" />
        )}
        <p className="text-white font-semibold" style={{ fontSize: 18 }}>{businessName || 'Mi negocio'}</p>
        <p className="text-white" style={{ fontSize: 13, opacity: 0.8 }}>Nuestra carta</p>
      </div>

      {/* Sections */}
      <div className="px-3 pb-8">
        {sorted.map((section) => {
          const items = [...(section.items ?? [])].sort((a, b) => a.position - b.position)
          return (
            <div key={section.id} className="mt-6">
              <p style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{section.name || 'Seccion'}</p>
              {section.description && (
                <p style={{ fontSize: 12, color: '#374151', marginTop: 1 }}>{section.description}</p>
              )}
              <div className="mt-2 flex flex-col gap-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-3 flex gap-2"
                    style={{ opacity: item.is_available ? 1 : 0.5 }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', textDecoration: item.is_available ? 'none' : 'line-through' }}>
                          {item.name || 'Producto'}
                        </p>
                        {showPrices && item.price !== '' && item.price !== undefined && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: accentColor }} className="shrink-0">
                            {typeof item.price === 'number' ? item.price.toFixed(2) : item.price} EUR
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{item.description}</p>
                      )}
                      {item.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.allergens.map((a) => (
                            <span key={a} style={{ fontSize: 9, backgroundColor: '#F3F4F6', color: '#374151', borderRadius: 3, padding: '1px 4px' }}>
                              {ALLERGEN_LABELS[a] ?? a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image_url} alt="" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p style={{ fontSize: 12, color: '#4B5563' }}>Sin productos en esta seccion</p>
                )}
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <div className="mt-8 text-center">
            <p style={{ fontSize: 13, color: '#4B5563' }}>Agrega secciones y productos para ver la vista previa</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const supabase = createClient()

  const [business, setBusiness] = useState<Business | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [sections, setSections] = useState<MenuSection[]>([])
  const [isPublished, setIsPublished] = useState(false)
  const [showPrices, setShowPrices] = useState(true)
  const [accentColor, setAccentColor] = useState('#2563EB')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [qrLoading, setQrLoading] = useState(false)
  const [menuUrl, setMenuUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: biz } = await supabase
      .from('businesses')
      .select('id, name, category, logo_url, primary_color')
      .eq('owner_id', user.id)
      .single()

    if (!biz) return
    setBusiness(biz as Business)

    const res = await fetch(`/api/menu/get?business_id=${biz.id}`)
    const data = await res.json()

    if (data.menu) {
      const m = data.menu as Menu
      setMenu(m)
      setSections(m.sections as MenuSection[])
      setIsPublished(m.is_published)
      setShowPrices(m.show_prices)
      setAccentColor(m.accent_color)
      setMenuUrl(`${window.location.origin}/menu/${m.slug}`)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  function handleSectionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = sections.findIndex((s) => s.id === active.id)
    const newIdx = sections.findIndex((s) => s.id === over.id)
    setSections(arrayMove(sections, oldIdx, newIdx).map((s, idx) => ({ ...s, position: idx })))
  }

  function addSection() {
    setSections((prev) => [...prev, emptySection(prev.length)])
  }

  function updateSection(id: string, updated: MenuSection) {
    setSections((prev) => prev.map((s) => (s.id === id ? updated : s)))
  }

  function deleteSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id))
  }

  async function handleSave() {
    if (!business) return
    setSaving(true)

    const res = await fetch('/api/menu/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        business_id: business.id,
        sections: sections.map((s, si) => ({
          ...s,
          position: si,
          items: s.items.map((it, ii) => ({ ...it, position: ii })),
        })),
        show_prices: showPrices,
        accent_color: accentColor,
        is_published: isPublished,
      }),
    })

    const data = await res.json()
    if (data.menu) {
      setMenu(data.menu)
      setMenuUrl(`${window.location.origin}/menu/${data.menu.slug}`)
    }

    setSaving(false)
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 3000)
  }

  async function handleDownloadQR() {
    if (!business) return
    setQrLoading(true)
    const res = await fetch(`/api/menu/export-pdf?business_id=${business.id}`)
    const data = await res.json()
    if (data.qr_data_url) {
      const link = document.createElement('a')
      link.href = data.qr_data_url
      link.download = 'menu-qr.png'
      link.click()
    }
    setQrLoading(false)
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(menuUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-sm text-[#374151]">Cargando...</div>
      </div>
    )
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const publicMenuUrl = menu ? `${appUrl}/menu/${menu.slug}` : ''

  return (
    <div className="p-6 pb-28 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <PageHeader
          title="Menu digital"
          subtitle="Crea tu carta y comparte el QR con tus clientes"
        />

        <div className="flex items-center gap-3">
          {/* Published toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setIsPublished((v) => !v)}
              className={`w-10 h-6 rounded-full transition-colors relative ${isPublished ? 'bg-green-500' : 'bg-[#D1D5DB]'}`}
            >
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isPublished ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm text-[#374151]">Publicado</span>
          </label>

          {isPublished && menu && (
            <div className="flex items-center gap-2">
              <Badge variant="success">Activo</Badge>
              <a href={publicMenuUrl} target="_blank" rel="noreferrer" className="text-xs text-[#2563EB] hover:underline truncate max-w-[160px]">
                {publicMenuUrl}
              </a>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-xs text-[#374151] hover:text-[#111827] border border-[#E5E7EB] rounded px-2 py-1"
              >
                {copied ? 'Copiado' : 'Copiar enlace'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Left column: Editor ── */}
        <div className="flex-1 min-w-0">
          {/* Basic config */}
          <Card className="mb-5">
            <h3 className="text-sm font-semibold text-[#111827] mb-4">Configuracion</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-[#374151]">Color de acento</span>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-8 rounded border border-[#E5E7EB] cursor-pointer"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setShowPrices((v) => !v)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${showPrices ? 'bg-blue-500' : 'bg-[#D1D5DB]'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${showPrices ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-[#374151]">Mostrar precios</span>
              </label>
            </div>
          </Card>

          {/* Sections */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-[#111827] mb-3">Secciones</h3>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    accentColor={accentColor}
                    businessId={business?.id ?? ''}
                    onChange={(updated) => updateSection(section.id, updated)}
                    onDelete={() => deleteSection(section.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={addSection}
              className="w-full border-2 border-dashed border-[#D1D5DB] rounded-xl py-3 text-sm text-[#374151] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
            >
              + Anadir seccion
            </button>
          </div>
        </div>

        {/* ── Right column: Preview ── */}
        <div className="lg:w-[420px] shrink-0 flex flex-col items-center gap-4">
          <p className="text-xs text-[#374151] self-start">Vista previa (375px)</p>
          <MobilePreview
            sections={sections}
            accentColor={accentColor}
            showPrices={showPrices}
            businessName={business?.name ?? ''}
            logoUrl={business?.logo_url ?? null}
          />
          <Button
            variant="secondary"
            onClick={handleDownloadQR}
            disabled={!menu || qrLoading}
          >
            {qrLoading ? 'Generando QR...' : 'Descargar QR'}
          </Button>
          {!menu && (
            <p className="text-xs text-[#4B5563]">Guarda el menu primero para descargar el QR</p>
          )}
        </div>
      </div>

      {/* Floating save button */}
      <div className="fixed bottom-0 left-60 right-0 bg-white border-t border-[#E5E7EB] px-6 py-3 flex items-center gap-4 z-20">
        <Button onClick={handleSave} disabled={saving || !business}>
          {saving ? 'Guardando...' : 'Guardar menu'}
        </Button>
        {savedMsg && <Badge variant="success">Menu guardado</Badge>}
      </div>
    </div>
  )
}


