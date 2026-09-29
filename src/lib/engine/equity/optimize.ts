import { NORM_KEYS, type NormValues } from "../norms"
import { box3Tax } from "../tax/wealth-tax"
import type { Projection } from "../loan/schedule"

/**
 * Eigen geld inbrengen, deels inbrengen of aanhouden.
 *
 * Per variant (0%, 50%, 100% van het vrij beschikbare spaargeld boven de buffer):
 *   hypotheek   = benodigde hypotheek − inbreng (begrensd op de maximale hypotheek)
 *   rente       = rente bij de nieuwe LTV-klasse (lagere LTV → lagere rente)
 *   netto rente = Σ bruto rente − belastingeffect eigen woning over de horizon
 *   spaargeld   = rendement op het resterende spaargeld (spaarrente) − box 3-heffing
 *   saldo       = netto rente − netto spaarrendement (lager is beter)
 * Daarnaast controleren we of de buffer na inbreng voldoende is (Nibud-buffer).
 */

export interface EquityVariant {
  key: "none" | "half" | "all"
  label: string
  contribution: number
  loan: number
  ltvPct: number
  ratePct: number
  netMonthlyYear1: number
  netInterest10: number
  netInterest30: number
  savingsReturn10: number
  savingsReturn30: number
  box3Year1: number
  netCost10: number
  netCost30: number
  liquidAfter: number
  bufferOk: boolean
}

export interface EquityOptimization {
  freeSavings: number
  bufferNeeded: number
  variants: EquityVariant[]
  recommended: EquityVariant["key"]
  explanation: string
  normKeys: string[]
}

function savingsReturn(norms: NormValues, capital: number, years: number, persons: number, otherAssets: number) {
  let balance = capital
  let total = 0
  for (let y = 0; y < years; y++) {
    const interest = (balance * norms.market.spaarrentePct) / 100
    const taxWith = box3Tax(norms, { bankBalances: balance, otherAssets, debts: 0, persons }).tax
    const taxWithout = box3Tax(norms, { bankBalances: 0, otherAssets, debts: 0, persons }).tax
    const net = interest - (taxWith - taxWithout)
    total += net
    balance += net
  }
  return total
}

export function optimizeEquity(params: {
  norms: NormValues
  savings: number
  investments: number
  desiredBuffer: number
  requiredMortgage: number
  maxMortgage: number
  marketValue: number
  persons: number
  /** Rente bij een gegeven LTV (via de rentetabellen). */
  rateFor: (ltvPct: number) => number
  /** Projectie voor een hypotheekbedrag en rente. */
  project: (loan: number, ratePct: number) => Projection
}): EquityOptimization {
  const { norms } = params
  const bufferNeeded = Math.max(params.desiredBuffer, params.persons >= 2 ? norms.budget.bufferCouple : norms.budget.bufferSingle)
  const freeSavings = Math.max(0, params.savings - bufferNeeded)
  const minContribution = Math.max(0, params.requiredMortgage - params.maxMortgage)
  const variants: EquityVariant[] = (
    [
      ["none", "Niets extra inbrengen", 0],
      ["half", "Helft inbrengen", 0.5],
      ["all", "Alles boven de buffer inbrengen", 1],
    ] as const
  ).map(([key, label, share]) => {
    const contribution = Math.max(minContribution, freeSavings * share)
    const loan = Math.max(0, Math.min(params.maxMortgage, params.requiredMortgage - contribution))
    const ltvPct = params.marketValue > 0 ? (loan / params.marketValue) * 100 : 0
    const ratePct = params.rateFor(ltvPct)
    const proj = params.project(loan, ratePct)
    const netInterest = (years: number) =>
      proj.years.slice(0, years).reduce((a, r) => a + r.interest - r.taxBenefit, 0)
    const remainingSavings = Math.max(0, params.savings - contribution)
    const r10 = savingsReturn(norms, remainingSavings, 10, params.persons, params.investments)
    const r30 = savingsReturn(norms, remainingSavings, 30, params.persons, params.investments)
    const box3Year1 = box3Tax(norms, {
      bankBalances: remainingSavings,
      otherAssets: params.investments,
      debts: 0,
      persons: params.persons,
    }).tax
    return {
      key,
      label,
      contribution,
      loan,
      ltvPct,
      ratePct,
      netMonthlyYear1: proj.years[0]?.netMonthly ?? 0,
      netInterest10: netInterest(10),
      netInterest30: netInterest(30),
      savingsReturn10: r10,
      savingsReturn30: r30,
      box3Year1,
      netCost10: netInterest(10) - r10,
      netCost30: netInterest(30) - r30,
      liquidAfter: remainingSavings,
      bufferOk: remainingSavings >= bufferNeeded,
    }
  })
  const candidates = variants.filter((v) => v.bufferOk)
  const best = (candidates.length > 0 ? candidates : variants).reduce((a, b) => (b.netCost10 < a.netCost10 ? b : a))
  return {
    freeSavings,
    bufferNeeded,
    variants,
    recommended: best.key,
    explanation:
      best.key === "none"
        ? "Spaargeld aanhouden is hier voordeliger of nodig voor je buffer."
        : "Eigen geld inbrengen verlaagt je hypotheek en vaak je rente (lagere LTV-klasse). Je houdt je buffer aan.",
    normKeys: [NORM_KEYS.spaarrente, NORM_KEYS.box3Bank, NORM_KEYS.box3Tarief, NORM_KEYS.box3Vrij, NORM_KEYS.budgetBuffer],
  }
}
