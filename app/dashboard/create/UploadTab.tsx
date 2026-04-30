'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  BookmarkPlus, Calendar, ChevronDown, ChevronUp, FileText, Hash,
  LayoutGrid, Layers, PanelTop, Play, RectangleHorizontal,
  Scissors, Smartphone, Square, Upload, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { POST_FORMATS, getFirstFormat } from '@/lib/post-formats'
import type { PostFormat } from '@/lib/post-formats'
import type { Business, SocialPlatform } from '@/types'

const PostEditor = dynamic(() => import('@/components/PostEditor'), { ssr: false })
const VideoEditor = dynamic(() => import('@/components/VideoEditor'), { ssr: false })

// ── Platform SVG icons ────────────────────────────────────────────────────────
function IgIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="0.8" fill={color} stroke="none" />
    </svg>
  )
}
function FbIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}
function TkIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.77 1.52V6.75a4.85 4.85 0 01-1-.06z" />
    </svg>
  )
}
function WaIcon({ size = 16, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}
function GgIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

// ── Format icon map ───────────────────────────────────────────────────────────
const FORMAT_ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  Square: Square, Smartphone: Smartphone, LayoutGrid: LayoutGrid,
  RectangleHorizontal: RectangleHorizontal, PanelTop: PanelTop,
  Calendar: Calendar, FileText: FileText, Play: Play,
}

const FORMAT_REF_ROWS = [
  { platform: 'Instagram', type: 'Post',      resolution: '1080x1080', ratio: '1:1'    },
  { platform: 'Instagram', type: 'Historia',  resolution: '1080x1920', ratio: '9:16'   },
  { platform: 'Facebook',  type: 'Post',      resolution: '1200x630',  ratio: '1.91:1' },
  { platform: 'TikTok',    type: 'Video',     resolution: '1080x1920', ratio: '9:16'   },
  { platform: 'WhatsApp',  type: 'Imagen',    resolution: '1080x1080', ratio: '1:1'    },
  { platform: 'YouTube',   type: 'Miniatura', resolution: '1280x720',  ratio: '16:9'   },
]

// ── Export formats (Feature 2) ────────────────────────────────────────────────
interface ExportFormat { id: string; platform: string; label: string; width: number; height: number; defaultOn: boolean }
const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'ig_post',       platform: 'Instagram', label: 'Post cuadrado 1080x1080',   width: 1080, height: 1080, defaultOn: true  },
  { id: 'ig_historia',   platform: 'Instagram', label: 'Historia 1080x1920',         width: 1080, height: 1920, defaultOn: true  },
  { id: 'ig_carrusel',   platform: 'Instagram', label: 'Carrusel 1080x1080',         width: 1080, height: 1080, defaultOn: false },
  { id: 'ig_horizontal', platform: 'Instagram', label: 'Horizontal 1080x566',        width: 1080, height: 566,  defaultOn: false },
  { id: 'fb_post',       platform: 'Facebook',  label: 'Post 1200x630',              width: 1200, height: 630,  defaultOn: true  },
  { id: 'fb_historia',   platform: 'Facebook',  label: 'Historia 1080x1920',         width: 1080, height: 1920, defaultOn: false },
  { id: 'fb_portada',    platform: 'Facebook',  label: 'Portada 1640x624',           width: 1640, height: 624,  defaultOn: false },
  { id: 'tk_video',      platform: 'TikTok',    label: 'Video vertical 1080x1920',   width: 1080, height: 1920, defaultOn: true  },
  { id: 'wa_imagen',     platform: 'WhatsApp',  label: 'Imagen 1080x1080',           width: 1080, height: 1080, defaultOn: false },
  { id: 'yt_miniatura',  platform: 'YouTube',   label: 'Miniatura 1280x720',         width: 1280, height: 720,  defaultOn: false },
  { id: 'li_post',       platform: 'LinkedIn',  label: 'Post 1200x627',              width: 1200, height: 627,  defaultOn: false },
]

// ── Filter presets (Feature 3) ────────────────────────────────────────────────
interface FilterPreset { id: string; label: string; brightness: number; contrast: number; saturation: number; extra: string }
const FILTER_PRESETS: FilterPreset[] = [
  { id: 'normal',    label: 'Normal',       brightness: 0,   contrast: 0,   saturation: 0,    extra: ''                     },
  { id: 'vintage',   label: 'Vintage',      brightness: -10, contrast: 20,  saturation: -30,  extra: 'sepia(0.4)'           },
  { id: 'bnw',       label: 'Blanco y negro', brightness: 0, contrast: 20,  saturation: -100, extra: ''                     },
  { id: 'warm',      label: 'Calido',       brightness: 10,  contrast: 10,  saturation: 40,   extra: 'hue-rotate(-15deg)'   },
  { id: 'cold',      label: 'Frio',         brightness: 5,   contrast: 5,   saturation: -10,  extra: 'hue-rotate(30deg)'    },
  { id: 'dark',      label: 'Oscuro',       brightness: -30, contrast: 40,  saturation: 0,    extra: ''                     },
  { id: 'bright',    label: 'Brillante',    brightness: 20,  contrast: 0,   saturation: 30,   extra: ''                     },
  { id: 'matte',     label: 'Mate',         brightness: 0,   contrast: -20, saturation: -20,  extra: ''                     },
  { id: 'dramatic',  label: 'Dramatico',    brightness: -10, contrast: 60,  saturation: -50,  extra: ''                     },
]

// ── Hashtag library data (Feature 10) ────────────────────────────────────────
const HASHTAG_LIBRARY: Record<string, { high: string[]; medium: string[]; specific: string[] }> = {
  restaurante: {
    high:     ['#food', '#foodie', '#restaurant', '#comida', '#gastronomia', '#foodphotography'],
    medium:   ['#restauranteespana', '#foodlovers', '#instafood', '#lunchtime', '#dinner'],
    specific: ['#menudel dia', '#restaurantelocal', '#comidasana', '#chef', '#plato'],
  },
  peluqueria: {
    high:     ['#hair', '#hairstyle', '#haircut', '#beauty', '#peluqueria'],
    medium:   ['#hairtransformation', '#haircolor', '#salon', '#hairdresser'],
    specific: ['#peinado', '#coloracion', '#keratina', '#cortedepelo', '#peluqueriaespana'],
  },
  gimnasio: {
    high:     ['#gym', '#fitness', '#workout', '#ejercicio', '#fit'],
    medium:   ['#gymmotivation', '#entrenamiento', '#musculacion', '#crossfit'],
    specific: ['#gimnasioespana', '#rutinadeejercicio', '#personaltrainer', '#musculo'],
  },
  tienda: {
    high:     ['#shopping', '#tienda', '#shop', '#moda', '#compras'],
    medium:   ['#tiendaonline', '#nuevacoleccion', '#ofertas', '#descuentos'],
    specific: ['#tiendaespana', '#modaespanola', '#coleccion', '#rebajas', '#novedad'],
  },
  hotel: {
    high:     ['#hotel', '#travel', '#viaje', '#turismo', '#vacation'],
    medium:   ['#hoteles', '#travelgram', '#holiday', '#escapada'],
    specific: ['#hotelespana', '#alojamiento', '#suite', '#resort', '#spa'],
  },
  clinica: {
    high:     ['#salud', '#health', '#medicina', '#clinica', '#bienestar'],
    medium:   ['#cuidadodelasalud', '#medico', '#fisioterapia', '#nutricion'],
    specific: ['#clinicaespana', '#tratamiento', '#consulta', '#especialista', '#prevencion'],
  },
  academia: {
    high:     ['#educacion', '#aprender', '#academia', '#formacion', '#estudio'],
    medium:   ['#cursoonline', '#clases', '#aprendizaje', '#ensenanza'],
    specific: ['#academiaespana', '#cursos', '#certificacion', '#oposiciones', '#idiomas'],
  },
  inmobiliaria: {
    high:     ['#inmobiliaria', '#casas', '#pisos', '#realestate', '#vivienda'],
    medium:   ['#compraventa', '#alquiler', '#propiedades', '#hogar'],
    specific: ['#inmobiliariaespana', '#pisoenalquiler', '#casaenventa', '#hipoteca', '#investmentproperty'],
  },
}

const HASHTAG_SECTORS = [
  { id: 'restaurante', label: 'Restaurante' },
  { id: 'peluqueria',  label: 'Peluqueria'  },
  { id: 'gimnasio',    label: 'Gimnasio'    },
  { id: 'tienda',      label: 'Tienda'      },
  { id: 'hotel',       label: 'Hotel'       },
  { id: 'clinica',     label: 'Clinica'     },
  { id: 'academia',    label: 'Academia'    },
  { id: 'inmobiliaria',label: 'Inmobiliaria'},
]

// ── Platform meta ─────────────────────────────────────────────────────────────
const PLATFORM_META: Record<SocialPlatform, { label: string; Icon: (p: { size?: number; color: string }) => React.ReactElement; color: string }> = {
  instagram: { label: 'Instagram', Icon: IgIcon, color: '#E1306C' },
  facebook:  { label: 'Facebook',  Icon: FbIcon, color: '#1877F2' },
  tiktok:    { label: 'TikTok',    Icon: TkIcon, color: '#111827' },
  whatsapp:  { label: 'WhatsApp',  Icon: WaIcon, color: '#25D366' },
  google:    { label: 'Google',    Icon: ({ size }) => <GgIcon size={size} />, color: '#4285F4' },
}

