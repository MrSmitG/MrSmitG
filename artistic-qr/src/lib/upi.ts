/** Build and parse UPI payment deep links carried inside a VEIL image. */

export type UpiDetails = {
  payeeName: string
  vpa: string
  amount?: string
  note?: string
  currency?: string
}

/** Build a standard `upi://pay?...` deep link that any UPI app understands. */
export function buildUpiUri(d: UpiDetails): string {
  const params = new URLSearchParams()
  params.set('pa', d.vpa.trim())
  if (d.payeeName.trim()) params.set('pn', d.payeeName.trim())
  const amt = (d.amount ?? '').trim()
  if (amt) params.set('am', amt)
  params.set('cu', (d.currency ?? 'INR').trim() || 'INR')
  const note = (d.note ?? '').trim()
  if (note) params.set('tn', note)
  return `upi://pay?${params.toString()}`
}

const VPA_RE = /^[a-z0-9.\-_]{2,256}@[a-z][a-z0-9.\-_]{1,64}$/i

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa.trim())
}

/** Parse a `upi://pay?...` (or `upi:pay?...`) link, or null if it isn't one. */
export function parseUpiUri(text: string): UpiDetails | null {
  const trimmed = text.trim()
  if (!/^upi:\/*pay\?/i.test(trimmed)) return null

  const query = trimmed.slice(trimmed.indexOf('?') + 1)
  const params = new URLSearchParams(query)
  const vpa = params.get('pa') ?? ''
  if (!vpa) return null

  return {
    payeeName: params.get('pn') ?? '',
    vpa,
    amount: params.get('am') ?? undefined,
    note: params.get('tn') ?? undefined,
    currency: params.get('cu') ?? 'INR',
  }
}
