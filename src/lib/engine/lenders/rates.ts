import type { EnergyLabel } from "../norms"
import type { LenderProfile, LtvClass, RateRow, RepaymentKind } from "./types"

/**
 * Rente opzoeken in de rentetabel van een geldverstrekker.
 *
 * - LTV-klasse: NHG als de lening NHG heeft; anders de klasse waar de LTV binnen valt. Heeft de
 *   bank die klasse niet, dan de eerstvolgende hogere klasse (conservatief).
 * - Rentevaste periode: exact; anders de dichtstbijzijnde gepubliceerde periode (met melding).
 * - Aflossingsvorm: aflossingsvrij gebruikt de aflossingsvrije tabel als die er is; lineair gebruikt
 *   de annuïteitentabel (banken hanteren doorgaans dezelfde rente).
 * - Energielabelkorting van de bank wordt van de rente afgetrokken.
 */

const LTV_ORDER: LtvClass[] = ["ltv60", "ltv70", "ltv80", "ltv90", "ltv100"]

export function ltvClassFor(ltvPct: number, nhg: boolean): LtvClass {
  if (nhg) return "nhg"
  if (ltvPct <= 60) return "ltv60"
  if (ltvPct <= 70) return "ltv70"
  if (ltvPct <= 80) return "ltv80"
  if (ltvPct <= 90) return "ltv90"
  return "ltv100"
}

export interface RateLookup {
  ratePct: number
  baseRatePct: number
  energyDiscountPct: number
  row: RateRow
  notes: string[]
}

export function lookupRate(
  rows: RateRow[],
  lender: Pick<LenderProfile, "slug" | "energyLabelDiscounts" | "energyLabelDiscountsAbove10y">,
  q: { fixedYears: number; ltvPct: number; nhg: boolean; repayment: RepaymentKind; energyLabel: EnergyLabel }
): RateLookup | null {
  const own = rows.filter((r) => r.lenderSlug === lender.slug)
  if (own.length === 0) return null
  const notes: string[] = []
  const repayment: RepaymentKind = q.repayment === "linear" ? "annuity" : q.repayment
  let pool = own.filter((r) => r.repaymentType === repayment)
  if (pool.length === 0) {
    pool = own.filter((r) => r.repaymentType === "annuity")
    if (repayment === "interest_only") notes.push("Geen aparte aflossingsvrije rente gepubliceerd; annuïteitenrente gebruikt.")
  }
  if (pool.length === 0) return null

  // Rentevaste periode
  const periods = [...new Set(pool.map((r) => r.fixedYears))]
  let period = q.fixedYears
  if (!periods.includes(period)) {
    period = periods.reduce((best, p) =>
      Math.abs(p - q.fixedYears) < Math.abs(best - q.fixedYears) ||
      (Math.abs(p - q.fixedYears) === Math.abs(best - q.fixedYears) && p > best)
        ? p
        : best
    )
    notes.push(`Rentevaste periode van ${q.fixedYears} jaar niet gepubliceerd; ${period} jaar gebruikt.`)
  }
  const byPeriod = pool.filter((r) => r.fixedYears === period)

  // LTV-klasse
  const wanted = ltvClassFor(q.ltvPct, q.nhg)
  let row = byPeriod.find((r) => r.ltvClass === wanted)
  if (!row && wanted === "nhg") {
    const fallback = ltvClassFor(q.ltvPct, false)
    row = byPeriod.find((r) => r.ltvClass === fallback)
    if (row) notes.push("Geen aparte NHG-rente gepubliceerd; rente van de LTV-klasse gebruikt.")
  }
  if (!row && wanted !== "nhg") {
    const idx = LTV_ORDER.indexOf(wanted)
    for (const cls of [...LTV_ORDER.slice(idx + 1), ...LTV_ORDER.slice(0, idx).reverse()]) {
      row = byPeriod.find((r) => r.ltvClass === cls)
      if (row) {
        notes.push(`Geen rente voor LTV-klasse ${wanted}; klasse ${cls} gebruikt.`)
        break
      }
    }
  }
  if (!row) return null
  const table = period > 10 && lender.energyLabelDiscountsAbove10y ? lender.energyLabelDiscountsAbove10y : lender.energyLabelDiscounts
  const discount = table[q.energyLabel] ?? 0
  return {
    ratePct: Math.round((row.ratePct - discount) * 1000) / 1000,
    baseRatePct: row.ratePct,
    energyDiscountPct: discount,
    row,
    notes,
  }
}

/** Mediaan van beschikbare rentes (als referentierente zonder bankkeuze). */
export function medianRate(
  rows: RateRow[],
  lenders: LenderProfile[],
  q: { fixedYears: number; ltvPct: number; nhg: boolean; energyLabel: EnergyLabel }
): number | null {
  const rates = lenders
    .filter((l) => l.active)
    .map((l) => lookupRate(rows, l, { ...q, repayment: "annuity" })?.ratePct)
    .filter((r): r is number => typeof r === "number")
    .sort((a, b) => a - b)
  if (rates.length === 0) return null
  const mid = Math.floor(rates.length / 2)
  return rates.length % 2 ? rates[mid]! : (rates[mid - 1]! + rates[mid]!) / 2
}
