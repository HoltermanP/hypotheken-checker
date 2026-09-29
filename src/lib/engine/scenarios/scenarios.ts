import { runAdvice, type AdviceOutput, type EngineContext } from "../advice"
import { adjustBusinessForPayout } from "../entrepreneur/scenarios"
import { ownFundsAvailable, propertyMarketValue } from "../financing/purchase"
import { interestOverYears, projectLoan } from "../loan/schedule"
import { medianRate } from "../lenders/rates"
import type { EngineInput } from "../types"

/**
 * Scenariovergelijking (max. 4 naast elkaar): met/zonder NHG, 10/20 jaar rentevast, spaargeld
 * wel/niet inbrengen, eerst kopen/eerst verkopen, bank of eigen BV, salaris of dividend verhogen.
 * Elk scenario is de basisinvoer met overrides, doorgerekend met dezelfde engine.
 */

export interface ScenarioOverrides {
  nhg?: "yes" | "no"
  fixedRateYears?: number
  ownFunds?: "all" | "none" | number
  moveOrder?: "buy_first" | "sell_first"
  ownBv?: boolean
  salaryIncrease?: number
  purchasePrice?: number
  salePrice?: number
  ratePct?: number
  termMonths?: number
  repaymentType?: "annuity" | "linear" | "mixed"
}

export interface ScenarioDefinition {
  id: string
  name: string
  overrides: ScenarioOverrides
}

export interface ScenarioSummary {
  id: string
  name: string
  overrides: ScenarioOverrides
  maxMortgage: number
  loanAmount: number
  ratePct: number
  nhg: boolean
  grossMonthly: number
  netMonthly: number
  interest10: number
  netCost10: number
  shortfall: number
  ownFundsUsed: number
  redStress: number
  notes: string[]
}

/** Schat de referentierente (mediaan van de banken) voor de invoer: periode, LTV, NHG en label. */
export function estimateReferenceRate(input: EngineInput, ctx: EngineContext): number {
  const n = ctx.norms.values
  const target = input.targetProperty
  const current = input.currentProperty
  const value = target ? propertyMarketValue(target) : (current?.marketValue ?? null)
  let loan: number
  if (target) {
    const overwaarde = current ? Math.max(0, current.expectedSalePrice * 0.98 - current.loanParts.reduce((s, p) => s + p.balance, 0)) : 0
    loan = Math.max(0, target.purchasePrice * 1.04 + target.renovationAmount + target.energySavingAmount - ownFundsAvailable(input.assets) - overwaarde)
  } else if (current) {
    loan = current.loanParts.reduce((s, p) => s + p.balance, 0) + (input.equityRelease?.amount ?? 0)
  } else {
    loan = 0
  }
  const ltvPct = value && value > 0 ? Math.min(106, (loan / value) * 100) : 100
  const nhg = input.preferences.nhg !== "no" && loan > 0 && loan <= n.nhg.kostengrens
  const energyLabel = target?.energyLabel ?? current?.energyLabel ?? "geen"
  return (
    medianRate(ctx.rates, ctx.lenders, { fixedYears: input.preferences.fixedRateYears, ltvPct, nhg, energyLabel }) ??
    input.referenceRatePct
  )
}

export function applyOverrides(input: EngineInput, o: ScenarioOverrides, ctx: EngineContext): EngineInput {
  let next: EngineInput = structuredClone(input)
  if (o.nhg) next.preferences.nhg = o.nhg
  if (o.fixedRateYears) next.preferences.fixedRateYears = o.fixedRateYears
  if (o.termMonths) next.preferences.termMonths = o.termMonths
  if (o.repaymentType) next.preferences.repaymentType = o.repaymentType
  if (o.ownFunds !== undefined) {
    next.assets.ownFundsToContribute =
      o.ownFunds === "all"
        ? Math.max(0, next.assets.savings + next.assets.investments - next.assets.desiredBuffer)
        : o.ownFunds === "none"
          ? 0
          : o.ownFunds
  }
  if (o.moveOrder && next.move) next.move.order = o.moveOrder
  if (o.moveOrder && !next.move) {
    next.move = { order: o.moveOrder, bridgeMonths: 6, temporaryHousingMonthly: 0, temporaryHousingMonths: 0 }
  }
  if (o.purchasePrice && next.targetProperty) next.targetProperty.purchasePrice = o.purchasePrice
  if (o.salePrice && next.currentProperty) next.currentProperty.expectedSalePrice = o.salePrice
  if (o.salaryIncrease) {
    next = {
      ...next,
      applicants: next.applicants.map((a, i) =>
        i === 0
          ? { ...a, businesses: a.businesses.map((b) => (b.bv ? adjustBusinessForPayout(b, "salary", o.salaryIncrease!, ctx.norms.values) : b)) }
          : a
      ),
    }
  }
  next.referenceRatePct = o.ratePct ?? estimateReferenceRate(next, ctx)
  return next
}

