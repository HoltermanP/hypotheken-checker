import { monthsBetween, parseDate } from "../age"
import { annuityPayment } from "../math"
import { NORM_KEYS, type NormValues } from "../norms"
import { saleCosts, type SaleCostsResult } from "../costs/purchase-costs"
import { deductionRate } from "../tax/income-tax"
import type { LoanPart } from "../loan/schedule"
import type { CurrentProperty, ExistingLoanPart, MoveOptions } from "../types"
import type { Tracer } from "../trace"

/**
 * Doorstromer: verkoop van de huidige woning en aankoop van een nieuwe.
 *
 *   overwaarde         = verkoopprijs − verkoopkosten − totale restschuld (+ opgebouwde waarde)
 *   eigenwoningreserve = max(0, verkoopprijs − verkoopkosten − eigenwoningschuld)   (vervalt na 3 jaar)
 *   overbrugging       = verwachte overwaarde (bij eerst kopen), rente × looptijd
 *   dubbele lasten     = maanden overlap × bruto maandlast oude woning (rente blijft max. 3 jaar aftrekbaar)
 *
 * Meeneemregeling: meegenomen leningdelen houden hun rente, resterende rentevaste periode en
 * fiscale status (inclusief overgangsrecht van vóór 2013).
 */

export interface MoverResult {
  salePrice: number
  saleCosts: SaleCostsResult
  totalDebt: number
  portedDebt: number
  repaidDebt: number
  netProceeds: number
  /** Contant vrijkomend bij verkoop (meegenomen delen worden niet afgelost). */
  cashFromSale: number
  restschuld: number
  eigenwoningschuld: number
  eigenwoningreserve: number
  portedParts: LoanPart[]
  bridge: { amount: number; ratePct: number; months: number; interest: number; netInterest: number } | null
  doubleCosts: { months: number; oldMonthlyGross: number; oldMonthlyNet: number; total: number } | null
  temporaryHousing: { months: number; monthly: number; total: number } | null
  notes: string[]
}

export function existingPartMonthly(p: ExistingLoanPart, on: string): number {
  const remaining = Math.max(1, monthsBetween(parseDate(on), parseDate(p.endDate)))
  if (p.type === "annuity") return annuityPayment(p.balance, p.ratePct, remaining)
  if (p.type === "linear") return p.balance / remaining + (p.balance * p.ratePct) / 1200
  return (p.balance * p.ratePct) / 1200
}

export function toLoanPart(p: ExistingLoanPart, on: string): LoanPart {
  const termMonths = Math.max(1, monthsBetween(parseDate(on), parseDate(p.endDate)))
  const fixedMonths = Math.max(0, monthsBetween(parseDate(on), parseDate(p.fixedRateEndDate)))
  const type = p.type === "savings" || p.type === "investment" ? "interest_only" : p.type
  return {
    id: `bestaand-${p.id}`,
    label: `Bestaand deel (${labelFor(p.type)})`,
    type,
    principal: p.balance,
    ratePct: p.ratePct,
    fixedYears: Math.max(0, Math.ceil(fixedMonths / 12)),
    termMonths,
    deductible: p.startedBefore2013 || p.type === "annuity" || p.type === "linear",
    startedBefore2013: p.startedBefore2013,
    ported: true,
    nhg: p.nhg,
  }
}

function labelFor(type: ExistingLoanPart["type"]): string {
  return {
    annuity: "annuïtair",
    linear: "lineair",
    interest_only: "aflossingsvrij",
    savings: "spaarhypotheek",
    investment: "beleggingshypotheek",
  }[type]
}

