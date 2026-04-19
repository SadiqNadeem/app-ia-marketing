export function generateBusinessSlug(name: string, businessId: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40)

  const suffix = businessId.replace(/-/g, '').substring(0, 6)
  return `${base}-${suffix}`
}
