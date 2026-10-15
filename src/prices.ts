/** Converts both Brazilian currency and numeric Excel strings into a decimal amount. */
export function parseMoney(value: string): number {
  const cleaned = value.replace(/[^0-9,.-]/g, '').trim()
  if (!cleaned || !/[0-9]/.test(cleaned)) return 0
  const comma = cleaned.lastIndexOf(',')
  const point = cleaned.lastIndexOf('.')
  let normalized = cleaned

  if (comma >= 0 && point >= 0) {
    normalized = comma > point
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (comma >= 0) {
    normalized = cleaned.replace(',', '.')
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '')
  }

  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

export function formatImportedPrice(value: string): string {
  if (!value.trim()) return ''
  if (!/[0-9]/.test(value)) return value
  const amount = parseMoney(value)
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}