const CHAR_LIMITS: Record<SocialPlatform, number> = {
  instagram: 2200, facebook: 63206, tiktok: 2200, whatsapp: 1024, google: 1500,
}

const PLACEHOLDERS: Record<SocialPlatform, string> = {
  instagram: 'Escribe el texto de tu post. Puedes usar hashtags al final.',
  facebook:  'Que quieres compartir con tu audiencia?',
  tiktok:    'Describe tu video y anade hashtags relevantes',
  whatsapp:  'Escribe el mensaje para tus clientes',
  google:    'Escribe el texto de tu publicacion',
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface TextOverlay {
  id: string; text: string; x: number; y: number
  color: string; font: string; size: number; bold: boolean; italic: boolean; shadow: boolean
}

interface TemplateData {
  id: string; title: string; fabric_json: object; canvas_width: number; canvas_height: number
}

interface UploadTabProps {
  business: Business
  userId: string
  connectedNetworks: Array<{ platform: SocialPlatform; platform_username: string | null; is_professional: boolean | null }>
  isAdmin?: boolean
  initialTemplate?: TemplateData
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
function formatScheduledDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
}
function buildFilterString(br: number, co: number, sa: number, extra = '') {
  let f = `brightness(${1 + br / 100}) contrast(${1 + co / 100}) saturate(${1 + sa / 100})`
  if (extra) f += ' ' + extra
  return f
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: '#9CA3AF', marginBottom: 8, display: 'block',
}
const SECTION_STYLE: React.CSSProperties = { marginBottom: 20 }
const BTN_SECONDARY: React.CSSProperties = {
  background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
  padding: '7px 14px', fontSize: 12, fontWeight: 500, color: '#374151', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
}

// ── Toggle helper ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      onClick={() => onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10,
        background: value ? '#1A56DB' : '#E5E7EB',
        position: 'relative', flexShrink: 0, cursor: 'pointer',
        transition: 'background 0.2s', display: 'inline-block',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: value ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%', background: '#FFFFFF',
        transition: 'left 0.2s',
      }} />
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

// ── File format validation ────────────────────────────────────────────────────
const FORMAT_RULES: Record<string, { allowedFormats: string[]; allowedMimes: string[]; notSupported: string[] }> = {
  instagram: {
    allowedFormats: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
    allowedMimes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
    notSupported: ['gif', 'webp'],
  },
  facebook: {
    allowedFormats: ['jpg', 'jpeg', 'png', 'mp4', 'mov', 'gif'],
    allowedMimes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime', 'image/gif'],
    notSupported: ['webp'],
  },
  tiktok: {
    allowedFormats: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
    allowedMimes: ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'],
    notSupported: ['gif', 'webp'],
  },
  google: {
    allowedFormats: ['jpg', 'jpeg', 'png'],
    allowedMimes: ['image/jpeg', 'image/png'],
    notSupported: ['gif', 'webp', 'mp4', 'mov'],
  },
}

function validateFile(
  file: File,
  selectedPlatforms: string[]
): { warnings: string[]; errors: string[]; excludedPlatforms: string[] } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type
  const isVideo = mime.startsWith('video/')

  const warnings: string[] = []
  const errors: string[] = []
  const excludedPlatforms: string[] = []

  if (file.size > 50 * 1024 * 1024) {
    errors.push('El archivo supera el limite de 50MB.')
  }

  if (ext === 'webp') {
    errors.push('El formato WEBP no es compatible con ninguna red social. Convierte la imagen a JPG o PNG.')
    return { warnings, errors, excludedPlatforms }
  }

  if (ext === 'gif') {
    warnings.push('Los GIF solo son compatibles con Facebook.')
    excludedPlatforms.push(...selectedPlatforms.filter((p) => p !== 'facebook'))
  }

  if (ext === 'mov') {
    warnings.push('El formato MOV es de iPhone. Si tienes problemas al publicar, convierte el video a MP4.')
  }

  if (isVideo && selectedPlatforms.includes('google')) {
    warnings.push('Google Business no admite videos. Se excluira de esta publicacion.')
    if (!excludedPlatforms.includes('google')) excludedPlatforms.push('google')
  }

  if (!isVideo && selectedPlatforms.includes('tiktok')) {
    const remaining = selectedPlatforms.filter((p) => p !== 'tiktok')
    if (remaining.length > 0) {
      warnings.push('TikTok solo admite videos. Se excluira de esta publicacion.')
    } else {
      errors.push('TikTok solo admite videos. Selecciona otra red para continuar.')
    }
    if (!excludedPlatforms.includes('tiktok')) excludedPlatforms.push('tiktok')
  }

  const remaining = selectedPlatforms.filter((p) => !excludedPlatforms.includes(p))
  if (remaining.length === 0 && errors.length === 0) {
    errors.push('Ninguna red social seleccionada es compatible con este tipo de archivo.')
  }

  return { warnings, errors, excludedPlatforms }
}

