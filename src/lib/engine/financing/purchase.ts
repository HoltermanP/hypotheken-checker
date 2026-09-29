import { floorEuro } from "../math"
import { NORM_KEYS, type NormValues } from "../norms"
import { nhgCheck, type NhgResult } from "../capacity/collateral"
import { estimateConstructionInterest, purchaseCosts, type PurchaseCostsResult } from "../costs/purchase-costs"
import type { Applicant, Assets, TargetProperty } from "../types"
import type { Tracer } from "../trace"

/**
 * Financieringsopzet bij aankoop.
 *
 *   benodigd  = koopsom + meerwerk + bouwrente + verbouwing + energiebesparend + kosten koper
 *   bronnen   = eigen geld + schenking + familiebank + overwaarde (netto verkoopopbrengst)
 *   hypotheek = min(benodigd − bronnen, maximale hypotheek)
 *   tekort    = (benodigd − bronnen) − hypotheek   (extra eigen geld nodig)
 *
 * Kosten koper kunnen niet uit de hypotheek worden betaald zolang de marktwaarde gelijk is aan de
 * koopsom: de hypotheek is begrensd op 100% van de marktwaarde (+ energiebesparend tot 106%).
 *
 * Bijleenregeling: maximale eigenwoningschuld = verwervingskosten (koopsom + niet-aftrekbare kosten
 * koper + meerwerk + verbouwing + energiebesparend) − eigenwoningreserve. Het meerdere valt in box 3.
 */

export interface FinancingPlan {
  costs: PurchaseCostsResult
  uses: { key: string; label: string; amount: number }[]
  totalUses: number
  sources: { key: string; label: string; amount: number }[]
  ownFundsAvailable: number
  requiredMortgage: number
  maxMortgage: number
  mortgage: number
  shortfall: number
  ownFundsLeft: number
  marketValue: number
  ltvPct: number
  maxOwnHomeDebt: number
  box3Part: number
  nhg: NhgResult
  costsFromOwnFunds: { ok: boolean; message: string }
}

export function propertyMarketValue(p: TargetProperty): number {
  if (p.marketValueAfterRenovation) return p.marketValueAfterRenovation
  const base = p.marketValue ?? p.purchasePrice
  return base + p.renovationAmount + (p.kind === "new_build" ? p.extraWork : 0)
}

export function ownFundsAvailable(assets: Assets): number {
  const free = Math.max(0, assets.savings + assets.investments - assets.desiredBuffer)
  if (assets.ownFundsToContribute === null || assets.ownFundsToContribute === undefined) return free
  return Math.max(0, Math.min(assets.ownFundsToContribute, assets.savings + assets.investments))
}

