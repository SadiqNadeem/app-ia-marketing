export interface PostFormat {
  label: string
  realWidth: number
  realHeight: number
  displayWidth: number
  displayHeight: number
  ratio: string
  icon: string
}

// Includes platforms beyond SocialPlatform for future use (linkedin, youtube)
export const POST_FORMATS: Record<string, Record<string, PostFormat>> = {
  instagram: {
    post: {
      label: 'Post cuadrado',
      realWidth: 1080,
      realHeight: 1080,
      displayWidth: 480,
      displayHeight: 480,
      ratio: '1:1',
      icon: 'Square',
    },
    historia: {
      label: 'Historia / Reel',
      realWidth: 1080,
      realHeight: 1920,
      displayWidth: 270,
      displayHeight: 480,
      ratio: '9:16',
      icon: 'Smartphone',
    },
    carrusel: {
      label: 'Carrusel',
      realWidth: 1080,
      realHeight: 1080,
      displayWidth: 480,
      displayHeight: 480,
      ratio: '1:1',
      icon: 'LayoutGrid',
    },
    horizontal: {
      label: 'Horizontal',
      realWidth: 1080,
      realHeight: 566,
      displayWidth: 480,
      displayHeight: 252,
      ratio: '1.91:1',
      icon: 'RectangleHorizontal',
    },
  },
  facebook: {
    post: {
      label: 'Post',
      realWidth: 1200,
      realHeight: 630,
      displayWidth: 480,
      displayHeight: 252,
      ratio: '1.91:1',
      icon: 'RectangleHorizontal',
    },
    historia: {
      label: 'Historia',
      realWidth: 1080,
      realHeight: 1920,
      displayWidth: 270,
      displayHeight: 480,
      ratio: '9:16',
      icon: 'Smartphone',
    },
    portada: {
      label: 'Portada',
      realWidth: 1640,
      realHeight: 624,
      displayWidth: 480,
      displayHeight: 183,
      ratio: '2.63:1',
      icon: 'PanelTop',
    },
    evento: {
      label: 'Evento',
      realWidth: 1920,
      realHeight: 1080,
      displayWidth: 480,
      displayHeight: 270,
      ratio: '16:9',
      icon: 'Calendar',
    },
  },
  tiktok: {
    video: {
      label: 'Video vertical',
      realWidth: 1080,
      realHeight: 1920,
      displayWidth: 270,
      displayHeight: 480,
      ratio: '9:16',
      icon: 'Smartphone',
    },
    miniatura: {
      label: 'Miniatura',
      realWidth: 1080,
      realHeight: 1920,
      displayWidth: 270,
      displayHeight: 480,
      ratio: '9:16',
      icon: 'Smartphone',
    },
  },
  whatsapp: {
    imagen: {
      label: 'Imagen',
      realWidth: 1080,
      realHeight: 1080,
      displayWidth: 480,
      displayHeight: 480,
      ratio: '1:1',
      icon: 'Square',
    },
    estado: {
      label: 'Estado',
      realWidth: 1080,
      realHeight: 1920,
      displayWidth: 270,
      displayHeight: 480,
      ratio: '9:16',
      icon: 'Smartphone',
    },
  },
  linkedin: {
    post: {
      label: 'Post',
      realWidth: 1200,
      realHeight: 627,
      displayWidth: 480,
      displayHeight: 251,
      ratio: '1.91:1',
      icon: 'RectangleHorizontal',
    },
    articulo: {
      label: 'Articulo',
      realWidth: 1200,
      realHeight: 627,
      displayWidth: 480,
      displayHeight: 251,
      ratio: '1.91:1',
      icon: 'FileText',
    },
  },
  youtube: {
    miniatura: {
      label: 'Miniatura',
      realWidth: 1280,
      realHeight: 720,
      displayWidth: 480,
      displayHeight: 270,
      ratio: '16:9',
      icon: 'Play',
    },
    portada: {
      label: 'Portada del canal',
      realWidth: 2560,
      realHeight: 1440,
      displayWidth: 480,
      displayHeight: 270,
      ratio: '16:9',
      icon: 'PanelTop',
    },
  },
}

export function getFirstFormat(platform: string): { typeKey: string; format: PostFormat } | null {
  const types = POST_FORMATS[platform]
  if (!types) return null
  const firstKey = Object.keys(types)[0]
  return { typeKey: firstKey, format: types[firstKey] }
}

export function getThumbSize(format: PostFormat): { w: number; h: number } {
  const { ratio } = format
  if (ratio === '9:16') return { w: 67, h: 120 }
  if (ratio === '1:1') return { w: 90, h: 90 }
  return { w: 120, h: 63 }
}
