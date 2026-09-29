import { bracketTax, marginalRate } from "../math"
import type { NormValues } from "../norms"

/**
 * Box 3 (forfaitair rendement), box 2 (aanmerkelijk belang) en vennootschapsbelasting.
 */

export interface Box3Input {
  bankBalances: number
  otherAssets: number
  debts: number
  /** Aantal fiscale partners (heffingvrij vermogen per persoon). */
  persons: number
}

export interface Box3Result {
  forfaitairRendement: number
  grondslag: number
  tax: number
  effectiveRatePct: number
}

export function box3Tax(norms: NormValues, input: Box3Input): Box3Result {
  const b = norms.box3
  const debtsAboveThreshold = Math.max(0, input.debts - b.drempelSchulden * input.persons)
  const rendement =
    (input.bankBalances * b.forfaitBankPct) / 100 +
    (input.otherAssets * b.forfaitOverigPct) / 100 -
    (debtsAboveThreshold * b.forfaitSchuldenPct) / 100
  const totalCapital = input.bankBalances + input.otherAssets - debtsAboveThreshold
  const grondslag = Math.max(0, totalCapital - b.heffingvrijVermogen * input.persons)
  const rendementsPct = totalCapital > 0 ? rendement / totalCapital : 0
  const tax = Math.max(0, grondslag * rendementsPct * (b.tariefPct / 100))
  return {
    forfaitairRendement: rendement,
    grondslag,
    tax,
    effectiveRatePct: totalCapital > 0 ? (tax / totalCapital) * 100 : 0,
  }
}

/** Marginale box 3-heffing (in %) over een extra euro spaargeld of belegging. */
export function box3MarginalPct(norms: NormValues, input: Box3Input, kind: "bank" | "other"): number {
  const base = box3Tax(norms, input).tax
  const extra = 1000
  const next = box3Tax(norms, {
    ...input,
    bankBalances: input.bankBalances + (kind === "bank" ? extra : 0),
    otherAssets: input.otherAssets + (kind === "other" ? extra : 0),
  }).tax
  return ((next - base) / extra) * 100
}

export function box2Tax(norms: NormValues, income: number): number {
  return bracketTax(income, norms.ondernemer.box2)
}

export function box2MarginalPct(norms: NormValues, income: number): number {
  return marginalRate(income, norms.ondernemer.box2)
}

export function vpbTax(norms: NormValues, profit: number): number {
  return bracketTax(profit, norms.ondernemer.vpb)
}

export function vpbMarginalPct(norms: NormValues, profit: number): number {
  return marginalRate(profit, norms.ondernemer.vpb)
}