// ── Component ─────────────────────────────────────────────────────────────────
export function UploadTab({ business, userId, connectedNetworks, isAdmin = false, initialTemplate }: UploadTabProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [activeTemplate, setActiveTemplate] = useState<TemplateData | null>(initialTemplate ?? null)

  // Feature 7: multi-platform
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>(
    connectedNetworks.length > 0 ? [connectedNetworks[0].platform] : []
  )
  const primaryPlatform = selectedPlatforms[0] ?? null

  const [postType, setPostType] = useState<string | null>(() => {
    const p = connectedNetworks.length > 0 ? connectedNetworks[0].platform : null
    if (!p) return null
    return getFirstFormat(p)?.typeKey ?? null
  })
  const [showDimModal, setShowDimModal] = useState(false)

  // Feature 11: custom dimensions
  const [showCustomDim, setShowCustomDim] = useState(false)
  const [customWidth, setCustomWidth] = useState(1080)
  const [customHeight, setCustomHeight] = useState(1080)
  const [customRatio, setCustomRatio] = useState('')
  const [customFormat, setCustomFormat] = useState<PostFormat | null>(null)
  const isCustomType = postType === '__custom__'

  const currentFormat: PostFormat | null = useMemo(() => {
    if (isCustomType && customFormat) return customFormat
    if (!primaryPlatform || !postType) return null
    return POST_FORMATS[primaryPlatform]?.[postType] ?? null
  }, [primaryPlatform, postType, isCustomType, customFormat])

  // File state
  const [file, setFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Text
  const [text, setText] = useState('')
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Options
  const [showOptions, setShowOptions] = useState(false)
  const [includeLocation, setIncludeLocation] = useState(false)
  const [locationName, setLocationName] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')

  // Feature 8: quick schedule
  const [showExactDate, setShowExactDate] = useState(false)

  // Upload / publish
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishProgress, setPublishProgress] = useState<Record<string, 'idle' | 'loading' | 'done' | 'error'>>({})
  const [savingDraft, setSavingDraft] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ platform?: string; file?: string; text?: string }>({})
  const [lastInsertError, setLastInsertError] = useState('')
  const [fileWarnings, setFileWarnings] = useState<string[]>([])
  const [fileErrors, setFileErrors] = useState<string[]>([])

  // Feature 1: remove bg
  const [removingBg, setRemovingBg] = useState(false)

  // Video editor
  const [videoEdited, setVideoEdited] = useState(false)

  // Feature 2: export formats
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportSelections, setExportSelections] = useState<Set<string>>(
    new Set(EXPORT_FORMATS.filter((f) => f.defaultOn).map((f) => f.id))
  )
  const [exportingZip, setExportingZip] = useState(false)
  const [customExportW, setCustomExportW] = useState(1080)
  const [customExportH, setCustomExportH] = useState(1080)
  const [showCustomExport, setShowCustomExport] = useState(false)

  // Feature 3: filters
  const [filterTab, setFilterTab] = useState<'ajustes' | 'filtros'>('ajustes')
  const [brightness, setBrightness] = useState(0)
  const [contrastVal, setContrastVal] = useState(0)
  const [saturation, setSaturation] = useState(0)
  const [activePreset, setActivePreset] = useState('normal')

  // Feature 4: text overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([])
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null)
  const draggingRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  const imageWorkspaceRef = useRef<HTMLDivElement>(null)

  // Feature 5: watermark
  const [showWatermark, setShowWatermark] = useState(false)
  const [wmPosition, setWmPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'>('bottom-right')
  const [wmSize, setWmSize] = useState(80)
  const [wmOpacity, setWmOpacity] = useState(85)

  // Feature 6: mobile preview
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [mobileNet, setMobileNet] = useState<'instagram' | 'facebook' | 'tiktok'>('instagram')

  // Feature 9: template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('post')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Feature 10: hashtag library
  const [showHashtagLib, setShowHashtagLib] = useState(false)
  const [hashtagSector, setHashtagSector] = useState<string>(business.category in HASHTAG_LIBRARY ? business.category : 'restaurante')
  const [selectedLibHashtags, setSelectedLibHashtags] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Computed
  const isVideo = file?.type.startsWith('video/') ?? false
  const isImage = file?.type.startsWith('image/') ?? false

  // True when Instagram is selected but its account is personal (can't auto-publish)
  const igNotProfessional = selectedPlatforms.includes('instagram') &&
    connectedNetworks.some((n) => n.platform === 'instagram' && n.is_professional === false)
  const charLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map((p) => CHAR_LIMITS[p]))
    : 2200
  const charPct = text.length / charLimit
  const counterColor = charPct > 0.95 ? '#DC2626' : charPct > 0.8 ? '#D97706' : '#9CA3AF'
  const minDateTime = new Date().toISOString().slice(0, 16)

  const cssFilter = useMemo(
    () => buildFilterString(brightness, contrastVal, saturation,
      FILTER_PRESETS.find((f) => f.id === activePreset)?.extra ?? ''),
    [brightness, contrastVal, saturation, activePreset]
  )

  const wmPositionStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'absolute', width: wmSize, height: wmSize, opacity: wmOpacity / 100 }
    if (wmPosition === 'bottom-right') return { ...base, bottom: 8, right: 8 }
    if (wmPosition === 'bottom-left') return { ...base, bottom: 8, left: 8 }
    if (wmPosition === 'top-right') return { ...base, top: 8, right: 8 }
    if (wmPosition === 'top-left') return { ...base, top: 8, left: 8 }
    return { ...base, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  }, [wmPosition, wmSize, wmOpacity])

  useEffect(() => { return () => { if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl) } }, [filePreviewUrl])
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  // Drag handlers for text overlays
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current) return
      const { id, startX, startY, origX, origY } = draggingRef.current
      setTextOverlays((prev) =>
        prev.map((ov) => ov.id === id ? { ...ov, x: origX + e.clientX - startX, y: origY + e.clientY - startY } : ov)
      )
    }
    function onMouseUp() { draggingRef.current = null }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
  }, [])

  function handleFileSelect(selected: File) {
    const isImg = selected.type.startsWith('image/')
    const isVid = selected.type.startsWith('video/')
    if (!isImg && !isVid) {
      setFieldErrors((e) => ({ ...e, file: 'Formato no soportado.' }))
      setFileWarnings([])
      setFileErrors([])
      return
    }

    const result = validateFile(selected, selectedPlatforms)
    setFileWarnings(result.warnings)
    setFileErrors(result.errors)

    if (result.excludedPlatforms.length > 0) {
      setSelectedPlatforms((prev) => prev.filter((p) => !result.excludedPlatforms.includes(p)))
    }

    if (result.errors.length > 0) return

    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    const url = URL.createObjectURL(selected)
    setFile(selected); setFilePreviewUrl(url); setUploadedUrl(null); setVideoDuration(null)
    setFieldErrors((e) => ({ ...e, file: undefined }))
    setVideoEdited(false)
    setTextOverlays([]); setSelectedOverlayId(null); setBrightness(0); setContrastVal(0); setSaturation(0); setActivePreset('normal')
    if (isVid) { const v = document.createElement('video'); v.src = url; v.onloadedmetadata = () => setVideoDuration(v.duration) }
  }

  function handleDrop(e: React.DragEvent) { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f) }

  function handleRemoveFile() {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    setFile(null); setFilePreviewUrl(null); setUploadedUrl(null); setVideoDuration(null)
    setVideoEdited(false)
    setTextOverlays([]); setShowWatermark(false)
    setFileWarnings([])
    setFileErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function suggestHashtags() {
    if (!text.trim()) { setToast({ message: 'Escribe texto primero.', type: 'error' }); return }
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/generate/hashtags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), platform: primaryPlatform ?? 'instagram', business_type: business.category }),
      })
      const data = await res.json()
      if (res.ok && Array.isArray(data.hashtags)) setSuggestedHashtags(data.hashtags)
      else setToast({ message: 'No se pudieron generar hashtags.', type: 'error' })
    } catch { setToast({ message: 'No se pudieron generar hashtags.', type: 'error' }) }
    finally { setLoadingSuggestions(false) }
  }

  function addHashtag(tag: string) {
    const sep = text.length > 0 && !text.endsWith('\n') ? '\n' : ''
    setText((t) => t + sep + tag + ' ')
    setSuggestedHashtags((prev) => prev.filter((h) => h !== tag))
  }

  async function runUpload(): Promise<string | null> {
    if (!file) return uploadedUrl
    setUploadProgress(0)
    let pct = 0
    progressTimerRef.current = setInterval(() => { pct = Math.min(pct + 12, 90); setUploadProgress(pct) }, 180)
    try {
      const ts = Date.now(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${business.id}/uploads/${ts}_${safeName}`
      const { data, error } = await supabase.storage.from('generated-images').upload(path, file, { contentType: file.type, upsert: false })
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      if (error || !data) { setUploadProgress(null); return null }
      setUploadProgress(100)
      const { data: u } = supabase.storage.from('generated-images').getPublicUrl(data.path)
      setUploadedUrl(u.publicUrl)
      setTimeout(() => setUploadProgress(null), 600)
      return u.publicUrl
    } catch { if (progressTimerRef.current) clearInterval(progressTimerRef.current); setUploadProgress(null); return null }
  }

  async function insertPost(fileUrl: string | null, status: string): Promise<{ id: string; [k: string]: unknown } | null> {
    const isImg = (file?.type.startsWith('image/') ?? true) || fileUrl === null
    const content = text.trim()
    const sched = scheduleEnabled && scheduledAt ? scheduledAt : null
    const attempts: Record<string, unknown>[] = [
      { business_id: business.id, user_id: userId, content, content_text: content, image_url: isImg ? fileUrl : null, video_url: !isImg ? fileUrl : null, media_url: fileUrl, platforms: selectedPlatforms, platform: primaryPlatform ?? null, status, scheduled_at: sched, hashtags: [], is_suggestion: false },
      { business_id: business.id, user_id: userId, content, content_text: content, image_url: isImg ? fileUrl : null, platforms: selectedPlatforms, status, scheduled_at: sched, hashtags: [], is_suggestion: false },
      { business_id: business.id, user_id: userId, content, image_url: isImg ? fileUrl : null, platforms: selectedPlatforms, status, scheduled_at: sched, hashtags: [], is_suggestion: false },
      { business_id: business.id, content, image_url: isImg ? fileUrl : null, platforms: selectedPlatforms, status, scheduled_at: sched, hashtags: [], is_suggestion: false },
    ]
    let lastErr = ''
    for (const payload of attempts) {
      const { data, error } = await supabase.from('posts').insert([payload]).select('*').single()
      if (!error && data) return data as { id: string; [k: string]: unknown }
      if (error?.message) lastErr = error.message
    }
    setLastInsertError(lastErr)
    return null
  }

  async function handlePublish() {
    const errors: typeof fieldErrors = {}
    if (selectedPlatforms.length === 0) errors.platform = 'Selecciona al menos una plataforma'
    if (!text.trim()) errors.text = 'Escribe el texto del post'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    // ── Token validity check ──────────────────────────────────────────
    const { data: tokenRows } = await supabase
      .from('social_connections')
      .select('platform, is_valid, expires_at')
      .eq('business_id', business.id)
      .in('platform', selectedPlatforms)

    const invalidConns = (tokenRows ?? []).filter((c) => c.is_valid === false)
    if (invalidConns.length > 0) {
      const names = invalidConns.map((c: { platform: string }) => c.platform).join(', ')
      setFieldErrors((e) => ({ ...e, platform: `Las siguientes redes necesitan reconexion: ${names}. Ve a Redes sociales y vuelve a conectarlas.` }))
      return
    }

    const expiredConns = (tokenRows ?? []).filter(
      (c) => c.expires_at && new Date(c.expires_at) < new Date()
    )
    if (expiredConns.length > 0) {
      await fetch('/api/connections/refresh', { method: 'POST' })
    }

    setPublishing(true)
    const initProgress: Record<string, 'idle' | 'loading' | 'done' | 'error'> = {}
    selectedPlatforms.forEach((p) => { initProgress[p] = 'loading' })
    setPublishProgress(initProgress)

    try {
      const fileUrl = file ? (uploadedUrl ?? (await runUpload())) : uploadedUrl ?? null
      if (file && !fileUrl) { setToast({ message: 'Error al subir el archivo.', type: 'error' }); return }
      const status = scheduleEnabled ? 'scheduled' : 'draft'
      const postData = await insertPost(fileUrl, status)
      if (!postData) {
        setToast({ message: lastInsertError ? `Error: ${lastInsertError.slice(0, 90)}` : 'Error al crear el post.', type: 'error' })
        return
      }
      if (scheduleEnabled) {
        setToast({ message: `Programado para ${formatScheduledDate(scheduledAt)}`, type: 'success' })
        setTimeout(() => router.push('/dashboard/calendar'), 1600)
        return
      }

      const results = await Promise.allSettled(
        selectedPlatforms.map((p) =>
          fetch('/api/publish', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ post_id: postData.id, platforms: [p] }),
          }).then((r) => r.json().then((j) => ({ platform: p, ok: r.ok && j.success !== false, error: j?.error })))
        )
      )

      const newProgress = { ...initProgress }
      let doneCount = 0
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          newProgress[r.value.platform] = r.value.ok ? 'done' : 'error'
          if (r.value.ok) doneCount++
        } else {
          selectedPlatforms.forEach((p) => { if (newProgress[p] === 'loading') newProgress[p] = 'error' })
        }
      })
      setPublishProgress(newProgress)

      const total = selectedPlatforms.length
      if (doneCount === total) {
        setToast({ message: `Publicado en ${doneCount} de ${total} redes`, type: 'success' })
        setTimeout(() => router.push('/dashboard/posts'), 1600)
      } else {
        setToast({ message: `Publicado en ${doneCount} de ${total} redes. Revisa los errores.`, type: doneCount > 0 ? 'success' : 'error' })
      }
    } catch { setToast({ message: 'Error al publicar.', type: 'error' }) }
    finally { setPublishing(false) }
  }

  async function handleEditorExport(dataUrl: string) {
    const arr = dataUrl.split(','); const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1]); let n = bstr.length; const u8arr = new Uint8Array(n)
    while (n--) u8arr[n] = bstr.charCodeAt(n)
    const exportedFile = new File([u8arr], `editor-export-${Date.now()}.png`, { type: mime })
    setUploadProgress(0); let pct = 0
    const timer = setInterval(() => { pct = Math.min(pct + 15, 90); setUploadProgress(pct) }, 150)
    try {
      const path = `${business.id}/uploads/${Date.now()}_editor-export.png`
      const { data, error } = await supabase.storage.from('generated-images').upload(path, exportedFile, { contentType: 'image/png', upsert: false })
      clearInterval(timer)
      if (error || !data) { setUploadProgress(null); setToast({ message: 'Error al guardar la imagen.', type: 'error' }); return }
      setUploadProgress(100)
      const { data: u } = supabase.storage.from('generated-images').getPublicUrl(data.path)
      setUploadedUrl(u.publicUrl); setFilePreviewUrl(dataUrl); setFile(exportedFile)
      setTimeout(() => setUploadProgress(null), 600)
      setToast({ message: 'Imagen guardada. Ahora puedes publicar.', type: 'success' })
    } catch { clearInterval(timer); setUploadProgress(null); setToast({ message: 'Error al guardar la imagen.', type: 'error' }) }
  }

  async function handleVideoExport(processedFile: File) {
    setUploadProgress(0); let pct = 0
    const timer = setInterval(() => { pct = Math.min(pct + 12, 90); setUploadProgress(pct) }, 180)
    try {
      const ts = Date.now()
      const path = `${business.id}/videos/${ts}_editado.mp4`
      const { data, error } = await supabase.storage
        .from('generated-images')
        .upload(path, processedFile, { contentType: 'video/mp4', upsert: false })
      clearInterval(timer)
      if (error || !data) { setUploadProgress(null); setToast({ message: 'Error al guardar el video.', type: 'error' }); return }
      setUploadProgress(100)
      const { data: u } = supabase.storage.from('generated-images').getPublicUrl(data.path)
      setFile(processedFile); setUploadedUrl(u.publicUrl); setVideoEdited(true)
      setTimeout(() => setUploadProgress(null), 600)
      setToast({ message: 'Video editado guardado. Ahora puedes publicar.', type: 'success' })
    } catch {
      clearInterval(timer); setUploadProgress(null)
      setToast({ message: 'Error al guardar el video.', type: 'error' })
    }
  }

  async function handleSaveDraft() {
    if (!text.trim() && !file) { setToast({ message: 'No hay contenido para guardar.', type: 'error' }); return }
    setSavingDraft(true)
    try {
      const fileUrl = file ? (uploadedUrl ?? (await runUpload())) : null
      const postData = await insertPost(fileUrl, 'draft')
      if (!postData) { setToast({ message: lastInsertError ? `Error: ${lastInsertError.slice(0, 90)}` : 'No se pudo guardar.', type: 'error' }); return }
      setToast({ message: 'Borrador guardado.', type: 'success' })
    } catch { setToast({ message: 'No se pudo guardar.', type: 'error' }) }
    finally { setSavingDraft(false) }
  }

  // Feature 1: remove background
  async function handleRemoveBg() {
    if (!uploadedUrl && !file) return
    let imageUrl = uploadedUrl
    if (!imageUrl) { imageUrl = await runUpload(); if (!imageUrl) { setToast({ message: 'Sube la imagen primero.', type: 'error' }); return } }
    setRemovingBg(true)
    try {
      const res = await fetch('/api/image/remove-bg', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl, business_id: business.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) { setToast({ message: data.error ?? 'Error al quitar el fondo.', type: 'error' }); return }
      setFilePreviewUrl(data.url); setUploadedUrl(data.url)
      setToast({ message: 'Fondo eliminado correctamente', type: 'success' })
    } catch { setToast({ message: 'Error al quitar el fondo.', type: 'error' }) }
    finally { setRemovingBg(false) }
  }

  // Feature 2: export ZIP
  async function handleExportZip() {
    if (!filePreviewUrl) return
    setExportingZip(true)
    try {
      const JSZip = (await import('jszip')).default
      const html2canvas = (await import('html2canvas')).default

      let sourceCanvas: HTMLCanvasElement
      if (imageWorkspaceRef.current) {
        sourceCanvas = await html2canvas(imageWorkspaceRef.current, { useCORS: true, allowTaint: true })
      } else {
        const img = new Image(); img.crossOrigin = 'anonymous'; img.src = filePreviewUrl
        await new Promise((res) => { img.onload = res })
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d')!.drawImage(img, 0, 0); sourceCanvas = c
      }

      const zip = new JSZip()
      const selected = EXPORT_FORMATS.filter((f) => exportSelections.has(f.id))
      if (showCustomExport && customExportW > 0 && customExportH > 0) {
        selected.push({ id: 'custom', platform: 'Custom', label: `Personalizado ${customExportW}x${customExportH}`, width: customExportW, height: customExportH, defaultOn: false })
      }
      const ts = Date.now()
      const bname = business.name.replace(/[^a-zA-Z0-9]/g, '_')

      for (const fmt of selected) {
        const c = document.createElement('canvas'); c.width = fmt.width; c.height = fmt.height
        c.getContext('2d')!.drawImage(sourceCanvas, 0, 0, fmt.width, fmt.height)
        const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'))
        zip.file(`${bname}_${fmt.id}_${ts}.png`, blob)
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(zipBlob)
      a.download = `${bname}_formatos_${ts}.zip`; a.click()
      setToast({ message: `${selected.length} formatos exportados`, type: 'success' })
      setShowExportModal(false)
    } catch (err) {
      console.error(err); setToast({ message: 'Error al exportar.', type: 'error' })
    } finally { setExportingZip(false) }
  }

  // Feature 9: save as template
  async function handleSaveTemplate() {
    if (!templateName.trim()) { setToast({ message: 'Escribe un nombre para la plantilla.', type: 'error' }); return }
    setSavingTemplate(true)
    try {
      let previewUrl: string | null = uploadedUrl
      if (file && !previewUrl) { previewUrl = await runUpload() }

      const { error } = await supabase.from('ai_examples').insert([{
        title: templateName.trim(),
        category: templateCategory,
        image_url: previewUrl,
        style_description: text.trim() || null,
        is_template: false,
        business_types: [business.category],
        is_active: true,
      }])

      if (error) { setToast({ message: `Error: ${error.message.slice(0, 80)}`, type: 'error' }); return }
      setToast({ message: 'Plantilla guardada en Ejemplos IA', type: 'success' })
      setShowTemplateModal(false)
    } catch { setToast({ message: 'No se pudo guardar la plantilla.', type: 'error' }) }
    finally { setSavingTemplate(false) }
  }

  // Feature 8: quick schedule
  function applyQuickSchedule(type: string) {
    const now = new Date()
    const d = new Date(now)
    if (type === 'today_12') { d.setHours(12, 0, 0, 0) }
    else if (type === 'today_18') { d.setHours(18, 0, 0, 0) }
    else if (type === 'tomorrow_9') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0) }
    else if (type === 'tomorrow_12') { d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0) }
    else if (type === 'friday_12') {
      const day = d.getDay(); const diff = (5 - day + 7) % 7 || 7
      d.setDate(d.getDate() + diff); d.setHours(12, 0, 0, 0)
    }
    else if (type === 'monday_9') {
      const day = d.getDay(); const diff = (8 - day) % 7 || 7
      d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0)
    }
    setScheduledAt(d.toISOString().slice(0, 16))
  }

  const QUICK_SLOTS = [
    { id: 'today_12',    label: 'Hoy 12:00' },
    { id: 'today_18',    label: 'Hoy 18:00' },
    { id: 'tomorrow_9',  label: 'Manana 9:00' },
    { id: 'tomorrow_12', label: 'Manana 12:00' },
    { id: 'friday_12',   label: 'Este viernes 12:00' },
    { id: 'monday_9',    label: 'Proximo lunes 9:00' },
  ]

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderPlatformSelector = useCallback(() => {
    if (connectedNetworks.length === 0) {
      return (
        <div style={{ padding: '14px 16px', borderRadius: 10, background: '#FFF7ED', border: '1px solid #FED7AA', fontSize: 13, color: '#92400E' }}>
          No tienes redes sociales conectadas.{' '}
          <a href="/dashboard/connections" style={{ color: '#1A56DB', fontWeight: 600, textDecoration: 'none' }}>Conectar redes</a>
        </div>
      )
    }
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {connectedNetworks.map(({ platform: p }) => {
            const meta = PLATFORM_META[p]
            const sel = selectedPlatforms.includes(p)
            return (
              <button key={p}
                onClick={() => {
                  setSelectedPlatforms((prev) => sel ? prev.filter((x) => x !== p) : [...prev, p])
                  if (!sel && selectedPlatforms.length === 0) { const f = getFirstFormat(p); setPostType(f?.typeKey ?? null) }
                  setFieldErrors((e) => ({ ...e, platform: undefined }))
                }}
                style={{ border: `1px solid ${sel ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: sel ? '#EEF3FE' : '#FFFFFF', fontSize: 13, fontWeight: sel ? 600 : 400, color: '#111827' }}
              >
                <meta.Icon size={16} color={meta.color} />
                {meta.label}
                {sel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#1A56DB' }} />}
              </button>
            )
          })}
        </div>
        {selectedPlatforms.length > 1 && (
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#1A56DB', fontWeight: 500 }}>
            Se publicara en {selectedPlatforms.length} redes simultaneamente
          </p>
        )}
      </div>
    )
  }, [connectedNetworks, selectedPlatforms])

  const renderPostTypeSelector = () => {
    if (!primaryPlatform) return null
    const types = POST_FORMATS[primaryPlatform]
    if (!types) return null
    const entries = Object.entries(types)
    return (
      <div style={{ marginTop: 16 }}>
        <span style={LABEL_STYLE}>Tipo de publicacion</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {entries.map(([key, fmt]) => {
            const sel = postType === key && !isCustomType
            const Icon = FORMAT_ICON_MAP[fmt.icon] ?? Square
            return (
              <button key={key} onClick={() => setPostType(key)}
                style={{ border: `1px solid ${sel ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', background: sel ? '#EEF3FE' : '#FFFFFF', color: sel ? '#1A56DB' : '#374151', fontSize: 13, fontWeight: sel ? 600 : 400 }}
              >
                <Icon size={14} color={sel ? '#1A56DB' : '#9CA3AF'} />
                <span>{fmt.label}</span>
                <span style={{ fontSize: 11, color: sel ? '#1A56DB' : '#9CA3AF' }}>· {fmt.ratio}</span>
              </button>
            )
          })}
          {isCustomType && customFormat && (
            <button style={{ border: '1px solid #1A56DB', borderRadius: 8, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', background: '#EEF3FE', color: '#1A56DB', fontSize: 13, fontWeight: 600 }}>
              <Square size={14} color="#1A56DB" />
              <span>Personalizado · {customFormat.realWidth}x{customFormat.realHeight}</span>
            </button>
          )}
        </div>

        {/* Feature 11: custom dimensions */}
        <button onClick={() => setShowCustomDim((v) => !v)}
          style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#1A56DB', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {showCustomDim ? 'Ocultar tamano personalizado' : '+ Tamano personalizado'}
        </button>
        {showCustomDim && (
          <div style={{ marginTop: 10, padding: '12px 14px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={customRatio} onChange={(e) => {
                setCustomRatio(e.target.value)
                if (e.target.value) {
                  const [rw, rh] = e.target.value.split(':').map(Number)
                  setCustomHeight(Math.round(customWidth * rh / rw))
                }
              }} style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#374151', background: '#FFFFFF' }}>
                <option value="">Proporcion</option>
                <option value="1:1">1:1 (cuadrado)</option>
                <option value="9:16">9:16 (vertical)</option>
                <option value="16:9">16:9 (horizontal)</option>
                <option value="4:5">4:5</option>
                <option value="2:3">2:3</option>
              </select>
              <input type="number" min={100} max={5000} value={customWidth} onChange={(e) => {
                const w = parseInt(e.target.value) || 1080
                setCustomWidth(w)
                if (customRatio) { const [rw, rh] = customRatio.split(':').map(Number); setCustomHeight(Math.round(w * rh / rw)) }
              }} placeholder="1080" style={{ width: 80, border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', fontSize: 12, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>x</span>
              <input type="number" min={100} max={5000} value={customHeight} onChange={(e) => setCustomHeight(parseInt(e.target.value) || 1080)} placeholder="1080" style={{ width: 80, border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', fontSize: 12, textAlign: 'center' }} />
              <button onClick={() => {
                const fmt: PostFormat = { label: `Personalizado`, realWidth: customWidth, realHeight: customHeight, displayWidth: 480, displayHeight: Math.round(480 * customHeight / customWidth), ratio: `${customWidth}:${customHeight}`, icon: 'Square' }
                setCustomFormat(fmt); setPostType('__custom__')
              }} style={{ padding: '6px 14px', background: '#1A56DB', color: '#FFFFFF', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Aplicar
              </button>
            </div>
          </div>
        )}

        <button onClick={() => setShowDimModal(true)}
          style={{ marginTop: 6, background: 'none', border: 'none', padding: 0, fontSize: 11, color: '#1A56DB', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          Ver dimensiones recomendadas
        </button>
      </div>
    )
  }

  const renderImageWorkspace = () => {
    if (!isImage || !filePreviewUrl) return null
    const selectedOverlay = textOverlays.find((o) => o.id === selectedOverlayId)

    return (
      <div style={{ marginTop: 12 }}>
        {/* Image preview with overlays */}
        <div ref={imageWorkspaceRef} style={{ position: 'relative', display: 'inline-block', width: '100%', borderRadius: 8, overflow: 'hidden', background: '#F3F4F6' }}
          onClick={() => setSelectedOverlayId(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={filePreviewUrl} alt="preview" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8, filter: cssFilter }} />
          {/* Text overlays */}
          {textOverlays.map((ov) => (
            <div key={ov.id}
              style={{
                position: 'absolute', left: ov.x, top: ov.y, cursor: 'move', userSelect: 'none',
                outline: selectedOverlayId === ov.id ? '2px dashed #1A56DB' : 'none',
                borderRadius: 4, padding: '2px 4px',
              }}
              onMouseDown={(e) => {
                e.stopPropagation()
                setSelectedOverlayId(ov.id)
                draggingRef.current = { id: ov.id, startX: e.clientX, startY: e.clientY, origX: ov.x, origY: ov.y }
              }}
            >
              <span
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setTextOverlays((prev) => prev.map((o) => o.id === ov.id ? { ...o, text: e.currentTarget.textContent ?? o.text } : o))}
                style={{
                  fontSize: ov.size, color: ov.color, fontFamily: ov.font,
                  fontWeight: ov.bold ? 700 : 400, fontStyle: ov.italic ? 'italic' : 'normal',
                  textShadow: ov.shadow ? '1px 1px 3px rgba(0,0,0,0.7)' : 'none',
                  outline: 'none', display: 'block', minWidth: 40,
                }}
              >{ov.text}</span>
            </div>
          ))}
          {/* Watermark */}
          {showWatermark && (business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt="logo" style={{ ...wmPositionStyle, objectFit: 'contain', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
          ) : (
            <span style={{ ...wmPositionStyle, fontSize: 12, fontWeight: 700, color: '#FFFFFF', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap' }}>
              {business.name}
            </span>
          ))}
        </div>

        {/* Floating panel for selected overlay */}
        {selectedOverlay && (
          <div style={{ marginTop: 8, padding: '10px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="color" value={selectedOverlay.color}
              onChange={(e) => setTextOverlays((prev) => prev.map((o) => o.id === selectedOverlayId ? { ...o, color: e.target.value } : o))}
              style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
            <select value={selectedOverlay.font}
              onChange={(e) => setTextOverlays((prev) => prev.map((o) => o.id === selectedOverlayId ? { ...o, font: e.target.value } : o))}
              style={{ border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 6px', fontSize: 12, fontFamily: selectedOverlay.font }}>
              {['Inter', 'Montserrat', 'Playfair Display', 'Oswald'].map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            <input type="number" min={12} max={120} value={selectedOverlay.size}
              onChange={(e) => setTextOverlays((prev) => prev.map((o) => o.id === selectedOverlayId ? { ...o, size: parseInt(e.target.value) || 24 } : o))}
              style={{ width: 56, border: '1px solid #E5E7EB', borderRadius: 6, padding: '4px 6px', fontSize: 12, textAlign: 'center' }} />
            {(['bold', 'italic', 'shadow'] as const).map((prop) => {
              const active = selectedOverlay[prop] as boolean
              return (
                <button key={prop}
                  onClick={() => setTextOverlays((prev) => prev.map((o) => o.id === selectedOverlayId ? { ...o, [prop]: !o[prop] } : o))}
                  style={{ padding: '4px 8px', border: `1px solid ${active ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 6, background: active ? '#EEF3FE' : '#FFFFFF', color: active ? '#1A56DB' : '#374151', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                  {prop === 'bold' ? 'B' : prop === 'italic' ? 'I' : 'Sombra'}
                </button>
              )
            })}
            <button onClick={() => { setTextOverlays((prev) => prev.filter((o) => o.id !== selectedOverlayId)); setSelectedOverlayId(null) }}
              style={{ padding: '4px 8px', border: '1px solid #FCA5A5', borderRadius: 6, background: '#FEF2F2', color: '#DC2626', fontSize: 11, cursor: 'pointer' }}>
              Eliminar
            </button>
          </div>
        )}

        {/* Action row: remove bg, add text, watermark toggle, mobile preview, export */}
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleRemoveBg} disabled={removingBg}
            style={{ ...BTN_SECONDARY, opacity: removingBg ? 0.7 : 1, cursor: removingBg ? 'not-allowed' : 'pointer' }}>
            {removingBg ? <Spinner /> : <Scissors size={13} />}
            {removingBg ? 'Quitando fondo...' : 'Quitar fondo'}
          </button>
          <button
            onClick={() => {
              if (textOverlays.length >= 10) { setToast({ message: 'Maximo 10 elementos de texto.', type: 'error' }); return }
              const id = `ov_${Date.now()}`
              setTextOverlays((prev) => [...prev, { id, text: 'Texto', x: 20, y: 20, color: '#FFFFFF', font: 'Inter', size: 24, bold: false, italic: false, shadow: true }])
              setSelectedOverlayId(id)
            }}
            style={BTN_SECONDARY}>
            + Anadir texto
          </button>
          <button onClick={() => setShowMobilePreview(true)} style={BTN_SECONDARY}>
            <Smartphone size={14} />
            Vista previa movil
          </button>
          <button onClick={() => setShowExportModal(true)} style={BTN_SECONDARY}>
            <Layers size={14} />
            Exportar formatos
          </button>
        </div>

        {/* Feature 3: Filters */}
        <div style={{ marginTop: 14, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E7EB' }}>
            {(['ajustes', 'filtros'] as const).map((tab) => (
              <button key={tab} onClick={() => setFilterTab(tab)}
                style={{ flex: 1, padding: '9px 0', border: 'none', background: filterTab === tab ? '#FFFFFF' : '#F9FAFB', color: filterTab === tab ? '#1A56DB' : '#6B7280', fontSize: 12, fontWeight: filterTab === tab ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                {tab === 'ajustes' ? 'Ajustes' : 'Filtros'}
              </button>
            ))}
          </div>
          <div style={{ padding: '12px 14px' }}>
            {filterTab === 'ajustes' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {([
                  { label: 'Brillo', val: brightness, set: setBrightness },
                  { label: 'Contraste', val: contrastVal, set: setContrastVal },
                  { label: 'Saturacion', val: saturation, set: setSaturation },
                ] as { label: string; val: number; set: (v: number) => void }[]).map(({ label, val, set }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>{label}</span>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{val > 0 ? `+${val}` : val}</span>
                    </div>
                    <input type="range" min={-100} max={100} value={val} onChange={(e) => { set(parseInt(e.target.value)); setActivePreset('normal') }}
                      style={{ width: '100%', accentColor: '#1A56DB' }} />
                  </div>
                ))}
                <button onClick={() => { setBrightness(0); setContrastVal(0); setSaturation(0); setActivePreset('normal') }}
                  style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#6B7280', cursor: 'pointer' }}>
                  Restablecer
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {FILTER_PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => {
                    setActivePreset(preset.id)
                    setBrightness(preset.brightness); setContrastVal(preset.contrast); setSaturation(preset.saturation)
                  }} style={{ border: `2px solid ${activePreset === preset.id ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 8, padding: 6, background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={filePreviewUrl} alt={preset.label}
                      style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, filter: buildFilterString(preset.brightness, preset.contrast, preset.saturation, preset.extra) }} />
                    <span style={{ fontSize: 10, color: activePreset === preset.id ? '#1A56DB' : '#6B7280', fontWeight: activePreset === preset.id ? 600 : 400 }}>{preset.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feature 5: Watermark */}
        <div style={{ marginTop: 12, padding: '12px 14px', border: '1px solid #E5E7EB', borderRadius: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            <Toggle value={showWatermark} onChange={setShowWatermark} />
            Anadir marca de agua
          </label>
          {showWatermark && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posicion</span>
                <select value={wmPosition} onChange={(e) => setWmPosition(e.target.value as typeof wmPosition)}
                  style={{ marginTop: 4, display: 'block', width: '100%', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#374151' }}>
                  <option value="bottom-right">Esquina inferior derecha</option>
                  <option value="bottom-left">Esquina inferior izquierda</option>
                  <option value="top-right">Esquina superior derecha</option>
                  <option value="top-left">Esquina superior izquierda</option>
                  <option value="center">Centro</option>
                </select>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Tamano</span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{wmSize}px</span>
                </div>
                <input type="range" min={40} max={200} value={wmSize} onChange={(e) => setWmSize(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#1A56DB' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#6B7280' }}>Opacidad</span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{wmOpacity}%</span>
                </div>
                <input type="range" min={20} max={100} value={wmOpacity} onChange={(e) => setWmOpacity(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#1A56DB' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderHashtagLibrary = () => (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setShowHashtagLib((v) => !v)}
        style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#1A56DB', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Hash size={12} />
        {showHashtagLib ? 'Ocultar biblioteca' : 'Ver biblioteca de hashtags'}
      </button>
      {showHashtagLib && (
        <div style={{ marginTop: 10, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
          {/* Sector tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB' }}>
            {HASHTAG_SECTORS.map((s) => (
              <button key={s.id} onClick={() => setHashtagSector(s.id)}
                style={{ padding: '8px 12px', border: 'none', background: 'none', fontSize: 12, whiteSpace: 'nowrap', cursor: 'pointer', color: hashtagSector === s.id ? '#1A56DB' : '#6B7280', fontWeight: hashtagSector === s.id ? 600 : 400, borderBottom: hashtagSector === s.id ? '2px solid #1A56DB' : '2px solid transparent' }}>
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['high', 'medium', 'specific'] as const).map((group) => {
              const labels = { high: 'Alta popularidad', medium: 'Media popularidad', specific: 'Especificos del sector' }
              const tags = HASHTAG_LIBRARY[hashtagSector]?.[group] ?? []
              return (
                <div key={group}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{labels[group]}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {tags.map((tag) => {
                      const sel = selectedLibHashtags.has(tag)
                      return (
                        <button key={tag} onClick={() => {
                          const totalInText = (text.match(/#\S+/g) ?? []).length
                          if (!sel && totalInText >= 30) { setToast({ message: 'Maximo 30 hashtags en Instagram.', type: 'error' }); return }
                          if (!sel) { addHashtag(tag); setSelectedLibHashtags((prev) => new Set([...prev, tag])) }
                          else {
                            setText((t) => t.replace(new RegExp(`\\s?${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?`, 'g'), ' ').trim())
                            setSelectedLibHashtags((prev) => { const s = new Set(prev); s.delete(tag); return s })
                          }
                        }}
                          style={{ border: `1px solid ${sel ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: sel ? '#1A56DB' : '#6B7280', background: sel ? '#EEF3FE' : '#FFFFFF', cursor: 'pointer' }}>
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
              {(text.match(/#\S+/g) ?? []).length}/30 hashtags
            </p>
          </div>
        </div>
      )}
    </div>
  )

  const renderScheduleOptions = () => (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
        <Toggle value={scheduleEnabled} onChange={setScheduleEnabled} />
        Programar publicacion
      </label>
      {scheduleEnabled && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {QUICK_SLOTS.map((slot) => {
              const isSelected = scheduledAt && (() => {
                const d = new Date(); applyQuickSchedule(slot.id)
                return false
              })()
              return (
                <button key={slot.id} onClick={() => applyQuickSchedule(slot.id)}
                  style={{ padding: '8px 12px', border: `1px solid ${scheduledAt ? '#E5E7EB' : '#E5E7EB'}`, borderRadius: 8, background: '#FFFFFF', color: '#374151', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#1A56DB'; e.currentTarget.style.background = '#EEF3FE'; e.currentTarget.style.color = '#1A56DB' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#374151' }}>
                  {slot.label}
                </button>
              )
            })}
          </div>
          <button onClick={() => setShowExactDate((v) => !v)}
            style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#1A56DB', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {showExactDate ? 'Ocultar fecha exacta' : 'O elige fecha y hora exacta'}
          </button>
          {showExactDate && (
            <input type="datetime-local" min={minDateTime} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
              style={{ marginTop: 8, display: 'block', width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
          )}
          {scheduledAt && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#1A56DB', fontWeight: 500 }}>
              Se publicara el {formatScheduledDate(scheduledAt)}
            </p>
          )}
        </div>
      )}
    </div>
  )

  const renderDimModal = () => {
    if (!showDimModal) return null
    return (
      <div onClick={() => setShowDimModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 14, padding: '24px 28px', maxWidth: 500, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Dimensiones recomendadas</p>
            <button onClick={() => setShowDimModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}><X size={16} /></button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#F9FAFB' }}>
              {['Plataforma', 'Tipo', 'Resolucion', 'Ratio'].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#6B7280', borderBottom: '1px solid #E5E7EB' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {FORMAT_REF_ROWS.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '8px 10px', color: '#374151', fontWeight: 500 }}>{row.platform}</td>
                  <td style={{ padding: '8px 10px', color: '#6B7280' }}>{row.type}</td>
                  <td style={{ padding: '8px 10px', color: '#6B7280', fontFamily: 'monospace' }}>{row.resolution}</td>
                  <td style={{ padding: '8px 10px', color: '#6B7280' }}>{row.ratio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderExportModal = () => {
    if (!showExportModal) return null
    const byPlatform: Record<string, ExportFormat[]> = {}
    EXPORT_FORMATS.forEach((f) => { if (!byPlatform[f.platform]) byPlatform[f.platform] = []; byPlatform[f.platform].push(f) })
    return (
      <div onClick={() => setShowExportModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 16, padding: '24px 24px', maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Exportar para todas las plataformas</p>
            <button onClick={() => setShowExportModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
          </div>
          {Object.entries(byPlatform).map(([plat, fmts]) => (
            <div key={plat} style={{ marginBottom: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{plat}</p>
              {fmts.map((f) => (
                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid #F3F4F6' }}>
                  <input type="checkbox" checked={exportSelections.has(f.id)}
                    onChange={(e) => setExportSelections((prev) => { const s = new Set(prev); e.target.checked ? s.add(f.id) : s.delete(f.id); return s })}
                    style={{ accentColor: '#1A56DB', width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, color: '#374151' }}>{f.label}</span>
                </label>
              ))}
            </div>
          ))}
          {/* Custom size */}
          <button onClick={() => setShowCustomExport((v) => !v)}
            style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#1A56DB', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {showCustomExport ? 'Ocultar medidas personalizadas' : 'Medidas personalizadas'}
          </button>
          {showCustomExport && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="number" min={100} max={5000} value={customExportW} onChange={(e) => setCustomExportW(parseInt(e.target.value) || 1080)} placeholder="1080" style={{ width: 80, border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', fontSize: 12, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>x</span>
              <input type="number" min={100} max={5000} value={customExportH} onChange={(e) => setCustomExportH(parseInt(e.target.value) || 1080)} placeholder="1080" style={{ width: 80, border: '1px solid #E5E7EB', borderRadius: 6, padding: '6px 8px', fontSize: 12, textAlign: 'center' }} />
              <span style={{ fontSize: 12, color: '#6B7280' }}>px</span>
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <button onClick={handleExportZip} disabled={exportingZip || exportSelections.size === 0}
              style={{ width: '100%', padding: '11px 0', background: '#1A56DB', color: '#FFFFFF', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: exportingZip ? 'not-allowed' : 'pointer', opacity: exportingZip ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {exportingZip ? <><Spinner size={14} /> Exportando...</> : `Descargar seleccionados (${exportSelections.size + (showCustomExport ? 1 : 0)})`}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderMobilePreviewModal = () => {
    if (!showMobilePreview) return null
    const hour = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return (
      <div onClick={() => setShowMobilePreview(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          {/* Network toggle */}
          <div style={{ display: 'flex', gap: 0, background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: 3 }}>
            {(['instagram', 'facebook', 'tiktok'] as const).map((net) => (
              <button key={net} onClick={() => setMobileNet(net)}
                style={{ padding: '7px 16px', borderRadius: 999, border: 'none', background: mobileNet === net ? '#FFFFFF' : 'transparent', color: mobileNet === net ? '#111827' : '#FFFFFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
                {net.charAt(0).toUpperCase() + net.slice(1)}
              </button>
            ))}
          </div>
          {/* iPhone frame */}
          <div style={{ width: 320, height: 690, background: '#000', border: '8px solid #1F2937', borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            {/* Status bar */}
            <div style={{ background: '#000', padding: '8px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 600 }}>{hour}</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <svg width={14} height={10} viewBox="0 0 20 14" fill="white"><rect x="0" y="4" width="3" height="10" rx="1"/><rect x="5" y="2" width="3" height="12" rx="1"/><rect x="10" y="0" width="3" height="14" rx="1"/><rect x="15" y="3" width="3" height="11" rx="1"/></svg>
                <svg width={14} height={10} viewBox="0 0 24 12" fill="none" stroke="white" strokeWidth="2"><rect x="1" y="1" width="18" height="10" rx="2"/><path d="M23 4v4a2 2 0 000-4z"/><rect x="3" y="3" width="12" height="6" rx="1" fill="white"/></svg>
              </div>
            </div>
            {/* Feed content */}
            <div style={{ flex: 1, background: '#FAFAFA', overflowY: 'auto' }}>
              {/* Header bar */}
              <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E5E7EB', overflow: 'hidden', flexShrink: 0 }}>
                  {business.logo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={business.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', background: '#1A56DB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>{business.name[0]}</div>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#111827' }}>{business.name}</p>
                  {mobileNet === 'instagram' && <p style={{ margin: 0, fontSize: 10, color: '#9CA3AF' }}>Publicado ahora</p>}
                </div>
                <button style={{ border: `1px solid ${mobileNet === 'instagram' ? '#E5E7EB' : '#1A56DB'}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: mobileNet === 'instagram' ? '#111827' : '#1A56DB', background: '#FFFFFF', cursor: 'pointer' }}>Seguir</button>
              </div>
              {/* Post image */}
              {filePreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filePreviewUrl} alt="post" style={{ width: '100%', display: 'block', filter: cssFilter }} />
              )}
              {/* Actions */}
              {mobileNet !== 'tiktok' && (
                <div style={{ background: '#FFFFFF', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
                    {['heart', 'chat', 'share'].map((icon) => (
                      <svg key={icon} width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {icon === 'heart' && <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />}
                        {icon === 'chat' && <><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></>}
                        {icon === 'share' && <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>}
                      </svg>
                    ))}
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto' }}>
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#111827' }}>
                    <strong>{business.name}</strong>{' '}
                    {text.slice(0, 125)}{text.length > 125 ? '... ' : ''}
                    {text.length > 125 && <span style={{ color: '#9CA3AF' }}>mas</span>}
                  </p>
                  {text.match(/#\S+/g)?.slice(0, 5).map((t, i) => (
                    <span key={i} style={{ fontSize: 11, color: '#1A56DB', marginRight: 4 }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowMobilePreview(false)} style={{ color: '#FFFFFF', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
        </div>
      </div>
    )
  }

  const renderTemplateModal = () => {
    if (!showTemplateModal) return null
    return (
      <div onClick={() => setShowTemplateModal(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: 14, padding: '24px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Guardar como plantilla</p>
            <button onClick={() => setShowTemplateModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Nombre de la plantilla</label>
              <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ej: Oferta fin de semana" style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }} onFocus={(e) => { e.currentTarget.style.borderColor = '#1A56DB' }} onBlur={(e) => { e.currentTarget.style.borderColor = '#E5E7EB' }} />
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, marginBottom: 6 }}>Categoria</label>
              <select value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#111827', outline: 'none' }}>
                <option value="post">Post</option>
                <option value="story">Historia</option>
                <option value="flyer">Flyer</option>
                <option value="promo">Promocion</option>
                <option value="ad">Anuncio</option>
              </select>
            </div>
            <button onClick={handleSaveTemplate} disabled={savingTemplate}
              style={{ padding: '11px 0', background: '#1A56DB', color: '#FFFFFF', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: savingTemplate ? 'not-allowed' : 'pointer', opacity: savingTemplate ? 0.8 : 1 }}>
              {savingTemplate ? 'Guardando...' : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderFileZone = () => {
    if (file) {
      return (
        <div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'flex-start', gap: 12, background: '#FAFAFA' }}>
            {isVideo ? (
              <div style={{ width: 64, height: 64, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              </div>
            ) : (
              filePreviewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={filePreviewUrl} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0, filter: cssFilter }} />
              )
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9CA3AF' }}>
                {formatFileSize(file.size)}{videoDuration !== null && ` · ${formatDuration(videoDuration)}`}
              </p>
              {uploadProgress !== null && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 2, background: '#1A56DB', width: `${uploadProgress}%`, transition: 'width 0.18s ease' }} />
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6B7280' }}>{uploadProgress < 100 ? `Subiendo... ${uploadProgress}%` : 'Subido'}</p>
                </div>
              )}
            </div>
            <button onClick={handleRemoveFile} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, color: '#9CA3AF', flexShrink: 0 }} aria-label="Eliminar archivo"><X size={16} /></button>
          </div>
          {renderImageWorkspace()}
          {isVideo && file && (
            <VideoEditor file={file} onExport={handleVideoExport} />
          )}
          {isVideo && videoEdited && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 500 }}>Video editado</span>
            </div>
          )}
        </div>
      )
    }
    return (
      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
        style={{ border: `2px dashed ${dragOver ? '#1A56DB' : '#E5E7EB'}`, borderRadius: 12, padding: 32, textAlign: 'center', cursor: 'pointer', background: dragOver ? '#EFF6FF' : '#FAFAFA', transition: 'border-color 0.15s, background 0.15s' }}
        onMouseEnter={(e) => { if (!dragOver) { e.currentTarget.style.borderColor = '#1A56DB'; e.currentTarget.style.background = '#EFF6FF' } }}
        onMouseLeave={(e) => { if (!dragOver) { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#FAFAFA' } }}>
        <Upload size={28} color="#9CA3AF" style={{ margin: '0 auto' }} />
        <p style={{ margin: '10px 0 4px', fontSize: 14, fontWeight: 500, color: '#374151' }}>Arrastra tu imagen o video aqui</p>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9CA3AF' }}>JPG, PNG, MP4, MOV · Max 50MB</p>
        <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
          style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#FFFFFF', cursor: 'pointer' }}>
          Seleccionar archivo
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="upload-tab-outer" style={{ height: '100%', overflowY: 'auto', background: '#F0EDE8', padding: '16px 20px 24px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ minHeight: '100%' }} className="upload-tab-grid">
        {/* Left column */}
        <div className="upload-tab-card" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', padding: '24px 20px', display: 'flex', flexDirection: 'column' }}>
          {/* Platform */}
          <div style={SECTION_STYLE}>
            <span style={LABEL_STYLE}>Publicar en</span>
            {renderPlatformSelector()}
            {fieldErrors.platform && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626' }}>{fieldErrors.platform}</p>}
            {igNotProfessional && (
              <div style={{
                marginTop: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                fontSize: 13,
                color: '#991B1B',
                lineHeight: 1.6,
              }}>
                Tu cuenta de Instagram no permite publicacion automatica. Convierte tu cuenta a Profesional para continuar.
              </div>
            )}
            {renderPostTypeSelector()}
          </div>

          {/* File */}
          <div style={SECTION_STYLE}>
            <span style={LABEL_STYLE}>Archivo</span>
            {renderFileZone()}
            {fieldErrors.file && (
              <p style={{ margin: '6px 0 0', fontSize: 12, color: '#DC2626' }}>{fieldErrors.file}</p>
            )}
            {fileErrors.map((err, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 8,
                background: '#FEF2F2', border: '1px solid #FCA5A5',
                fontSize: 13, color: '#991B1B', marginTop: 8,
              }}>
                {err}
              </div>
            ))}
            {fileWarnings.map((warn, i) => (
              <div key={i} style={{
                padding: '10px 14px', borderRadius: 8,
                background: '#FFFBEB', border: '1px solid #FCD34D',
                fontSize: 13, color: '#92400E', marginTop: 8,
              }}>
                {warn}
              </div>
            ))}
          </div>

          {/* Text */}
          <div style={SECTION_STYLE}>
            <span style={LABEL_STYLE}>Texto del post</span>
            <div style={{ position: 'relative' }}>
              <textarea value={text} onChange={(e) => { setText(e.target.value); setFieldErrors((err) => ({ ...err, text: undefined })) }}
                placeholder={primaryPlatform ? PLACEHOLDERS[primaryPlatform] : 'Selecciona una plataforma primero'}
                rows={5}
                style={{ width: '100%', minHeight: 120, border: `1px solid ${fieldErrors.text ? '#DC2626' : '#E5E7EB'}`, borderRadius: 10, padding: '12px 12px 28px', fontSize: 14, lineHeight: 1.6, color: '#111827', resize: 'vertical', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#1A56DB' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.text ? '#DC2626' : '#E5E7EB' }} />
              <span style={{ position: 'absolute', right: 10, bottom: 8, fontSize: 11, color: counterColor, pointerEvents: 'none' }}>{text.length}/{charLimit}</span>
            </div>
            {fieldErrors.text && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#DC2626' }}>{fieldErrors.text}</p>}

            <button onClick={suggestHashtags} disabled={loadingSuggestions}
              style={{ marginTop: 8, border: '1px solid #E5E7EB', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#FFFFFF', cursor: loadingSuggestions ? 'not-allowed' : 'pointer', opacity: loadingSuggestions ? 0.7 : 1 }}>
              {loadingSuggestions ? 'Generando hashtags...' : 'Sugerir hashtags'}
            </button>

            {/* Feature 10: hashtag library */}
            {renderHashtagLibrary()}

            {suggestedHashtags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {suggestedHashtags.map((tag) => (
                  <button key={tag} onClick={() => addHashtag(tag)}
                    style={{ border: '1px solid #DBEAFE', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 500, color: '#1D4ED8', background: '#EFF6FF', cursor: 'pointer' }}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div style={{ marginBottom: 24 }}>
            <button onClick={() => setShowOptions((o) => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #E5E7EB', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#374151', background: '#FAFAFA', cursor: 'pointer', textAlign: 'left' }}>
              <span>Opciones</span>
              {showOptions ? <ChevronUp size={16} color="#9CA3AF" /> : <ChevronDown size={16} color="#9CA3AF" />}
            </button>
            {showOptions && (
              <div style={{ border: '1px solid #E5E7EB', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Location */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                    <Toggle value={includeLocation} onChange={setIncludeLocation} />
                    Incluir ubicacion
                  </label>
                  {includeLocation && (
                    <input type="text" placeholder="Nombre del lugar (ej: Sevilla, Espana)" value={locationName} onChange={(e) => setLocationName(e.target.value)}
                      style={{ marginTop: 8, width: '100%', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#111827', outline: 'none', boxSizing: 'border-box' }} />
                  )}
                </div>
                {/* Feature 8: quick schedule */}
                {renderScheduleOptions()}
              </div>
            )}
          </div>

          {/* Publish progress (Feature 7) */}
          {publishing && Object.keys(publishProgress).length > 0 && (
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10 }}>
              {Object.entries(publishProgress).map(([p, status]) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, color: '#374151' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: status === 'loading' ? '#F59E0B' : status === 'done' ? '#059669' : status === 'error' ? '#DC2626' : '#E5E7EB' }} />
                  {PLATFORM_META[p as SocialPlatform]?.label ?? p}
                  <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>
                    {status === 'loading' ? 'publicando...' : status === 'done' ? 'publicado' : status === 'error' ? 'error' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            <button onClick={handlePublish}
              disabled={publishing || savingDraft || fileErrors.length > 0 || igNotProfessional}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#1A56DB', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: (publishing || savingDraft || fileErrors.length > 0 || igNotProfessional) ? 'not-allowed' : 'pointer', opacity: (publishing || savingDraft || fileErrors.length > 0 || igNotProfessional) ? 0.5 : 1 }}>
              {publishing
                ? 'Publicando...'
                : scheduleEnabled
                ? 'Programar publicacion'
                : selectedPlatforms.length > 1
                ? `Publicar en ${selectedPlatforms.length} redes`
                : 'Publicar ahora'}
            </button>
            {scheduleEnabled && scheduledAt && (
              <p style={{ margin: '-4px 0 0', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>
                Se publicara el {formatScheduledDate(scheduledAt)}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSaveDraft} disabled={publishing || savingDraft}
                style={{ flex: 1, background: 'none', border: 'none', padding: '8px 0', fontSize: 13, fontWeight: 500, color: savingDraft ? '#9CA3AF' : '#6B7280', cursor: publishing || savingDraft ? 'not-allowed' : 'pointer', textAlign: 'center' }}>
                {savingDraft ? 'Guardando...' : 'Guardar borrador'}
              </button>
              {/* Feature 9: save as template */}
              <button onClick={() => { setTemplateName(text.trim().slice(0, 50) || ''); setShowTemplateModal(true) }}
                style={{ background: 'none', border: 'none', padding: '8px 0', fontSize: 13, fontWeight: 500, color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                <BookmarkPlus size={13} />
                Guardar plantilla
              </button>
            </div>
          </div>
        </div>

        {/* Right column: visual editor */}
        <div style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #E5E7EB', overflow: 'hidden', minHeight: 540, display: 'flex', flexDirection: 'column' }}>
          <PostEditor
            platform={primaryPlatform}
            postType={postType}
            format={currentFormat}
            businessName={business.name}
            businessLogoUrl={business.logo_url}
            initialImageUrl={filePreviewUrl}
            isAdmin={isAdmin}
            templateToLoad={activeTemplate}
            onClearTemplate={() => {
              setActiveTemplate(null)
              const url = new URL(window.location.href)
              url.searchParams.delete('template_id')
              window.history.replaceState({}, '', url.toString())
            }}
            onExport={handleEditorExport}
          />
        </div>
      </div>

      {renderDimModal()}
      {renderExportModal()}
      {renderMobilePreviewModal()}
      {renderTemplateModal()}

      {toast && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 80, borderRadius: 10, padding: '10px 14px', color: '#FFFFFF', background: toast.type === 'success' ? '#059669' : '#DC2626', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', fontSize: 12, fontWeight: 600 }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
