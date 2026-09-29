import type { NormValues } from "./norms"

/**
 * Datumhulpfuncties zonder tijdzones: we rekenen met {jaar, maand, dag}.
 */

export interface YMD {
  y: number
  m: number
  d: number
}

export function parseDate(iso: string): YMD {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) throw new Error(`Ongeldige datum: ${iso}`)
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

export function formatYMD({ y, m, d }: YMD): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

export function addMonths(date: YMD, months: number): YMD {
  const total = date.y * 12 + (date.m - 1) + months
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { y, m, d: Math.min(date.d, daysInMonth) }
}

/** Volledige maanden tussen twee datums (b − a), negatief als b vóór a ligt. */
export function monthsBetween(a: YMD, b: YMD): number {
  let months = (b.y - a.y) * 12 + (b.m - a.m)
  if (months > 0 && b.d < a.d) months -= 1
  if (months < 0 && b.d > a.d) months += 1
  return months
}

/** Leeftijd in hele jaren op een datum. */
export function ageInYears(dateOfBirth: string, on: string): number {
  return Math.floor(monthsBetween(parseDate(dateOfBirth), parseDate(on)) / 12)
}

/**
 * AOW-leeftijd in maanden voor iemand met deze geboortedatum. De AOW-leeftijd hangt af van het
 * kalenderjaar waarin die wordt bereikt (norm trhk.aow_leeftijd). Voor jaren na de laatst
 * vastgestelde waarde nemen we de laatst bekende AOW-leeftijd (conservatief: die stijgt alleen).
 */
export function aowAgeMonths(dateOfBirth: string, norms: NormValues): number {
  const dob = parseDate(dateOfBirth)
  const table = Object.entries(norms.trhk.aowAgeMonthsByYear)
    .map(([year, months]) => [Number(year), months] as const)
    .sort((a, b) => a[0] - b[0])
  if (table.length === 0) return 67 * 12
  for (const [year, months] of table) {
    if (addMonths(dob, months).y === year) return months
  }
  const first = table[0]!
  if (addMonths(dob, first[1]).y < first[0]) return first[1]
  return table[table.length - 1]![1]
}

export function aowDate(dateOfBirth: string, norms: NormValues): string {
  return formatYMD(addMonths(parseDate(dateOfBirth), aowAgeMonths(dateOfBirth, norms)))
}

/** Maanden vanaf `on` tot de AOW-datum (0 als de AOW-leeftijd al bereikt is). */
export function monthsUntilAow(dateOfBirth: string, on: string, norms: NormValues): number {
  return Math.max(0, monthsBetween(parseDate(on), parseDate(aowDate(dateOfBirth, norms))))
}

export function hasReachedAow(dateOfBirth: string, on: string, norms: NormValues): boolean {
  return monthsBetween(parseDate(on), parseDate(aowDate(dateOfBirth, norms))) <= 0
}
