export type BusinessCategory =
  | 'restaurante'
  | 'peluqueria'
  | 'tienda'
  | 'gimnasio'
  | 'bar'
  | 'otro'

export type SocialPlatform =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'google'
  | 'whatsapp'

export type PostStatus = 'draft' | 'publishing' | 'scheduled' | 'published' | 'failed'

export type PlanType = 'basic' | 'pro' | 'business' | 'agency'

export type PromotionType =
  | 'oferta_2x1'
  | 'menu_dia'
  | 'happy_hour'
  | 'sorteo'
  | 'evento'
  | 'nuevo_producto'
  | 'black_friday'
  | 'navidad'
  | 'san_valentin'
  | 'halloween'
  | 'apertura'
  | 'aniversario'

export type ContentItemType = 'flyer' | 'post' | 'story' | 'video'

export interface ContentLibraryItem {
  id: string
  business_id: string
  file_url: string
  thumbnail_url: string | null
  type: ContentItemType
  promotion_type: PromotionType | null
  tags: string[]
  created_at: string
}

export type VoiceStatus = 'none' | 'processing' | 'ready' | 'failed'

export interface Business {
  id: string
  owner_id: string
  name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  category: BusinessCategory
  phone: string | null
  address: string | null
  plan: PlanType
  stripe_customer_id: string | null
  created_at: string
  // Voice cloning (ElevenLabs)
  elevenlabs_voice_id: string | null
  voice_name: string | null
  voice_sample_url: string | null
  voice_status: VoiceStatus
}

export type KnowledgeType = 'text' | 'pdf' | 'audio' | 'interview' | 'image' | 'video'

export type AiExampleType = 'post' | 'flyer' | 'campana'

export interface AiKnowledge {
  id: string
  type: AiExampleType
  content: string
  created_at: string
}

export interface BusinessKnowledge {
  id: string
  business_id: string
  type: KnowledgeType
  title: string
  original_file_url: string | null
  extracted_text: string
  file_size_kb: number | null
  created_at: string
}

export interface SocialConnection {
  id: string
  business_id: string
  platform: SocialPlatform
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  platform_user_id: string | null
  platform_username: string | null
  account_type: string | null
  is_professional: boolean | null
  is_active: boolean
  created_at: string
}

export interface Post {
  id: string
  business_id: string
  user_id?: string | null
  content?: string | null
  media_url?: string | null
  content_text: string
  image_url: string | null
  video_url: string | null
  platforms: SocialPlatform[]
  platform?: SocialPlatform | null
  status: PostStatus
  external_post_id?: string | null
  scheduled_at: string | null
  published_at: string | null
  promotion_type: PromotionType | null
  is_suggestion: boolean
  suggestion_date: string | null
  title?: string | null
  hashtags?: string[] | null
  error_message?: string | null
  created_at: string
  updated_at?: string | null
  cta?: string | null
  image_prompt?: string | null
  visual_style?: string | null
  extra_context?: string | null
}

export type DiscountType = 'percentage' | 'fixed'

export interface Coupon {
  id: string
  business_id: string
  title: string
  description: string | null
  discount_type: DiscountType
  discount_value: number
  code: string
  max_uses: number | null
  used_count: number
  expires_at: string | null
  is_active: boolean
  created_at: string
}

export interface CouponRedemption {
  id: string
  coupon_id: string
  business_id: string
  customer_id: string | null
  redeemed_at: string
  notes: string | null
  coupons?: { title: string; code: string; discount_type: DiscountType; discount_value: number }
}
