/**
 * BSN-bescherming. Een BSN wordt nooit opgeslagen: we instrueren het model het niet over te nemen
 * en verwijderen daarna elk getal van 9 cijfers (ook met punten/spaties) dat de elfproef doorstaat.
 */

export function isValidBsn(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false
  if (/^0+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * (9 - i)
  sum -= Number(digits[8])
  return sum % 11 === 0
}

const CANDIDATE = /\b\d{4}[.\s-]?\d{2}[.\s-]?\d{3}\b|\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}\b|\b\d{9}\b/g

export function redactBsn(text: string): string {
  return text.replace(CANDIDATE, (m) => (isValidBsn(m.replace(/\D/g, "")) ? "[BSN verwijderd]" : m))
}

/** Verwijder BSN's recursief uit alle strings in een object. */
export function redactDeep<T>(value: T): T {
  if (typeof value === "string") return redactBsn(value) as T
  if (Array.isArray(value)) return value.map(redactDeep) as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (/bsn|burgerservicenummer|sofi/i.test(k)) continue
      out[k] = redactDeep(v)
    }
    return out as T
  }
  return value
}
