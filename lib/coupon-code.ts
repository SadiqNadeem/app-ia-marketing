import { customAlphabet } from 'nanoid'

// Exclude O, I, 0, 1 to avoid visual confusion
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8)

export function generateCouponCode(): string {
  return nanoid()
}
