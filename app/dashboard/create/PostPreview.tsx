'use client'

import Image from 'next/image'
import type { SocialPlatform } from '@/types'
import type { GeneratedResult } from '@/components/TextGenerator'

interface PostPreviewProps {
  result: GeneratedResult | null
  platform: SocialPlatform
  businessName: string
  logoUrl: string | null
  primaryColor: string
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  google: 'Google',
}

// Instagram → square  |  others → 4:5 tall rectangle
function getAspectClass(platform: SocialPlatform): string {
  if (platform === 'instagram') return 'aspect-square'
  if (platform === 'tiktok') return 'aspect-[9/16]'
  return 'aspect-[4/3]'
}

export function PostPreview({
  result,
  platform,
  businessName,
  logoUrl,
  primaryColor,
}: PostPreviewProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-brand-text-primary">
          Vista previa — {PLATFORM_LABELS[platform]}
        </span>
        <span className="text-xs text-brand-text-secondary border border-brand-border rounded-full px-2 py-0.5">
          Solo referencia visual
        </span>
      </div>

      {/* Mock frame */}
      <div className="rounded-xl border border-brand-border bg-brand-surface shadow-sm overflow-hidden">
        {/* Post header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-brand-border">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 overflow-hidden"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={businessName}
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            ) : (
              businessName.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-brand-text-primary leading-tight">{businessName}</p>
            <p className="text-xs text-brand-text-secondary">Ahora</p>
          </div>
        </div>

        {/* Post image area */}
        <div
          className={[
            getAspectClass(platform),
            'w-full flex items-center justify-center',
          ].join(' ')}
          style={{ backgroundColor: primaryColor + '15' }}
        >
          {result ? (
            <div className="p-4 w-full h-full flex items-center justify-center">
              <p className="text-sm text-brand-text-primary whitespace-pre-wrap text-center leading-relaxed line-clamp-10">
                {result.text}
              </p>
            </div>
          ) : (
            <p className="text-sm text-brand-text-secondary px-4 text-center">
              El texto generado aparecer aqui
            </p>
          )}
        </div>

        {/* Post body */}
        {result && (
          <div className="px-3 py-2.5 flex flex-col gap-1.5">
            <p className="text-xs text-brand-text-primary leading-relaxed line-clamp-4">
              <span className="font-medium">{businessName} </span>
              {result.text}
            </p>
            {result.hashtags.length > 0 && (
              <p className="text-xs text-brand-text-secondary leading-relaxed">
                {result.hashtags.join(' ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!result && (
        <div className="rounded-xl border border-dashed border-brand-border bg-brand-bg flex flex-col items-center justify-center py-12 gap-2">
          <div className="w-10 h-10 rounded-full bg-brand-border flex items-center justify-center">
            <svg className="w-5 h-5 text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
          </div>
          <p className="text-sm text-brand-text-secondary">
            Genera contenido para ver la vista previa
          </p>
        </div>
      )}
    </div>
  )
}