export function moverAnalysis(params: {
  norms: NormValues
  current: CurrentProperty
  calculationDate: string
  move: MoveOptions | null | undefined
  referenceRatePct: number
  taxableIncome: number
  tracer?: Tracer
}): MoverResult {
  const { norms, current } = params
  const notes: string[] = []
  const salePrice = current.expectedSalePrice
  const sc = saleCosts(norms, salePrice, { brokerFeePct: current.brokerFeePct })
  const totalDebt = current.loanParts.reduce((a, p) => a + p.balance, 0)
  const ported = current.loanParts.filter((p) => p.portOnMove)
  const portedDebt = ported.reduce((a, p) => a + p.balance, 0)
  const repaidDebt = totalDebt - portedDebt
  const accrued = current.loanParts.reduce((a, p) => a + (p.accruedValue ?? 0), 0)
  // Overwaarde (netto vermogen in de woning). Meegenomen delen blijven schuld op de nieuwe woning,
  // dus ook die worden afgetrokken; de nieuwe totale hypotheek = benodigd − eigen middelen − overwaarde.
  const netProceeds = salePrice - sc.total - totalDebt + accrued
  const cashFromSale = salePrice - sc.total - repaidDebt + accrued
  const restschuld = Math.max(0, -netProceeds)
  const eigenwoningschuld =
    current.eigenwoningschuld ??
    current.loanParts.filter((p) => p.startedBefore2013 || p.type === "annuity" || p.type === "linear").reduce((a, p) => a + p.balance, 0)
  const eigenwoningreserve = Math.max(0, salePrice - sc.total - eigenwoningschuld)
  if (restschuld > 0) {
    notes.push("Bij verkoop blijft een restschuld over. Die kun je aflossen uit spaargeld of (bij sommige banken) meefinancieren.")
  }
  if (ported.length > 0) {
    notes.push("Meegenomen leningdelen behouden hun rente, resterende rentevaste periode en fiscale status.")
  }

  let bridge: MoverResult["bridge"] = null
  let doubleCosts: MoverResult["doubleCosts"] = null
  let temporaryHousing: MoverResult["temporaryHousing"] = null
  const move = params.move
  if (move?.order === "buy_first") {
    const ratePct = move.bridgeRatePct ?? params.referenceRatePct
    const amount = Math.max(0, netProceeds)
    const interest = (amount * ratePct) / 100 * (move.bridgeMonths / 12)
    const rate = deductionRate(norms, params.taxableIncome)
    bridge = { amount, ratePct, months: move.bridgeMonths, interest, netInterest: interest * (1 - rate / 100) }
    const oldMonthlyGross = current.loanParts
      .filter((p) => !p.portOnMove)
      .reduce((a, p) => a + existingPartMonthly(p, params.calculationDate), 0)
    const oldInterest = current.loanParts.filter((p) => !p.portOnMove).reduce((a, p) => a + (p.balance * p.ratePct) / 1200, 0)
    const oldMonthlyNet = oldMonthlyGross - (oldInterest * rate) / 100
    doubleCosts = { months: move.bridgeMonths, oldMonthlyGross, oldMonthlyNet, total: oldMonthlyNet * move.bridgeMonths }
    notes.push("Bij eerst kopen blijft de rente van de oude woning maximaal 3 jaar aftrekbaar zolang die te koop staat.")
  } else if (move?.order === "sell_first" && move.temporaryHousingMonths > 0) {
    temporaryHousing = {
      months: move.temporaryHousingMonths,
      monthly: move.temporaryHousingMonthly,
      total: move.temporaryHousingMonths * move.temporaryHousingMonthly,
    }
  }

  const t = params.tracer
  if (t) {
    t.add({ id: "verkoopkosten", label: "Verkoopkosten", value: sc.total, unit: "EUR", formula: "courtage + royement + overige verkoopkosten", normKeys: [NORM_KEYS.vkCourtage, NORM_KEYS.vkRoyement, NORM_KEYS.vkOverig] })
    t.add({ id: "overwaarde", label: "Overwaarde (netto verkoopopbrengst)", value: netProceeds, unit: "EUR", formula: "verkoopprijs − verkoopkosten − totale restschuld + opgebouwde waarde" })
    t.add({ id: "eigenwoningreserve", label: "Eigenwoningreserve", value: eigenwoningreserve, unit: "EUR", formula: "verkoopprijs − verkoopkosten − eigenwoningschuld", normKeys: [NORM_KEYS.eigenwoningreserve] })
    if (bridge) t.add({ id: "overbruggingsrente", label: "Rente overbruggingskrediet", value: bridge.interest, unit: "EUR", formula: "overbrugging × rente × maanden / 12" })
    if (doubleCosts) t.add({ id: "dubbeleLasten", label: "Dubbele woonlasten (netto)", value: doubleCosts.total, unit: "EUR", formula: "maanden × netto maandlast oude woning" })
  }

  return {
    salePrice,
    saleCosts: sc,
    totalDebt,
    portedDebt,
    repaidDebt,
    netProceeds,
    cashFromSale,
    restschuld,
    eigenwoningschuld,
    eigenwoningreserve,
    portedParts: ported.map((p) => toLoanPart(p, params.calculationDate)),
    bridge,
    doubleCosts,
    temporaryHousing,
    notes,
  }
}
