import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const revalidate = 60

interface Business {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  category: string
  phone: string | null
  address: string | null
  landing_enabled: boolean
  landing_description: string | null
  landing_gallery: string[]
  landing_show_menu: boolean
  landing_show_reviews: boolean
  landing_cta_text: string
  landing_cta_phone: boolean
  landing_cta_whatsapp: boolean
  landing_cta_maps: boolean
}

interface MenuSection {
  id: string
  name: string
  items: { id: string; name: string; description?: string; price?: number; is_available: boolean }[]
}

interface Review {
  reviewer_display_name: string
  star_rating: string
  comment: string
}

interface SocialConnection {
  platform: string
  platform_username: string | null
  is_active: boolean
}

interface Props {
  params: Promise<{ slug: string }>
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurante: 'Restaurante',
  peluqueria: 'Peluqueria',
  tienda: 'Tienda',
  gimnasio: 'Gimnasio',
  bar: 'Bar',
  hotel: 'Hotel',
  academia: 'Academia',
  otro: 'Negocio',
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('businesses')
    .select('name, address, category, landing_description, logo_url')
    .eq('slug', slug)
    .eq('landing_enabled', true)
    .maybeSingle()

  if (!data) return { title: 'Pagina no disponible' }

  const categoryLabel = CATEGORY_LABELS[data.category] ?? 'Negocio'
  const title = `${data.name} — ${data.address ? data.address : categoryLabel}`
  const description = data.landing_description ?? `${data.name} — ${categoryLabel}`

  return {
    title,
    description: description.substring(0, 160),
    openGraph: {
      title,
      description: description.substring(0, 160),
      images: data.logo_url ? [{ url: data.logo_url }] : [],
    },
  }
}

