import { bracketTax } from "../math"
import { NORM_KEYS, type NormValues } from "../norms"
import { deductionRate, netIncome } from "../tax/income-tax"
import { box2Tax, vpbMarginalPct } from "../tax/wealth-tax"
import type { BusinessInput, BvYear, DgaLoan } from "./types"

/**
 * Ondernemersscenario's (§6B): salaris of dividend verhogen, eigen geld uit de BV, hypotheek bij
 * de eigen BV, Wet excessief lenen, overwaarde voor de onderneming en de woning in de BV.
 * Alle bedragen per jaar tenzij anders vermeld.
 */

// ---------------------------------------------------------------------------
// Wet excessief lenen bij eigen vennootschap
// ---------------------------------------------------------------------------

export interface ExcessiveBorrowingResult {
  countedDebt: number
  excludedDebt: number
  threshold: number
  excess: number
  box2Tax: number
  lines: { id: string; amount: number; counted: boolean; reason: string }[]
  normKeys: string[]
}

/**
 * Schulden aan de eigen BV boven de drempel (peildatum 31 december) worden belast als fictief
 * regulier voordeel in box 2. Eigenwoningschulden tellen niet mee als er hypotheekrecht is
 * gevestigd voor de BV; die eis geldt niet voor eigenwoningschulden van vóór 2023 (overgangsrecht).
 */
export function excessiveBorrowing(norms: NormValues, loans: DgaLoan[]): ExcessiveBorrowingResult {
  const lines = loans.map((l) => {
    const excluded = l.purpose === "eigen_woning" && (l.mortgageRight || l.existedBefore2023)
    return {
      id: l.id,
      amount: l.amount,
      counted: !excluded,
      reason: excluded
        ? l.mortgageRight
          ? "Eigenwoningschuld met hypotheekrecht voor de BV: uitgezonderd."
          : "Eigenwoningschuld van vóór 2023: overgangsrecht, uitgezonderd."
        : l.purpose === "eigen_woning"
          ? "Eigenwoningschuld zonder hypotheekrecht (na 2022): telt mee."
          : "Telt mee voor de drempel.",
    }
  })
  const countedDebt = lines.filter((l) => l.counted).reduce((a, l) => a + l.amount, 0)
  const excludedDebt = lines.filter((l) => !l.counted).reduce((a, l) => a + l.amount, 0)
  const threshold = norms.ondernemer.excessiefLenenDrempel
  const excess = Math.max(0, countedDebt - threshold)
  return {
    countedDebt,
    excludedDebt,
    threshold,
    excess,
    box2Tax: box2Tax(norms, excess),
    lines,
    normKeys: [NORM_KEYS.excessiefLenen, NORM_KEYS.excessiefLenenUitzondering, NORM_KEYS.box2],
  }
}

// ---------------------------------------------------------------------------
// Salaris of dividend verhogen vóór de aanvraag
// ---------------------------------------------------------------------------

export interface SalaryVsDividendResult {
  delta: number
  salary: {
    extraBox1Tax: number
    vpbSaving: number
    netCostNow: number
    /** Netto kosten als je meetelt dat hetzelfde bedrag anders later als dividend (box 2) uitgekeerd zou worden. */
    netCostInclFutureBox2: number
  }
  dividend: {
    box2Tax: number
    netReceived: number
  }
  normKeys: string[]
}

export function salaryVsDividend(
  norms: NormValues,
  params: { delta: number; currentSalary: number; otherBox2Income: number; bvProfitBeforeTax: number }
): SalaryVsDividendResult {
  const { delta } = params
  const before = netIncome(norms, params.currentSalary, params.currentSalary)
  const after = netIncome(norms, params.currentSalary + delta, params.currentSalary + delta)
  const extraBox1Tax = delta - (after.net - before.net)
  const vpbRate = vpbMarginalPct(norms, Math.max(0, params.bvProfitBeforeTax))
  const vpbSaving = (delta * vpbRate) / 100
  const futureDividend = delta * (1 - vpbRate / 100)
  const futureBox2 =
    box2Tax(norms, params.otherBox2Income + futureDividend) - box2Tax(norms, params.otherBox2Income)
  const dividendBox2 = box2Tax(norms, params.otherBox2Income + delta) - box2Tax(norms, params.otherBox2Income)
  return {
    delta,
    salary: {
      extraBox1Tax,
      vpbSaving,
      netCostNow: extraBox1Tax - vpbSaving,
      netCostInclFutureBox2: extraBox1Tax - vpbSaving - futureBox2,
    },
    dividend: { box2Tax: dividendBox2, netReceived: delta - dividendBox2 },
    normKeys: [NORM_KEYS.box1, NORM_KEYS.vpb, NORM_KEYS.box2, NORM_KEYS.gebruikelijkLoon],
  }
}