export function summarize(def: ScenarioDefinition, out: AdviceOutput, ctx: EngineContext): ScenarioSummary {
  const notes: string[] = []
  let netMonthly = out.summary.netMonthly
  if (def.overrides.ownBv && out.entrepreneur) {
    const own = out.entrepreneur.businesses.find((b) => b.ownBvMortgage)?.ownBvMortgage
    if (own) {
      const repayment = (out.loan.years[0]?.repayment ?? 0) / 12
      netMonthly = own.ownBv.familyNetCostYear1 / 12 + repayment
      notes.push("Hypotheek bij de eigen BV: netto kosten voor privé en BV samen, inclusief latere box 2-heffing.")
    }
  }
  if (def.overrides.salaryIncrease) {
    const svd = out.entrepreneur?.businesses.find((b) => b.salaryVsDividend)?.salaryVsDividend
    if (svd) notes.push(`Netto kosten van het hogere salaris (per ${svd.delta} extra): zie ondernemershoofdstuk.`)
  }
  const proj = projectLoan({
    norms: ctx.norms.values,
    parts: out.loan.parts,
    startYear: Number(out.calculationDate.slice(0, 4)),
    propertyValue: out.loan.propertyValue,
    woz: out.loan.propertyValue,
    valueGrowthPct: 0,
    taxProfile: () => ({ taxableIncome: Math.max(...out.applicants.map((a) => a.taxable)), aow: false }),
    hillenStepPct: ctx.norms.values.tax.hillenStepPct,
    years: 10,
  })
  const ownFundsUsed = out.purchase
    ? Math.max(0, out.purchase.sources.find((s) => s.key === "eigen_geld")?.amount ?? 0) - out.purchase.ownFundsLeft
    : 0
  return {
    id: def.id,
    name: def.name,
    overrides: def.overrides,
    maxMortgage: out.summary.maxMortgage,
    loanAmount: out.loan.amount,
    ratePct: out.loan.ratePct,
    nhg: out.loan.nhgApplied,
    grossMonthly: out.summary.grossMonthly,
    netMonthly,
    interest10: interestOverYears(proj, 10),
    netCost10: proj.years.reduce((s, y) => s + y.interest - y.taxBenefit, 0),
    shortfall: out.summary.shortfall,
    ownFundsUsed: Math.max(0, ownFundsUsed),
    redStress: out.stress.filter((s) => s.light === "red").length,
    notes,
  }
}

export function runScenarios(input: EngineInput, defs: ScenarioDefinition[], ctx: EngineContext): ScenarioSummary[] {
  return defs.slice(0, 4).map((def) => summarize(def, runAdvice(applyOverrides(input, def.overrides, ctx), ctx), ctx))
}

/** Stel maximaal 4 zinvolle scenario's voor op basis van het profiel. */
export function suggestScenarios(input: EngineInput): ScenarioDefinition[] {
  const defs: ScenarioDefinition[] = [{ id: "basis", name: "Jouw voorkeur", overrides: {} }]
  const isDga = input.applicants.some((a) => a.businesses.some((b) => b.bv))
  if (input.goal === "doorstromer" && input.currentProperty) {
    const other = input.move?.order === "buy_first" ? "sell_first" : "buy_first"
    defs.push({ id: "volgorde", name: other === "buy_first" ? "Eerst kopen" : "Eerst verkopen", overrides: { moveOrder: other } })
  }
  if (isDga) {
    defs.push({ id: "salaris", name: "Salaris DGA + € 10.000", overrides: { salaryIncrease: 10000 } })
    defs.push({ id: "eigen_bv", name: "Hypotheek bij eigen BV", overrides: { ownBv: true } })
  }
  const fixed = input.preferences.fixedRateYears
  defs.push({ id: "rentevast", name: fixed >= 20 ? "10 jaar rentevast" : "20 jaar rentevast", overrides: { fixedRateYears: fixed >= 20 ? 10 : 20 } })
  if (input.targetProperty) {
    defs.push({ id: "nhg", name: input.preferences.nhg === "no" ? "Met NHG" : "Zonder NHG", overrides: { nhg: input.preferences.nhg === "no" ? "yes" : "no" } })
    if (input.assets.savings > input.assets.desiredBuffer) {
      defs.push({ id: "eigen_geld", name: "Al het spaargeld boven de buffer inbrengen", overrides: { ownFunds: "all" } })
    }
  }
  return defs.slice(0, 4)
}
