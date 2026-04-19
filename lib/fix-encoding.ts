export function fixEncoding(text: string): string {
  if (!text) return text

  try {
    return decodeURIComponent(escape(text))
  } catch {
    return text
  }
}

export function fixEncodingDeep<T>(value: T): T {
  if (typeof value === 'string') return fixEncoding(value) as T
  if (Array.isArray(value)) return value.map((item) => fixEncodingDeep(item)) as T
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      next[k] = fixEncodingDeep(v)
    }
    return next as T
  }
  return value
}
