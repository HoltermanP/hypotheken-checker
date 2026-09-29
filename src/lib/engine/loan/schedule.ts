import { annuityPayment, monthlyRate } from "../math"
import type { NormValues } from "../norms"
import type { LoanPartType } from "../types"
import { hillenPctForYear, ownHomeTaxEffect } from "../tax/own-home"

/**
 * Maandlasten per leningdeel, uitgewerkt per maand en samengevat per jaar (30 jaar), bruto en
 * netto. Na afloop van de rentevaste periode rekenen we standaard met dezelfde rente (tenzij een
 * renteschok is opgegeven, zoals in de stresstest).
 */

export interface LoanPart {
  id: string
  label: string
  type: LoanPartType
  principal: number
  ratePct: number
  fixedYears: number
  /** Resterende looptijd in maanden. */
  termMonths: number
  /** Rente aftrekbaar in box 1. */
  deductible: boolean
  /** Aantal jaren dat de rente nog aftrekbaar is (max. 30 jaar; overgangsrecht kan korter zijn). */
  deductibleYears?: number
  startedBefore2013?: boolean
  /** Meegenomen bestaand leningdeel. */
  ported?: boolean
  nhg?: boolean
}

export interface ScheduleOptions {
  months?: number
  /** Renteverhoging (procentpunt) na afloop van de rentevaste periode. */
  rateShockPp?: number
  /** Rente na rentevaste periode (overschrijft de huidige rente + shock). */
  rateAfterFixedPct?: number
}

export interface MonthRow {
  month: number
  interest: number
  repayment: number
  deductibleInterest: number
  balance: number
}

export interface PartSchedule {
  part: LoanPart
  months: MonthRow[]
  firstMonthGross: number
  paymentAfterReset: number
}

export function partSchedule(part: LoanPart, opts: ScheduleOptions = {}): PartSchedule {
  const horizon = opts.months ?? 360
  const rows: MonthRow[] = []
  let balance = part.principal
  let rate = part.ratePct
  const fixedMonths = part.fixedYears * 12
  let payment = annuityPayment(balance, rate, part.termMonths)
  let firstMonthGross = 0
  let paymentAfterReset = 0
  const deductibleMonths = (part.deductibleYears ?? 30) * 12
  for (let m = 1; m <= horizon; m++) {
    if (m === fixedMonths + 1 && fixedMonths > 0) {
      rate = opts.rateAfterFixedPct ?? part.ratePct + (opts.rateShockPp ?? 0)
      const remaining = Math.max(1, part.termMonths - fixedMonths)
      payment = annuityPayment(balance, rate, remaining)
    }
    if (balance <= 0.005 || m > part.termMonths) {
      rows.push({ month: m, interest: 0, repayment: 0, deductibleInterest: 0, balance: Math.max(0, balance) })
      continue
    }
    const interest = balance * monthlyRate(rate)
    let repayment = 0
    if (part.type === "annuity") {
      repayment = Math.min(balance, payment - interest)
    } else if (part.type === "linear") {
      repayment = Math.min(balance, part.principal / part.termMonths)
    } else if (m === part.termMonths) {
      // Aflossingsvrij/spaar/belegging: aflossing aan het einde van de looptijd.
      repayment = balance
    }
    balance -= repayment
    const deductibleInterest = part.deductible && m <= deductibleMonths ? interest : 0
    rows.push({ month: m, interest, repayment, deductibleInterest, balance })
    if (m === 1) firstMonthGross = interest + repayment
    if (m === fixedMonths + 1) paymentAfterReset = interest + repayment
  }
  if (paymentAfterReset === 0) paymentAfterReset = firstMonthGross
  return { part, months: rows, firstMonthGross, paymentAfterReset }
}

export interface YearRow {
  year: number
  calendarYear: number
  interest: number
  repayment: number
  gross: number
  deductibleInterest: number
  ewf: number
  taxBenefit: number
  net: number
  netMonthly: number
  grossMonthly: number
  balanceEnd: number
  propertyValue: number
  ltvPct: number
  equity: number
  hillenPct: number
}

export interface ProjectionParams {
  norms: NormValues
  parts: LoanPart[]
  startYear: number
  propertyValue: number
  woz: number
  /** Verwachte jaarlijkse waardestijging (%). */
  valueGrowthPct: number
  /** Belastbaar inkomen en AOW-status van de partner die de aftrek claimt, per jaarindex (0-based). */
  taxProfile: (yearIndex: number) => { taxableIncome: number; aow: boolean }
  /** Jaarlijkse afbouw Wet Hillen (procentpunt). */
  hillenStepPct: number
  scheduleOptions?: ScheduleOptions
  years?: number
}

export interface Projection {
  years: YearRow[]
  parts: PartSchedule[]
  firstMonthGross: number
  firstMonthNet: number
  totalInterest: number
  totalRepayment: number
  totalNet: number
}

