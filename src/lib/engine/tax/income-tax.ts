import { bracketTax, marginalRate } from "../math"
import type { Bracket, NormValues } from "../norms"

/**
 * Box 1 inkomstenbelasting en heffingskortingen (vereenvoudigd, per persoon).
 *
 * Aannames (zie docs/ENGINE.md):
 * - Tarieven incl. premies volksverzekeringen volgens box1.schijven (of box1.schijven_aow).
 * - Algemene heffingskorting en arbeidskorting volgens de actuele parameters; overige kortingen
 *   (IACK, ouderenkorting) worden niet meegenomen, wat de netto-uitkomst licht conservatief maakt.
 */

export function box1Brackets(norms: NormValues, aow: boolean): Bracket[] {
  return aow ? norms.tax.box1Aow : norms.tax.box1
}

export function box1Tax(norms: NormValues, taxableIncome: number, aow = false): number {
  return bracketTax(taxableIncome, box1Brackets(norms, aow))
}

export function box1MarginalRate(norms: NormValues, taxableIncome: number, aow = false): number {
  return marginalRate(taxableIncome, box1Brackets(norms, aow))
}

export function algemeneHeffingskorting(norms: NormValues, income: number, aow = false): number {
  const p = norms.tax.heffingskortingen.ahk
  const max = aow ? p.aowMax : p.max
  const pct = aow ? p.aowAfbouwPct : p.afbouwPct
  const reduction = Math.max(0, income - p.afbouwVanaf) * (pct / 100)
  return Math.max(0, max - reduction)
}

export function arbeidskorting(norms: NormValues, labourIncome: number, aow = false): number {
  if (labourIncome <= 0) return 0
  const brackets = aow ? norms.tax.heffingskortingen.akAow : norms.tax.heffingskortingen.ak
  for (const [from, to, base, pct] of brackets) {
    if (labourIncome >= from && (to === null || labourIncome < to)) {
      return Math.max(0, base + ((labourIncome - from) * pct) / 100)
    }
  }
  return 0
}

export interface NetIncome {
  gross: number
  tax: number
  credits: number
  net: number
  marginalPct: number
}

/** Netto jaarinkomen bij een bruto belastbaar inkomen (waarvan `labour` arbeidsinkomen). */
export function netIncome(
  norms: NormValues,
  taxable: number,
  labour: number,
  aow = false
): NetIncome {
  const tax = box1Tax(norms, taxable, aow)
  const credits = Math.min(
    tax,
    algemeneHeffingskorting(norms, taxable, aow) + arbeidskorting(norms, labour, aow)
  )
  return {
    gross: taxable,
    tax,
    credits,
    net: taxable - tax + credits,
    marginalPct: box1MarginalRate(norms, taxable, aow),
  }
}

/** Tarief waartegen hypotheekrente aftrekbaar is: marginaal tarief, gemaximeerd op het aftrektarief. */
export function deductionRate(norms: NormValues, taxableIncome: number, aow = false): number {
  return Math.min(box1MarginalRate(norms, taxableIncome, aow), norms.tax.maxAftrekPct)
}
