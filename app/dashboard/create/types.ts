import type { SocialPlatform, PromotionType } from '@/types'

export interface DraftInitData {
  id: string
  content: string
  platform: SocialPlatform
  hashtags: string[]
  cta: string
  imageUrl: string | null
  imagePrompt: string
  visualStyle: string
  promotionType: PromotionType | null
  extraContext: string
}
