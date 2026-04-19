import type { SocialPlatform } from '@/types'
import type { ContentType } from './ContentControls'

export type PreviewPlatform = SocialPlatform | 'flyer'

export interface PreviewData {
  text: string
  hashtags: string[]
  imageUrl?: string | null
}

export interface PlatformPreviewProps {
  data: PreviewData
  contentType: ContentType
  businessName: string
  logoUrl: string | null
  primaryColor: string
}
