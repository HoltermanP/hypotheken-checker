import type { NormValues } from "../norms"
import { box1MarginalRate, deductionRate } from "./income-tax"

/**
 * Fiscale behandeling van de eigen woning (box 1).
 *
 *   eigenwoningforfait (EWF) = WOZ × percentage (schijf); boven de villataksgrens:
 *                              vast bedrag + villataks% × (WOZ − grens)
 *   saldo                     = EWF − aftrekbare rente
 *   saldo < 0 (aftrek)        → belastingvoordeel = −saldo × aftrektarief (max. aftrektarief)
 *   saldo > 0 (bijtelling)    → Wet Hillen: aftrek van saldo × hillen% → te betalen belasting
 *                              = saldo × (1 − hillen%) × marginaal tarief
 */

export function eigenwoningforfait(norms: NormValues, woz: number): number {
  if (woz <= 0) return 0
  const brackets = norms.tax.ewf
  if (woz > norms.tax.villataksGrens) {
    // Forfait tot de grens + villataks over het meerdere.
    const below = eigenwoningforfait(norms, norms.tax.villataksGrens)
    return below + ((woz - norms.tax.villataksGrens) * norms.tax.villataksPct) / 100
  }
  for (const [from, to, pct] of brackets) {
    if (woz > from && (to === null || woz <= to)) return (woz * pct) / 100
  }
  return 0
}

export interface OwnHomeTaxEffect {
  ewf: number
  deductibleInterest: number
  /** Positief = belastingvoordeel (teruggaaf), negatief = extra belasting. */
  benefit: number
  hillenApplied: boolean
  ratePct: number
}

/**
 * Belastingeffect van de eigen woning in één jaar.
 * @param hillenPct Percentage van het positieve saldo dat nog aftrekbaar is (Wet Hillen) in dat jaar.
 */
export function ownHomeTaxEffect(
  norms: NormValues,
  woz: number,
  deductibleInterest: number,
  taxableIncome: number,
  opts: { aow?: boolean; hillenPct?: number } = {}
): OwnHomeTaxEffect {
  const ewf = eigenwoningforfait(norms, woz)
  const saldo = ewf - deductibleInterest
  if (saldo < 0) {
    const rate = deductionRate(norms, taxableIncome, opts.aow)
    return { ewf, deductibleInterest, benefit: (-saldo * rate) / 100, hillenApplied: false, ratePct: rate }
  }
  const rate = box1MarginalRate(norms, taxableIncome, opts.aow)
  const hillen = opts.hillenPct ?? norms.tax.hillenAftrekPct
  const taxable = saldo * (1 - hillen / 100)
  return { ewf, deductibleInterest, benefit: -(taxable * rate) / 100, hillenApplied: true, ratePct: rate }
}

/**
 * Hillen-percentage in een toekomstig jaar: jaarlijks dezelfde afbouwstap als tussen de twee
 * meest recente jaren, tot 0%. `step` is de jaarlijkse afbouw in procentpunt.
 */
export function hillenPctForYear(basePct: number, yearsAhead: number, step: number): number {
  return Math.max(0, basePct - step * yearsAhead)
}
