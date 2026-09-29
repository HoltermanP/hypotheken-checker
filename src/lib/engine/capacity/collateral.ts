import { floorEuro } from "../math"
import { NORM_KEYS, type NormValues } from "../norms"
import type { Tracer } from "../trace"

/**
 * Maximale hypotheek op basis van onderpand (Trhk art. 5; NHG V&N C.6.1).
 *
 *   max = marktwaarde (na verbouwing) × maxLTV (100%)
 *         + extra voor energiebesparende voorzieningen, tot maxLTV energie (106%) van de marktwaarde
 *
 * NHG: mogelijk als de lening ≤ kostengrens (met energiebesparende voorzieningen: de hogere grens).
 * Bij een bank kan de maximale LTV lager liggen (bankprofiel).
 */

export interface CollateralParams {
  norms: NormValues
  marketValue: number
  energySavingAmount: number
  /** Maximale LTV van de geldverstrekker (%), standaard de wettelijke 100%. */
  lenderMaxLtvPct?: number
  tracer?: Tracer
}

export interface CollateralResult {
  marketValue: number
  maxLtvPct: number
  baseMax: number
  energyExtra: number
  maxLoan: number
}

export function collateralCapacity(p: CollateralParams): CollateralResult {
  const maxLtvPct = Math.min(p.norms.trhk.maxLtvPct, p.lenderMaxLtvPct ?? p.norms.trhk.maxLtvPct)
  const baseMax = (p.marketValue * maxLtvPct) / 100
  const energyRoom = (p.marketValue * (p.norms.trhk.maxLtvEnergyPct - p.norms.trhk.maxLtvPct)) / 100
  const energyExtra = Math.max(0, Math.min(p.energySavingAmount, energyRoom))
  const maxLoan = floorEuro(baseMax + energyExtra)
  p.tracer?.add({
    id: "maxHypotheekOnderpand",
    label: "Maximale hypotheek op basis van onderpand",
    value: maxLoan,
    unit: "EUR",
    formula: `marktwaarde × ${maxLtvPct}% + energiebesparend (tot ${p.norms.trhk.maxLtvEnergyPct}%)`,
    inputs: { marktwaarde: p.marketValue, energiebesparend: p.energySavingAmount },
    normKeys: [NORM_KEYS.maxLtv, NORM_KEYS.maxLtvEnergy],
  })
  return { marketValue: p.marketValue, maxLtvPct, baseMax: floorEuro(baseMax), energyExtra, maxLoan }
}

export interface NhgResult {
  eligible: boolean
  limit: number
  reason: string
  provisie: number
}

/** NHG-toets: lening binnen de kostengrens, eigen bewoning en annuïtair/lineair. */
export function nhgCheck(
  norms: NormValues,
  loanAmount: number,
  opts: { energySaving: boolean; ownOccupation: boolean; interestOnlyNew: number }
): NhgResult {
  const limit = opts.energySaving ? norms.nhg.kostengrensEnergie : norms.nhg.kostengrens
  const provisie = (loanAmount * norms.nhg.provisiePct) / 100
  if (!opts.ownOccupation) {
    return { eligible: false, limit, reason: "NHG vereist dat je de woning zelf bewoont.", provisie }
  }
  if (loanAmount > limit) {
    return {
      eligible: false,
      limit,
      reason: `De lening is hoger dan de NHG-kostengrens.`,
      provisie,
    }
  }
  if (opts.interestOnlyNew > 0) {
    return {
      eligible: false,
      limit,
      reason: "Met NHG mag een nieuw leningdeel niet aflossingsvrij zijn (alleen bestaand overgangsrecht).",
      provisie,
    }
  }
  return { eligible: true, limit, reason: "De lening valt binnen de NHG-kostengrens.", provisie }
}