export default async function NegocioPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!business || !business.landing_enabled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F9FAFB] text-center px-6">
        <p className="text-2xl font-semibold text-[#111827] mb-2">Esta pagina no esta disponible</p>
        <p className="text-sm text-[#374151] mb-6">El negocio no ha activado su pagina publica todavia.</p>
        <a href="/" className="text-sm text-[#2563EB] hover:underline">Volver al inicio</a>
      </div>
    )
  }

  const biz = business as Business
  const accentColor = biz.primary_color || '#2563EB'
  const gallery: string[] = (biz.landing_gallery as string[]) ?? []
  const categoryLabel = CATEGORY_LABELS[biz.category] ?? 'Negocio'

  // Fetch menu if configured to show
  let menuData: { slug: string; sections: MenuSection[] } | null = null
  if (biz.landing_show_menu) {
    const { data: menu } = await supabase
      .from('menus')
      .select('slug, sections')
      .eq('business_id', biz.id)
      .eq('is_published', true)
      .maybeSingle()
    if (menu) {
      menuData = menu as { slug: string; sections: MenuSection[] }
    }
  }

  // Fetch Google connection for reviews
  let reviews: Review[] = []
  if (biz.landing_show_reviews) {
    const { data: googleConn } = await supabase
      .from('social_connections')
      .select('platform_user_id, access_token')
      .eq('business_id', biz.id)
      .eq('platform', 'google')
      .eq('is_active', true)
      .maybeSingle()

    if (googleConn) {
      try {
        const apiRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${googleConn.platform_user_id}/reviews?pageSize=10`,
          { headers: { Authorization: `Bearer ${googleConn.access_token}` }, next: { revalidate: 3600 } }
        )
        if (apiRes.ok) {
          const apiData = await apiRes.json()
          const allReviews: Review[] = apiData.reviews ?? []
          reviews = allReviews
            .filter((r: Review) => ['FIVE', 'FOUR'].includes(r.star_rating))
            .slice(0, 3)
        }
      } catch {
        // Reviews unavailable — skip silently
      }
    }
  }

  // Fetch social connections
  const { data: socialConns } = await supabase
    .from('social_connections')
    .select('platform, platform_username, is_active')
    .eq('business_id', biz.id)
    .eq('is_active', true)
    .in('platform', ['instagram', 'facebook'])

  const socials: SocialConnection[] = (socialConns as SocialConnection[]) ?? []

  const phone = biz.phone?.replace(/\s+/g, '') ?? null
  const waPhone = phone?.replace(/^\+/, '') ?? null
  const mapsQuery = biz.address ? encodeURIComponent(`${biz.name} ${biz.address}`) : null

  function StarText({ rating }: { rating: string }) {
    const map: Record<string, string> = {
      FIVE: '5 / 5',
      FOUR: '4 / 5',
      THREE: '3 / 5',
      TWO: '2 / 5',
      ONE: '1 / 5',
    }
    return <span style={{ fontSize: 13, color: '#F59E0B', fontWeight: 600 }}>{map[rating] ?? rating}</span>
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#F9FAFB' }}>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section
        style={{ backgroundColor: `${accentColor}18`, paddingTop: 60, paddingBottom: 60 }}
        className="text-center px-6"
      >
        <div className="max-w-[640px] mx-auto flex flex-col items-center gap-4">
          {biz.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={biz.logo_url}
              alt={biz.name}
              style={{ width: 80, height: 80, borderRadius: 16, objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
            />
          )}

          <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111827', margin: 0 }}>{biz.name}</h1>

          <p style={{ fontSize: 16, color: '#374151', margin: 0 }}>
            {categoryLabel}{biz.address ? ` en ${biz.address.split(',').pop()?.trim() ?? biz.address}` : ''}
          </p>

          {biz.landing_description && (
            <p style={{ fontSize: 16, color: '#374151', maxWidth: 600, margin: 0 }}>
              {biz.landing_description}
            </p>
          )}

          {/* CTA buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {biz.landing_cta_phone && phone && (
              <a
                href={`tel:${phone}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  backgroundColor: accentColor, color: '#fff',
                  padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
                {biz.landing_cta_text || 'Llamar'}
              </a>
            )}

            {biz.landing_cta_whatsapp && waPhone && (
              <a
                href={`https://wa.me/${waPhone}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  backgroundColor: '#fff', color: '#111827',
                  border: '1px solid #E5E7EB',
                  padding: '10px 20px', borderRadius: 8, fontWeight: 500, fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            )}

            {biz.landing_cta_maps && mapsQuery && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  backgroundColor: '#fff', color: '#111827',
                  border: '1px solid #E5E7EB',
                  padding: '10px 20px', borderRadius: 8, fontWeight: 500, fontSize: 15,
                  textDecoration: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Ver en Maps
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── GALERIA ──────────────────────────────────────────────────── */}
      {gallery.length > 0 && (
        <section className="max-w-[900px] mx-auto px-6 py-12">
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
            Nuestro espacio
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            {gallery.slice(0, 6).map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Foto ${i + 1}`}
                style={{
                  width: '100%', aspectRatio: '1/1', objectFit: 'cover',
                  borderRadius: 12, display: 'block',
                }}
              />
            ))}
          </div>
          {gallery.length > 6 && (
            <details className="mt-4">
              <summary
                style={{ cursor: 'pointer', fontSize: 14, color: accentColor, fontWeight: 500 }}
              >
                Ver mas fotos ({gallery.length - 6} mas)
              </summary>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 12, marginTop: 12,
                }}
              >
                {gallery.slice(6).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={`Foto ${i + 7}`}
                    style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 12 }}
                  />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {/* ── CARTA ────────────────────────────────────────────────────── */}
      {menuData && (
        <section className="max-w-[900px] mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0 }}>Nuestra carta</h2>
            <a
              href={`/menu/${menuData.slug}`}
              style={{ fontSize: 14, color: accentColor, textDecoration: 'none', fontWeight: 500 }}
            >
              Ver carta completa
            </a>
          </div>

          {(menuData.sections as MenuSection[])
            .sort((a: MenuSection, b: MenuSection) => {
              const aPos = (a as unknown as { position: number }).position ?? 0
              const bPos = (b as unknown as { position: number }).position ?? 0
              return aPos - bPos
            })
            .slice(0, 3)
            .map((section: MenuSection) => (
              <div key={section.id} className="mb-6">
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  {section.name}
                </h3>
                <div className="flex flex-col gap-2">
                  {section.items
                    .filter((item) => item.is_available)
                    .slice(0, 3)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 bg-white rounded-xl border border-[#E5E7EB] px-4 py-3"
                      >
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: 0 }}>
                            {item.name}
                          </p>
                          {item.description && (
                            <p style={{ fontSize: 12, color: '#374151', margin: '2px 0 0' }}>
                              {item.description}
                            </p>
                          )}
                        </div>
                        {item.price !== undefined && (
                          <span style={{ fontSize: 14, fontWeight: 600, color: accentColor, whiteSpace: 'nowrap' }}>
                            {(item.price as number).toFixed(2)} EUR
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </section>
      )}

      {/* ── RESENAS ──────────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <section style={{ backgroundColor: '#F3F4F6' }} className="py-12">
          <div className="max-w-[900px] mx-auto px-6">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
              Lo que dicen nuestros clientes
            </h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 16,
              }}
            >
              {reviews.map((review, i) => (
                <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <div className="flex items-center justify-between mb-2">
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                      {review.reviewer_display_name}
                    </p>
                    <StarText rating={review.star_rating} />
                  </div>
                  <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                    {review.comment?.substring(0, 150)}
                    {(review.comment?.length ?? 0) > 150 ? '...' : ''}
                  </p>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: '#4B5563', marginTop: 16 }}>
              Resenas verificadas de Google Business
            </p>
          </div>
        </section>
      )}

      {/* ── CONTACTO ─────────────────────────────────────────────────── */}
      <section className="max-w-[900px] mx-auto px-6 py-12">
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
          Informacion de contacto
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 16,
          }}
        >
          {biz.address && (
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" className="shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p style={{ fontSize: 12, color: '#374151', margin: '0 0 2px' }}>Direccion</p>
                <p style={{ fontSize: 14, color: '#111827', margin: 0 }}>{biz.address}</p>
              </div>
            </div>
          )}

          {biz.phone && (
            <div className="flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" className="shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <p style={{ fontSize: 12, color: '#374151', margin: '0 0 2px' }}>Telefono</p>
                <a href={`tel:${biz.phone}`} style={{ fontSize: 14, color: accentColor, textDecoration: 'none' }}>
                  {biz.phone}
                </a>
              </div>
            </div>
          )}

          {socials.map((conn) => {
            const isInstagram = conn.platform === 'instagram'
            const baseUrl = isInstagram ? 'https://instagram.com/' : 'https://facebook.com/'
            if (!conn.platform_username) return null
            return (
              <div key={conn.platform} className="flex items-start gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#374151" className="shrink-0 mt-0.5">
                  {isInstagram ? (
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  ) : (
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  )}
                </svg>
                <div>
                  <p style={{ fontSize: 12, color: '#374151', margin: '0 0 2px', textTransform: 'capitalize' }}>
                    {conn.platform}
                  </p>
                  <a
                    href={`${baseUrl}${conn.platform_username}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 14, color: accentColor, textDecoration: 'none' }}
                  >
                    @{conn.platform_username}
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: '#111827', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{biz.name}</p>
        <p style={{ color: '#4B5563', fontSize: 12, margin: 0 }}>Creado con MarketingIA</p>
      </footer>
    </div>
  )
}