export function financingPlan(params: {
  norms: NormValues
  property: TargetProperty
  applicants: Applicant[]
  assets: Assets
  maxMortgageIncome: number
  maxMortgageCollateral: number
  ratePct: number
  nhgWanted: boolean
  netSaleProceeds: number
  /** Restschuld van de vorige woning die wordt meegefinancierd. */
  restschuld?: number
  eigenwoningreserve: number
  transferDate: string
  interestOnlyAmount: number
  tracer?: Tracer
}): FinancingPlan {
  const { norms, property } = params
  const marketValue = propertyMarketValue(property)
  const ownFunds = ownFundsAvailable(params.assets)
  const maxMortgage = Math.min(params.maxMortgageIncome, params.maxMortgageCollateral)
  const constructionInterest =
    property.kind === "new_build"
      ? (property.constructionInterest ??
        estimateConstructionInterest(
          property.purchasePrice + property.extraWork,
          params.ratePct,
          property.constructionMonths ?? 12
        ))
      : 0

  let loan = maxMortgage
  let costs = purchaseCosts(norms, property, params.applicants, loan, {
    nhg: params.nhgWanted,
    transferDate: params.transferDate,
    constructionInterest,
  })
  let nhg: NhgResult = nhgCheck(norms, loan, {
    energySaving: property.energySavingAmount > 0,
    ownOccupation: property.ownOccupation,
    interestOnlyNew: params.interestOnlyAmount,
  })
  let uses: FinancingPlan["uses"] = []
  let totalUses = 0
  let sources: FinancingPlan["sources"] = []
  let requiredMortgage = 0
  // Iteratie: NHG-provisie hangt af van het leenbedrag en omgekeerd.
  for (let i = 0; i < 4; i++) {
    const nhgApplies = params.nhgWanted && nhg.eligible
    costs = purchaseCosts(norms, property, params.applicants, loan, {
      nhg: nhgApplies,
      transferDate: params.transferDate,
      constructionInterest,
    })
    uses = [
      { key: "koopsom", label: property.kind === "new_build" ? "Koopsom (v.o.n.)" : "Koopsom", amount: property.purchasePrice },
      ...(property.extraWork > 0 ? [{ key: "meerwerk", label: "Meerwerk", amount: property.extraWork }] : []),
      ...(property.renovationAmount > 0 ? [{ key: "verbouwing", label: "Verbouwing", amount: property.renovationAmount }] : []),
      ...(property.energySavingAmount > 0
        ? [{ key: "energie", label: "Energiebesparende voorzieningen", amount: property.energySavingAmount }]
        : []),
      { key: "kosten_koper", label: "Kosten koper", amount: costs.total },
      ...((params.restschuld ?? 0) > 0
        ? [{ key: "restschuld", label: "Restschuld vorige woning", amount: params.restschuld ?? 0 }]
        : []),
    ]
    totalUses = uses.reduce((a, u) => a + u.amount, 0)
    sources = [
      { key: "eigen_geld", label: "Eigen geld", amount: ownFunds },
      ...(params.netSaleProceeds > 0 ? [{ key: "overwaarde", label: "Overwaarde huidige woning", amount: params.netSaleProceeds }] : []),
      ...(params.assets.giftAmount > 0 ? [{ key: "schenking", label: "Schenking", amount: params.assets.giftAmount }] : []),
      ...(params.assets.familyLoanAmount > 0
        ? [{ key: "familiebank", label: "Lening familie (familiebank)", amount: params.assets.familyLoanAmount }]
        : []),
    ]
    const other = sources.reduce((a, s) => a + s.amount, 0)
    // Benodigd bedrag afgerond naar boven op hele euro's (de hypotheek zelf wordt naar beneden afgerond).
    requiredMortgage = Math.max(0, Math.ceil(totalUses - other - 1e-9))
    const next = Math.min(requiredMortgage, floorEuro(maxMortgage))
    nhg = nhgCheck(norms, next, {
      energySaving: property.energySavingAmount > 0,
      ownOccupation: property.ownOccupation,
      interestOnlyNew: params.interestOnlyAmount,
    })
    if (Math.abs(next - loan) < 1) {
      loan = next
      break
    }
    loan = next
  }
  const mortgage = floorEuro(loan)
  const shortfall = Math.max(0, requiredMortgage - mortgage)
  const otherSources = sources.reduce((a, s) => a + s.amount, 0)
  const ownFundsLeft = Math.max(0, otherSources + mortgage - totalUses)
  sources.push({ key: "hypotheek", label: "Hypotheek", amount: mortgage })

  const nonDeductibleCosts = costs.lines.filter((l) => !l.deductible).reduce((a, l) => a + l.amount, 0)
  const acquisition =
    property.purchasePrice + property.extraWork + property.renovationAmount + property.energySavingAmount + nonDeductibleCosts
  const maxOwnHomeDebt = Math.max(0, acquisition - params.eigenwoningreserve)
  const box3Part = Math.max(0, mortgage - maxOwnHomeDebt)
  const costsOk = mortgage <= marketValue + property.energySavingAmount + 1
  const plan: FinancingPlan = {
    costs,
    uses,
    totalUses,
    sources,
    ownFundsAvailable: ownFunds,
    requiredMortgage,
    maxMortgage,
    mortgage,
    shortfall,
    ownFundsLeft,
    marketValue,
    ltvPct: marketValue > 0 ? (mortgage / marketValue) * 100 : 0,
    maxOwnHomeDebt,
    box3Part,
    nhg,
    costsFromOwnFunds: {
      ok: costsOk,
      message: costsOk
        ? "De kosten koper worden uit eigen middelen betaald; de hypotheek blijft binnen de marktwaarde."
        : "De hypotheek is hoger dan de marktwaarde: kosten koper kunnen niet worden meegefinancierd.",
    },
  }
  const t = params.tracer
  if (t) {
    t.add({ id: "kostenKoper", label: "Kosten koper", value: costs.total, unit: "EUR", formula: "som van overdrachtsbelasting, notaris, kadaster, taxatie, advies, NHG, bankgarantie e.a.", normKeys: [NORM_KEYS.ovbEigen, NORM_KEYS.kkNotarisLevering, NORM_KEYS.kkAdvies] })
    t.add({ id: "overdrachtsbelasting", label: "Overdrachtsbelasting", value: costs.transferTax.amount, unit: "EUR", formula: "koopsom × tarief × (1 − vrijgesteld aandeel starters)", normKeys: [NORM_KEYS.ovbEigen, NORM_KEYS.ovbStartersGrens, NORM_KEYS.ovbStartersLeeftijd] })
    t.add({ id: "totaalBenodigd", label: "Totaal benodigd", value: totalUses, unit: "EUR", formula: "koopsom + meerwerk + verbouwing + energiebesparend + kosten koper" })
    t.add({ id: "eigenGeld", label: "Eigen geld ingebracht", value: ownFunds, unit: "EUR", formula: "spaargeld + beleggingen − gewenste buffer (of opgegeven inbreng)" })
    t.add({ id: "benodigdeHypotheek", label: "Benodigde hypotheek", value: requiredMortgage, unit: "EUR", formula: "totaal benodigd − eigen middelen − overwaarde − schenking − familiebank" })
    t.add({ id: "hypotheek", label: "Hypotheekbedrag", value: mortgage, unit: "EUR", formula: "min(benodigde hypotheek, maximale hypotheek)" })
    t.add({ id: "tekort", label: "Tekort (extra eigen geld nodig)", value: shortfall, unit: "EUR", formula: "benodigde hypotheek − hypotheekbedrag" })
    t.add({ id: "maxEigenwoningschuld", label: "Maximale eigenwoningschuld (bijleenregeling)", value: maxOwnHomeDebt, unit: "EUR", formula: "verwervingskosten − eigenwoningreserve", normKeys: [NORM_KEYS.bijleenregeling, NORM_KEYS.eigenwoningreserve] })
    t.add({ id: "ltv", label: "Loan-to-value", value: plan.ltvPct, unit: "%", formula: "hypotheek / marktwaarde × 100", normKeys: [NORM_KEYS.maxLtv] })
  }
  return plan
}