export function projectLoan(p: ProjectionParams): Projection {
  const years = p.years ?? 30
  const schedules = p.parts.map((part) => partSchedule(part, { months: years * 12, ...p.scheduleOptions }))
  const rows: YearRow[] = []
  let value = p.propertyValue
  let woz = p.woz
  for (let y = 0; y < years; y++) {
    let interest = 0
    let repayment = 0
    let deductibleInterest = 0
    let balanceEnd = 0
    for (const s of schedules) {
      for (let m = y * 12; m < (y + 1) * 12; m++) {
        const row = s.months[m]
        if (!row) continue
        interest += row.interest
        repayment += row.repayment
        deductibleInterest += row.deductibleInterest
      }
      balanceEnd += s.months[(y + 1) * 12 - 1]?.balance ?? 0
    }
    const profile = p.taxProfile(y)
    const hillenPct = hillenPctForYear(p.norms.tax.hillenAftrekPct, y, p.hillenStepPct)
    const hasOwnHomeDebt = p.parts.some((part) => part.deductible)
    const tax = hasOwnHomeDebt
      ? ownHomeTaxEffect(p.norms, woz, deductibleInterest, profile.taxableIncome, { aow: profile.aow, hillenPct })
      : { ewf: 0, benefit: 0 }
    const gross = interest + repayment
    const net = gross - tax.benefit
    rows.push({
      year: y + 1,
      calendarYear: p.startYear + y,
      interest,
      repayment,
      gross,
      deductibleInterest,
      ewf: tax.ewf,
      taxBenefit: tax.benefit,
      net,
      grossMonthly: gross / 12,
      netMonthly: net / 12,
      balanceEnd,
      propertyValue: value,
      ltvPct: value > 0 ? (balanceEnd / value) * 100 : 0,
      equity: value - balanceEnd,
      hillenPct,
    })
    value *= 1 + p.valueGrowthPct / 100
    woz *= 1 + p.valueGrowthPct / 100
  }
  const firstMonthGross = schedules.reduce((a, s) => a + s.firstMonthGross, 0)
  const firstYear = rows[0]
  const firstMonthNet = firstYear ? firstMonthGross - firstYear.taxBenefit / 12 : firstMonthGross
  return {
    years: rows,
    parts: schedules,
    firstMonthGross,
    firstMonthNet,
    totalInterest: rows.reduce((a, r) => a + r.interest, 0),
    totalRepayment: rows.reduce((a, r) => a + r.repayment, 0),
    totalNet: rows.reduce((a, r) => a + r.net, 0),
  }
}

/** Gemiddelde netto maandlast over de eerste `years` jaar. */
export function averageNetMonthly(projection: Projection, years: number): number {
  const rows = projection.years.slice(0, Math.max(1, years))
  return rows.reduce((a, r) => a + r.net, 0) / (rows.length * 12)
}

/** Totale (bruto) rentekosten over de eerste `years` jaar. */
export function interestOverYears(projection: Projection, years: number): number {
  return projection.years.slice(0, years).reduce((a, r) => a + r.interest, 0)
}

/**
 * Splits een hypotheekbedrag in leningdelen op basis van de voorkeur (annuïtair/lineair/mix met
 * een aflossingsvrij deel) en de fiscale ruimte (bijleenregeling: deel boven de maximale
 * eigenwoningschuld valt in box 3).
 */
export function buildLoanParts(params: {
  amount: number
  ratePct: number
  interestOnlyRatePct?: number
  fixedYears: number
  termMonths: number
  repaymentType: "annuity" | "linear" | "mixed"
  interestOnlyPct: number
  maxOwnHomeDebt: number
  nhg: boolean
  ported?: LoanPart[]
}): LoanPart[] {
  const parts: LoanPart[] = [...(params.ported ?? [])]
  const portedTotal = parts.reduce((a, p) => a + p.principal, 0)
  const newAmount = Math.max(0, params.amount - portedTotal)
  if (newAmount <= 0) return parts
  const interestOnlyAmount =
    params.repaymentType === "mixed" && !params.nhg ? (newAmount * Math.min(50, params.interestOnlyPct)) / 100 : 0
  const amortizing = newAmount - interestOnlyAmount
  const ownHomeRoom = Math.max(0, params.maxOwnHomeDebt - portedTotal)
  const box1Amount = Math.min(amortizing, ownHomeRoom)
  const box3Amount = amortizing - box1Amount
  const type = params.repaymentType === "linear" ? "linear" : "annuity"
  if (box1Amount > 0) {
    parts.push({
      id: "nieuw-box1",
      label: type === "linear" ? "Lineair (box 1)" : "Annuïtair (box 1)",
      type,
      principal: box1Amount,
      ratePct: params.ratePct,
      fixedYears: params.fixedYears,
      termMonths: params.termMonths,
      deductible: true,
      nhg: params.nhg,
    })
  }
  if (box3Amount > 0) {
    parts.push({
      id: "nieuw-box3",
      label: "Annuïtair (box 3, niet aftrekbaar)",
      type,
      principal: box3Amount,
      ratePct: params.ratePct,
      fixedYears: params.fixedYears,
      termMonths: params.termMonths,
      deductible: false,
      nhg: params.nhg,
    })
  }
  if (interestOnlyAmount > 0) {
    parts.push({
      id: "nieuw-aflossingsvrij",
      label: "Aflossingsvrij (box 3, niet aftrekbaar)",
      type: "interest_only",
      principal: interestOnlyAmount,
      ratePct: params.interestOnlyRatePct ?? params.ratePct,
      fixedYears: params.fixedYears,
      termMonths: params.termMonths,
      deductible: false,
      nhg: false,
    })
  }
  return parts
}
