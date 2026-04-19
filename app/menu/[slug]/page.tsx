import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface MenuItem {
  id: string
  name: string
  description?: string
  price?: number
  image_url?: string | null
  is_available: boolean
  allergens?: string[]
  position: number
}

interface MenuSection {
  id: string
  name: string
  description?: string
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
  logo_url: string | null
  primary_color: string
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function PublicMenuPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: menu } = await supabase
    .from('menus')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <div className="text-center px-6">
          <p className="text-2xl font-semibold text-[#111827] mb-2">Menu no disponible</p>
          <p className="text-sm text-[#374151]">Este menu no existe o no esta publicado.</p>
        </div>
      </div>
    )
  }

  const typedMenu = menu as Menu

  const { data: business } = await supabase
    .from('businesses')
    .select('id, name, logo_url, primary_color')
    .eq('id', typedMenu.business_id)
    .single()

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
        <p className="text-sm text-[#374151]">Menu no disponible.</p>
      </div>
    )
  }

  const typedBusiness = business as Business
  const accentColor = typedMenu.accent_color || typedBusiness.primary_color || '#2563EB'
  const sections = (typedMenu.sections as MenuSection[]).sort((a, b) => a.position - b.position)
  const updatedDate = new Date(typedMenu.updated_at).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const ALLERGEN_LABELS: Record<string, string> = {
    gluten: 'Gluten',
    lacteos: 'Lacteos',
    huevos: 'Huevos',
    pescado: 'Pescado',
    mariscos: 'Mariscos',
    'frutos secos': 'Frutos secos',
    soja: 'Soja',
    apio: 'Apio',
    mostaza: 'Mostaza',
    sesamo: 'Sesamo',
    sulfitos: 'Sulfitos',
    altramuces: 'Altramuces',
    moluscos: 'Moluscos',
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-16" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div
        style={{ backgroundColor: accentColor }}
        className="px-4 pt-10 pb-6 flex flex-col items-center text-center"
      >
        {typedBusiness.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={typedBusiness.logo_url}
            alt={typedBusiness.name}
            className="w-16 h-16 rounded-full object-cover mb-3 border-2 border-white/30"
          />
        )}
        <h1 className="text-white font-semibold" style={{ fontSize: 22 }}>
          {typedBusiness.name}
        </h1>
        <p className="text-white mt-1" style={{ fontSize: 14, opacity: 0.8 }}>
          Nuestra carta
        </p>
      </div>

      {/* Section nav (sticky) */}
      {sections.length > 1 && (
        <div
          className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] overflow-x-auto"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="flex gap-2 px-4 py-2" style={{ width: 'max-content' }}>
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                className="whitespace-nowrap text-sm px-3 py-1.5 rounded-full border border-[#E5E7EB] text-[#374151] transition-colors"
                style={{ textDecoration: 'none' }}
              >
                {section.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div className="max-w-[600px] mx-auto px-4 pt-4">
        {sections.map((section) => {
          const items = (section.items ?? []).sort((a, b) => a.position - b.position)
          return (
            <div key={section.id} id={`section-${section.id}`} className="mt-8 first:mt-4">
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#111827' }}>
                {section.name}
              </h2>
              {section.description && (
                <p style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                  {section.description}
                </p>
              )}

              <div className="mt-3 flex flex-col gap-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex gap-3"
                    style={{ opacity: item.is_available ? 1 : 0.5 }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          style={{
                            fontSize: 15,
                            fontWeight: 500,
                            color: '#111827',
                            textDecoration: item.is_available ? 'none' : 'line-through',
                          }}
                        >
                          {item.name}
                        </p>
                        {typedMenu.show_prices && item.price !== undefined && item.price !== null && (
                          <span
                            className="shrink-0 font-semibold"
                            style={{ fontSize: 15, color: accentColor }}
                          >
                            {item.price.toFixed(2)} EUR
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p style={{ fontSize: 13, color: '#374151', marginTop: 3 }}>
                          {item.description}
                        </p>
                      )}

                      {!item.is_available && (
                        <p style={{ fontSize: 12, color: '#4B5563', marginTop: 3 }}>
                          No disponible
                        </p>
                      )}

                      {item.allergens && item.allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.allergens.map((a) => (
                            <span
                              key={a}
                              className="bg-[#F3F4F6] text-[#374151] rounded px-1.5 py-0.5"
                              style={{ fontSize: 10 }}
                            >
                              {ALLERGEN_LABELS[a.toLowerCase()] ?? a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="shrink-0 rounded-lg object-cover"
                        style={{ width: 80, height: 80 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="max-w-[600px] mx-auto px-4 mt-12 text-center">
        <p style={{ fontSize: 12, color: '#4B5563' }}>Carta actualizada el {updatedDate}</p>
        <p style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>Generado con MarketingIA</p>
      </div>
    </div>
  )
}