/** Pas de BV-cijfers aan voor een extra salaris of dividend (voor herberekening van het toetsinkomen). */
export function adjustBusinessForPayout(
  business: BusinessInput,
  kind: "salary" | "dividend",
  delta: number,
  norms: NormValues
): BusinessInput {
  if (!business.bv) return business
  const bv = business.bv
  const lastSalary = [...bv.salaries].sort((a, b) => a.year - b.year).at(-1)
  const salaries =
    kind === "salary" && lastSalary
      ? bv.salaries.map((s) => (s.year === lastSalary.year ? { ...s, amount: s.amount + delta } : s))
      : bv.salaries
  const adjustYear = (f: BvYear, isLast: boolean): BvYear => {
    if (!isLast) return f
    if (kind === "salary") {
      const vpbRate = vpbMarginalPct(norms, Math.max(0, f.resultBeforeTax)) / 100
      const afterTaxEffect = delta * (1 - vpbRate)
      return {
        ...f,
        resultBeforeTax: f.resultBeforeTax - delta,
        resultAfterTax: f.resultAfterTax - afterTaxEffect,
        retainedEarnings: f.retainedEarnings - afterTaxEffect,
        equity: f.equity - afterTaxEffect,
        liquidAssets: f.liquidAssets - afterTaxEffect,
        currentAssets: f.currentAssets - afterTaxEffect,
        balanceTotal: f.balanceTotal - afterTaxEffect,
        dgaSalaryPaid: f.dgaSalaryPaid + delta,
      }
    }
    return {
      ...f,
      dividendPaid: f.dividendPaid + delta,
      retainedEarnings: f.retainedEarnings - delta,
      equity: f.equity - delta,
      liquidAssets: f.liquidAssets - delta,
      currentAssets: f.currentAssets - delta,
      balanceTotal: f.balanceTotal - delta,
    }
  }
  const adjustSeries = (years: BvYear[]) => {
    const real = years.filter((y) => !y.isForecast)
    const lastYear = Math.max(...real.map((y) => y.year))
    return years.map((y) => adjustYear(y, !y.isForecast && y.year === lastYear))
  }
  const top = bv.entities.find((e) => e.parentKey === null)
  const operating = bv.entities.find((e) => e.role === "werkmaatschappij") ?? top
  const payer = kind === "salary" ? (bv.entities.find((e) => e.financials.some((f) => f.dgaSalaryPaid > 0)) ?? operating) : top
  return {
    ...business,
    bv: {
      ...bv,
      salaries,
      consolidated: bv.consolidated ? adjustSeries(bv.consolidated) : bv.consolidated,
      entities: bv.entities.map((e) => (e.key === payer?.key ? { ...e, financials: adjustSeries(e.financials) } : e)),
    },
  }
}

// ---------------------------------------------------------------------------
// Eigen geld uit de BV
// ---------------------------------------------------------------------------

export interface EquityFromBvResult {
  amountNeeded: number
  dividend: { gross: number; box2Tax: number; solvencyAfterPct: number | null }
  loan: {
    amount: number
    ratePct: number
    annualInterest: number
    deductible: boolean
    netAnnualCostPrivate: number
    excessive: ExcessiveBorrowingResult
  }
  keepInBv: { extraMortgageNeeded: number }
  normKeys: string[]
}

export function equityFromBv(
  norms: NormValues,
  params: {
    amountNeeded: number
    latest: BvYear | null
    existingLoans: DgaLoan[]
    loanRatePct: number
    taxableIncome: number
    /** Lening voor de eigen woning met hypotheekrecht voor de BV (aftrekbaar bij annuïtaire aflossing). */
    forOwnHomeWithMortgageRight: boolean
  }
): EquityFromBvResult {
  // Bruto dividend zodat netto het benodigde bedrag overblijft (box 2-schijven, iteratief).
  let gross = params.amountNeeded
  for (let i = 0; i < 30; i++) {
    const net = gross - box2Tax(norms, gross)
    gross += params.amountNeeded - net
  }
  const tax = box2Tax(norms, gross)
  const latest = params.latest
  const solvencyAfterPct =
    latest && latest.balanceTotal - gross > 0 ? ((latest.equity - gross) / (latest.balanceTotal - gross)) * 100 : null
  const newLoan: DgaLoan = {
    id: "nieuw",
    amount: params.amountNeeded,
    purpose: params.forOwnHomeWithMortgageRight ? "eigen_woning" : "overig",
    mortgageRight: params.forOwnHomeWithMortgageRight,
    existedBefore2023: false,
    ratePct: params.loanRatePct,
  }
  const annualInterest = (params.amountNeeded * params.loanRatePct) / 100
  const deductible = params.forOwnHomeWithMortgageRight
  const rate = deductionRate(norms, params.taxableIncome)
  return {
    amountNeeded: params.amountNeeded,
    dividend: { gross, box2Tax: tax, solvencyAfterPct },
    loan: {
      amount: params.amountNeeded,
      ratePct: params.loanRatePct,
      annualInterest,
      deductible,
      netAnnualCostPrivate: deductible ? annualInterest * (1 - rate / 100) : annualInterest,
      excessive: excessiveBorrowing(norms, [...params.existingLoans, newLoan]),
    },
    keepInBv: { extraMortgageNeeded: params.amountNeeded },
    normKeys: [NORM_KEYS.box2, NORM_KEYS.excessiefLenen, NORM_KEYS.maxAftrek],
  }
}

