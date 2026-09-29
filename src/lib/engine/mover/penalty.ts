import { monthsBetween, parseDate } from "../age"
import { annuityPayment, annuityPrincipal } from "../math"
import type { ExistingLoanPart } from "../types"

/**
 * Boeterente (vergoeding bij vervroegd aflossen) volgens de gangbare Wft-methode: de contante
 * waarde van het renteverschil over de resterende rentevaste periode, over het bedrag boven de
 * boetevrije ruimte. Bij verkoop van de woning (verhuizing) en overlijden is aflossen meestal
 * boetevrij.
 *
 *   boetevrij = oorspronkelijke hoofdsom × boetevrij% (per jaar, aangenomen nog niet gebruikt)
 *   verschil  = max(0, contractrente − actuele rente) / 12 × (restschuld − boetevrij)
 *   boete     = contante waarde van 'verschil' over de resterende rentevaste maanden tegen de actuele rente
 */

export interface PenaltyResult {
  partId: string
  remainingFixedMonths: number
  penaltyFree: number
  monthlyDifference: number
  penalty: number
  marketRatePct: number
}

export function penaltyForPart(part: ExistingLoanPart, on: string, marketRatePct?: number): PenaltyResult {
  const market = marketRatePct ?? part.currentMarketRatePct ?? part.ratePct
  const remainingFixedMonths = Math.max(0, monthsBetween(parseDate(on), parseDate(part.fixedRateEndDate)))
  const penaltyFree = Math.min(part.balance, ((part.originalPrincipal ?? part.balance) * (part.penaltyFreePct ?? 10)) / 100)
  const base = Math.max(0, part.balance - penaltyFree)
  const monthlyDifference = (Math.max(0, part.ratePct - market) / 100 / 12) * base
  const penalty = remainingFixedMonths > 0 ? annuityPrincipal(monthlyDifference, market, remainingFixedMonths) : 0
  return { partId: part.id, remainingFixedMonths, penaltyFree, monthlyDifference, penalty, marketRatePct: market }
}

export interface RefinanceResult {
  parts: (PenaltyResult & { currentMonthly: number; newMonthly: number })[]
  totalPenalty: number
  monthlySaving: number
  /** Terugverdientijd in maanden (null = geen besparing, dus nooit terugverdiend). */
  paybackMonths: number | null
  /** Rentemiddeling: nieuwe gemiddelde rente als de boete in de rente wordt verwerkt. */
  averagedRatePct: number | null
  netBenefitOverFixed: number
}

/**
 * Oversluiten naar een lagere rente: boeterente versus maandelijkse besparing.
 * @param newRatePct Rente van de nieuwe lening (nieuwe rentevaste periode).
 * @param newFixedYears Nieuwe rentevaste periode.
 */
export function refinanceAnalysis(
  parts: ExistingLoanPart[],
  on: string,
  newRatePct: number,
  newFixedYears: number
): RefinanceResult {
  const rows = parts.map((p) => {
    const pen = penaltyForPart(p, on, newRatePct)
    const remainingTerm = Math.max(1, monthsBetween(parseDate(on), parseDate(p.endDate)))
    const currentMonthly =
      p.type === "annuity" ? annuityPayment(p.balance, p.ratePct, remainingTerm) : (p.balance * p.ratePct) / 1200
    const newMonthly =
      p.type === "annuity" ? annuityPayment(p.balance, newRatePct, remainingTerm) : (p.balance * newRatePct) / 1200
    return { ...pen, currentMonthly, newMonthly }
  })
  const totalPenalty = rows.reduce((a, r) => a + r.penalty, 0)
  const monthlySaving = rows.reduce((a, r) => a + (r.currentMonthly - r.newMonthly), 0)
  const paybackMonths = monthlySaving > 0 ? Math.ceil(totalPenalty / monthlySaving) : null
  const horizon = newFixedYears * 12
  const netBenefitOverFixed = monthlySaving * horizon - totalPenalty
  // Rentemiddeling: de boete wordt verdisconteerd in een opslag over de nieuwe rentevaste periode.
  const balance = parts.reduce((a, p) => a + p.balance, 0)
  const averagedRatePct =
    balance > 0 && horizon > 0
      ? newRatePct + ((annuityPayment(totalPenalty, newRatePct, horizon) * 12) / balance) * 100
      : null
  return {
    parts: rows,
    totalPenalty,
    monthlySaving,
    paybackMonths,
    averagedRatePct,
    netBenefitOverFixed,
  }
}
