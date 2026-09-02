export function formatIQD(amount: number): string {
  const rounded = Math.round(amount)
  return new Intl.NumberFormat('en-US').format(rounded) + ' د.ع'
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

// Supabase's PostgREST embeds a to-one relation as either an object or a
// single-item array depending on how the FK is declared; this normalizes both.
export function extractName(relation: unknown): string | null {
  if (!relation) return null
  if (Array.isArray(relation)) {
    const first = relation[0] as { name?: string } | undefined
    return first?.name ?? null
  }
  return (relation as { name?: string }).name ?? null
}

export function generateInvoiceNumber(prefix: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${stamp}-${rand}`
}
