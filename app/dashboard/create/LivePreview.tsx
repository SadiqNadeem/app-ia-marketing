'use client'

import type { ComponentType } from 'react'
import type { SocialPlatform } from '@/types'
import type { ContentType } from './ContentControls'
import type { PlatformPreviewProps, PreviewData, PreviewPlatform } from './preview-types'
import {
  FacebookPreview,
  FlyerPreview,
  InstagramPreview,
  TikTokPreview,
  WhatsAppPreview,
} from './previews'
import { PLATFORM_LABELS, resolvePreviewData } from './previews/previewConfig'

interface LivePreviewProps {
  data: PreviewData | null
  platform: SocialPlatform
  contentType: ContentType
  businessName: string
  logoUrl: string | null
  primaryColor: string
  isExample?: boolean
}

type PreviewRenderer = ComponentType<PlatformPreviewProps>

const previewComponents: Partial<Record<PreviewPlatform, PreviewRenderer>> = {
  instagram: InstagramPreview,
  tiktok: TikTokPreview,
  facebook: FacebookPreview,
  whatsapp: WhatsAppPreview,
  flyer: FlyerPreview,
}

export function LivePreview({
  data,
  platform,
  contentType,
  businessName,
  logoUrl,
  primaryColor,
  isExample,
}: LivePreviewProps) {
  const displayData = resolvePreviewData(data, contentType, platform)
  const PreviewComponent = previewComponents[platform] || InstagramPreview
  const previewWidthClass =
    platform === 'whatsapp'
      ? 'w-full max-w-[460px] lg:max-w-[540px]'
      : platform === 'tiktok'
        ? 'w-full max-w-[520px] lg:max-w-[620px]'
        : 'w-full max-w-[560px] lg:max-w-[760px]'

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        padding: '12px 8px 20px',
        gap: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: 920,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#9EA3AE',
          }}
        >
          Vista previa - {PLATFORM_LABELS[platform]}
        </span>
        {isExample && (
          <span
            style={{
              fontSize: 11,
              color: '#9EA3AE',
              padding: '2px 8px',
              borderRadius: 999,
              border: '1px solid #EAECF0',
            }}
          >
            Ejemplo
          </span>
        )}
      </div>

      <div
        className={[
          previewWidthClass,
          'bg-white rounded-2xl shadow-lg p-3 md:p-5 transition-transform duration-200 hover:scale-[1.01]',
        ].join(' ')}
      >
        <PreviewComponent
          data={displayData}
          contentType={contentType}
          businessName={businessName}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
        />
      </div>

      <p style={{ fontSize: 11, color: '#9EA3AE', textAlign: 'left' }}>
        Solo referencia visual - el resultado final depende de la plataforma
      </p>
    </div>
  )
}

export type { PreviewData } from './preview-types'