// ---------------------------------------------------------------------------
// Hypotheek bij de eigen BV versus bij een bank
// ---------------------------------------------------------------------------

export interface OwnBvMortgageResult {
  loanAmount: number
  bank: { ratePct: number; interestYear1: number; netCostYear1: number }
  ownBv: {
    ratePct: number
    interestYear1: number
    privateNetCostYear1: number
    vpbOnInterest: number
    box2OnDistribution: number
    /** Netto kosten voor het 'gezin' (privé + BV samen), inclusief latere box 2. */
    familyNetCostYear1: number
  }
  excessive: ExcessiveBorrowingResult
  risks: string[]
  normKeys: string[]
}

export function mortgageAtOwnBv(
  norms: NormValues,
  params: {
    loanAmount: number
    bankRatePct: number
    bvRatePct: number
    taxableIncome: number
    bvProfit: number
    existingLoans: DgaLoan[]
    mortgageRight: boolean
    otherBox2Income: number
  }
): OwnBvMortgageResult {
  const ded = deductionRate(norms, params.taxableIncome) / 100
  const bankInterest = (params.loanAmount * params.bankRatePct) / 100
  const bvInterest = (params.loanAmount * params.bvRatePct) / 100
  const vpbRate = vpbMarginalPct(norms, params.bvProfit + bvInterest) / 100
  const vpb = bvInterest * vpbRate
  const box2 =
    bracketTax(params.otherBox2Income + bvInterest - vpb, norms.ondernemer.box2) -
    bracketTax(params.otherBox2Income, norms.ondernemer.box2)
  const deductible = params.mortgageRight
  const privateNet = bvInterest * (1 - (deductible ? ded : 0))
  const loan: DgaLoan = {
    id: "hypotheek-bv",
    amount: params.loanAmount,
    purpose: "eigen_woning",
    mortgageRight: params.mortgageRight,
    existedBefore2023: false,
    ratePct: params.bvRatePct,
  }
  return {
    loanAmount: params.loanAmount,
    bank: { ratePct: params.bankRatePct, interestYear1: bankInterest, netCostYear1: bankInterest * (1 - ded) },
    ownBv: {
      ratePct: params.bvRatePct,
      interestYear1: bvInterest,
      privateNetCostYear1: privateNet,
      vpbOnInterest: vpb,
      box2OnDistribution: box2,
      familyNetCostYear1: privateNet - (bvInterest - vpb - box2),
    },
    excessive: excessiveBorrowing(norms, [...params.existingLoans, loan]),
    risks: [
      "Het geld zit vast in je woning en ontbreekt in de onderneming (minder buffer en investeringsruimte).",
      "De rente moet zakelijk zijn (vergelijkbaar met een bank) en er moet een schriftelijke overeenkomst met aflosschema zijn.",
      "Voor renteaftrek in box 1 moet de lening minimaal annuïtair of lineair in 30 jaar worden afgelost.",
      "Bij faillissement van de BV kan de curator de vordering op jou opeisen.",
      ...(params.mortgageRight ? [] : ["Zonder hypotheekrecht voor de BV telt de lening mee voor de Wet excessief lenen."]),
    ],
    normKeys: [NORM_KEYS.maxAftrek, NORM_KEYS.vpb, NORM_KEYS.box2, NORM_KEYS.excessiefLenen, NORM_KEYS.aflossingseis],
  }
}

// ---------------------------------------------------------------------------
// Woning in de BV (alleen op verzoek)
// ---------------------------------------------------------------------------

export interface HomeInBvResult {
  transferTaxPrivate: number
  transferTaxBv: number
  lostDeductionYear1: number
  reasons: string[]
  normKeys: string[]
}

export function homeInBv(
  norms: NormValues,
  params: { price: number; loan: number; ratePct: number; taxableIncome: number }
): HomeInBvResult {
  const ded = deductionRate(norms, params.taxableIncome) / 100
  return {
    transferTaxPrivate: (params.price * norms.ovb.eigenWoningPct) / 100,
    transferTaxBv: (params.price * norms.ovb.overigPct) / 100,
    lostDeductionYear1: ((params.loan * params.ratePct) / 100) * ded,
    reasons: [
      "Geen eigenwoningregeling: geen hypotheekrenteaftrek in box 1.",
      "De BV betaalt het hogere overdrachtsbelastingtarief voor overige woningen (geen startersvrijstelling).",
      "Privégebruik van de woning van de BV leidt tot een marktconforme huur of een belaste bijtelling.",
      "Waardestijging is belast in de BV (Vpb) en bij uitkering nog eens in box 2.",
      "Bij faillissement van de BV kan de woning in de boedel vallen.",
    ],
    normKeys: [NORM_KEYS.ovbEigen, NORM_KEYS.ovbOverig, NORM_KEYS.maxAftrek],
  }
}
