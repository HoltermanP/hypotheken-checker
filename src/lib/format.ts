/**
 * Nederlandse notatie (nl-NL): € 1.234,56. Isomorf (client + server).
 */

const eur0 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const eur2 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Intl gebruikt een vaste spatie; we normaliseren naar "€ 1.234" (gewone spatie). */
function normalize(s: string) {
  return s.replace(/ /g, " ").replace(/ /g, " ")
}

export function formatEuro(value: number, decimals: 0 | 2 = 0): string {
  if (!Number.isFinite(value)) return "–"
  return normalize((decimals === 2 ? eur2 : eur0).format(value))
}

export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "–"
  return normalize(
    new Intl.NumberFormat("nl-NL", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value)
  )
}

/** Percentage in procentpunten (5 → "5,00%"). */
export function formatPct(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "–"
  return `${formatNumber(value, decimals)}%`
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "–"
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric" }).format(d)
}

export function formatMonths(months: number): string {
  const y = Math.floor(months / 12)
  const m = Math.round(months % 12)
  if (y === 0) return `${m} ${m === 1 ? "maand" : "maanden"}`
  if (m === 0) return `${y} jaar`
  return `${y} jaar en ${m} ${m === 1 ? "maand" : "maanden"}`
}

/** Parse een door de gebruiker ingevoerd bedrag ("1.234,56", "€ 1234", "1234.5"). */
export function parseEuroInput(input: string): number | null {
  const cleaned = input.replace(/[€\s]/g, "")
  if (!cleaned) return null
  let normalized: string
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "")
  } else {
    normalized = cleaned
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}
