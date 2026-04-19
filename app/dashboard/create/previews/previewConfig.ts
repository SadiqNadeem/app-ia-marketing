import type { ContentType } from '../ContentControls'
import type { PreviewData, PreviewPlatform } from '../preview-types'

export const PLATFORM_LABELS: Record<PreviewPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  google: 'Google',
  flyer: 'Flyer',
}

export const contentByPlatform: Record<PreviewPlatform, string> = {
  instagram: '2x1 en kebabs este viernes',
  tiktok: 'POV: encuentras el mejor kebab',
  facebook: '2x1 en kebabs este viernes. Reserva por mensaje.',
  whatsapp: 'Promo flash: 2x1 en kebabs hoy. Responde "QUIERO".',
  google: '2x1 en kebabs este viernes. Haz tu reserva ahora.',
  flyer: '50% de descuento solo hoy',
}

const hashtagsByPlatform: Record<PreviewPlatform, string[]> = {
  instagram: ['#oferta', '#2x1', '#viernes', '#restaurante'],
  tiktok: ['#foodtok', '#kebab', '#promo', '#parati'],
  facebook: ['#restaurante', '#promocion', '#reserva', '#kebab'],
  whatsapp: ['#pedido', '#whatsapp', '#promo', '#delivery'],
  google: ['#restaurante', '#resena', '#reserva', '#comida'],
  flyer: ['#descuento', '#promo', '#solo_hoy', '#kebab'],
}

const defaultTextByType: Record<ContentType, string> = {
  post: 'Una visita que no olvidaras. Ven y descubre por que somos el lugar favorito del barrio.',
  story: 'Solo hoy. La experiencia que estas buscando.',
  promotion: '2x1 en todos los platos este viernes. No te lo pierdas, reserva ahora.',
  hashtags: 'Conjunto de hashtags optimizados para tu publicacion.',
}

function getPlatformText(contentType: ContentType, platform: PreviewPlatform): string {
  if (contentType === 'hashtags') {
    return hashtagsByPlatform[platform].join(' ')
  }

  if (contentType === 'promotion') {
    return contentByPlatform[platform]
  }

  if (contentType === 'story') {
    return `${contentByPlatform[platform]} Solo por tiempo limitado.`
  }

  if (contentType === 'post') {
    return `${contentByPlatform[platform]} Ven a probarlo hoy.`
  }

  return defaultTextByType[contentType]
}

export function resolvePreviewData(
  data: PreviewData | null,
  contentType: ContentType,
  platform: PreviewPlatform
): PreviewData {
  if (data) return data

  return {
    text: getPlatformText(contentType, platform),
    hashtags: hashtagsByPlatform[platform],
  }
}
