import { ageInYears, aowDate, hasReachedAow, monthsBetween, monthsUntilAow, parseDate } from "./age"
import { collateralCapacity, nhgCheck, type CollateralResult, type NhgResult } from "./capacity/collateral"
import { incomeCapacity, type CapacityApplicant, type IncomeCapacityResult } from "./capacity/income-capacity"
import { totalAlimonyPaidAnnual } from "./capacity/obligations"
import { budget as runBudget, householdNetMonthly, type BudgetResult, type PersonIncome } from "./budget/budget"
import { buildChecks, type Check } from "./checks/checks"
import { applicantBusinessIncome, withDefaults, type BusinessIncome } from "./entrepreneur"
import { correctedProfit } from "./entrepreneur/sole-prop"
import { entrepreneurChapter, type EntrepreneurChapter } from "./entrepreneur/chapter"
import { optimizeEquity, type EquityOptimization } from "./equity/optimize"
import { financingPlan, ownFundsAvailable, propertyMarketValue, type FinancingPlan } from "./financing/purchase"
import { employeeToetsinkomen, grossIncomeForTax, type IncomeAssessment } from "./income/employee"
import { compareLenders, type LenderComparison } from "./lenders/compare"
import { medianRate } from "./lenders/rates"
import type { LenderProfile, RateRow } from "./lenders/types"
import { averageNetMonthly, buildLoanParts, projectLoan, type LoanPart, type Projection, type YearRow } from "./loan/schedule"
import { floorEuro } from "./math"
import { moverAnalysis, toLoanPart, type MoverResult } from "./mover/move"
import { refinanceAnalysis, type RefinanceResult } from "./mover/penalty"
import type { NormMeta, NormSet } from "./norms"
import { equityReleaseOptions, type EquityOption } from "./options/equity-release"
import { runStressTests, type StressApplicant, type StressResult } from "./stress/stress"
import { Tracer, type TraceEntry } from "./trace"
import type { EngineInput } from "./types"

/**
 * Orchestrator van de rekenkern: combineert alle modules tot één deterministische uitkomst per
 * dossier. Pure functie: dezelfde invoer + normenset + bankdata geeft altijd dezelfde uitvoer.
 */

export const ENGINE_VERSION = "1.0.0"

export interface EngineContext {
  norms: NormSet
  lenders: LenderProfile[]
  rates: RateRow[]
}

export interface ApplicantSummary {
  id: string
  label: string
  age: number
  reachedAow: boolean
  monthsUntilAow: number
  aowDate: string
  employeeIncome: IncomeAssessment[]
  businessIncome: BusinessIncome[]
  toetsinkomen: number
  taxable: number
  labour: number
  retirementIncome: number
  retirementIncomeAssumed: boolean
  isEntrepreneur: boolean
}

export interface Lever {
  key: string
  label: string
  extraLoan: number
  explanation: string
}

export interface AdviceOutput {
  engineVersion: string
  normSetVersion: string
  normYear: number
  calculationDate: string
  goal: EngineInput["goal"]
  applicants: ApplicantSummary[]
  capacity: {
    income: IncomeCapacityResult
    collateral: CollateralResult | null
    maxMortgage: number
    limiting: "inkomen" | "onderpand"
    levers: Lever[]
  }
  purchase: FinancingPlan | null
  mover: MoverResult | null
  refinance: RefinanceResult | null
  loan: {
    amount: number
    requested: number
    shortfall: number
    parts: LoanPart[]
    ratePct: number
    fixedYears: number
    nhg: NhgResult | null
    nhgApplied: boolean
    interestOnlyAmount: number
    years: YearRow[]
    grossMonthlyYear1: number
    netMonthlyYear1: number
    avgNetMonthlyFixed: number
    totalInterest30: number
    propertyValue: number
  }
  prudent: { loan: number; netMonthly: number; explanation: string }
  budget: BudgetResult | null
  stress: StressResult[]
  lenders: LenderComparison
  equity: EquityOptimization | null
  equityRelease: { room: number; options: EquityOption[] } | null
  entrepreneur: EntrepreneurChapter | null
  checks: Check[]
  summary: {
    maxMortgage: number
    prudentLoan: number
    loanAmount: number
    grossMonthly: number
    netMonthly: number
    shortfall: number
    nhg: boolean
    ratePct: number
    limiting: "inkomen" | "onderpand"
    redChecks: number
  }
  assumptions: NormMeta[]
  trace: TraceEntry[]
  warnings: string[]
}

const PURCHASE_GOALS = new Set(["starter", "doorstromer", "orientatie"])
const BOX3_PURPOSES = new Set(["consumption", "business", "gift_children", "pension"])

function soleTaxable(input: EngineInput["applicants"][number], norms: NormSet["values"]): number {
  let total = 0
  for (const b of input.businesses) {
    if (!b.soleProp) continue
    const last = [...b.soleProp.years].filter((y) => !y.isForecast).sort((a, c) => a.year - c.year).at(-1)
    if (!last) continue
    const profit = correctedProfit(last)
    const afterSa = Math.max(0, profit - (last.hoursCriterionMet ? norms.ondernemer.zelfstandigenaftrek : 0))
    total += afterSa * (1 - norms.ondernemer.mkbWinstvrijstellingPct / 100)
  }
  return total
}

export function runAdvice(input: EngineInput, ctx: EngineContext): AdviceOutput {
  const norms = ctx.norms.values
  const tracer = new Tracer()
  const date = input.calculationDate
  const startYear = parseDate(date).y
  const warnings: string[] = []
  const fixedYears = input.preferences.fixedRateYears
  const termMonths = input.preferences.termMonths ?? 360
  const rate = input.referenceRatePct
  const target = PURCHASE_GOALS.has(input.goal) ? (input.targetProperty ?? null) : null
  const current = input.currentProperty ?? null
  const release = input.goal === "verhogen" ? (input.equityRelease ?? null) : null
  const persons = input.applicants.length
  const defaultPolicy = withDefaults(null)

  // --------------------------------------------------------------------- aanvragers
  const applicants: ApplicantSummary[] = input.applicants.map((a, i) => {
    const employee = employeeToetsinkomen(a.incomes)
    const biz = applicantBusinessIncome(a.businesses, defaultPolicy, norms)
    const reached = hasReachedAow(a.dateOfBirth, date, norms)
    const gross = grossIncomeForTax(a.incomes)
    const salaries = a.businesses.reduce((s, b) => s + ([...(b.bv?.salaries ?? [])].sort((x, y) => x.year - y.year).at(-1)?.amount ?? 0), 0)
    const sole = soleTaxable(a, norms)
    const labour = gross.labour + salaries + sole
    const taxable = labour + gross.other
    const pensionNow = a.incomes.filter((x) => x.kind === "pension").reduce((s, x) => s + (x.kind === "pension" ? x.grossAnnual : 0), 0)
    const aowAmount = persons >= 2 ? norms.social.aowJaarGehuwdPerPersoon : norms.social.aowJaarAlleenstaand
    const assumed = !reached && (a.expectedRetirementIncome === null || a.expectedRetirementIncome === undefined)
    const retirementIncome = reached
      ? employee.total + biz.total
      : (a.expectedRetirementIncome ?? aowAmount + pensionNow)
    if (assumed) {
      warnings.push(
        `${i === 0 ? "Aanvrager 1" : "Partner"}: verwacht pensioeninkomen niet opgegeven; gerekend met alleen de AOW. Upload je pensioenoverzicht voor een nauwkeuriger AOW-toets.`
      )
    }
    return {
      id: a.id,
      label: i === 0 ? "aanvrager 1" : "partner",
      age: ageInYears(a.dateOfBirth, date),
      reachedAow: reached,
      monthsUntilAow: monthsUntilAow(a.dateOfBirth, date, norms),
      aowDate: aowDate(a.dateOfBirth, norms),
      employeeIncome: employee.items,
      businessIncome: biz.items,
      toetsinkomen: employee.total + (biz.accepted === false ? 0 : biz.total),
      taxable,
      labour,
      retirementIncome,
      retirementIncomeAssumed: assumed,
      isEntrepreneur: a.businesses.length > 0,
    }
  })
  const baseApps: CapacityApplicant[] = applicants.map((a) => ({
    id: a.id,
    toetsinkomen: a.toetsinkomen,
    reachedAow: a.reachedAow,
    monthsUntilAow: a.monthsUntilAow,
    retirementIncome: a.retirementIncome,
  }))
  const highest = [...applicants].sort((a, b) => b.taxable - a.taxable)[0]!

  // --------------------------------------------------------------------- leencapaciteit
  const energyLabel = target?.energyLabel ?? current?.energyLabel ?? "geen"
  const energySaving = target?.energySavingAmount ?? (release?.purpose === "energy" ? release.amount : 0)
  const erfpacht = target?.erfpachtCanonAnnual ?? current?.erfpachtCanonAnnual ?? 0
  const alimonyPaid = input.applicants.reduce((s, a) => s + a.alimonyPaidAnnual, 0) + totalAlimonyPaidAnnual(input.obligations)
  const noDeduction = release ? BOX3_PURPOSES.has(release.purpose) : false
  if (noDeduction) {
    warnings.push("Het extra leningdeel is niet aftrekbaar; de leenruimte is (conservatief) getoetst met de box 3-tabel.")
  }
  const capacityOf = (
    apps: CapacityApplicant[],
    ratePct = rate,
    opts: Partial<Parameters<typeof incomeCapacity>[0]> = {}
  ): IncomeCapacityResult =>
    incomeCapacity({
      norms,
      applicants: apps,
      obligations: input.obligations,
      alimonyPaidAnnual: alimonyPaid,
      erfpachtAnnual: erfpacht,
      ratePct,
      fixedYears,
      energyLabel,
      energySavingAmount: energySaving,
      noInterestDeduction: noDeduction,
      ...opts,
    })
  const incomeCap = capacityOf(baseApps, rate, { tracer: tracer.child("capaciteit") })

  const marketValue: number | null = target ? propertyMarketValue(target) : current ? current.marketValue : null
  const collateral =
    marketValue !== null
      ? collateralCapacity({ norms, marketValue, energySavingAmount: energySaving, tracer: tracer.child("onderpand") })
      : null
  const maxMortgage = Math.min(incomeCap.maxLoan, collateral?.maxLoan ?? Number.POSITIVE_INFINITY)
  const limiting: "inkomen" | "onderpand" = collateral && collateral.maxLoan < incomeCap.maxLoan ? "onderpand" : "inkomen"
  tracer.add({
    id: "maxHypotheek",
    label: "Maximale hypotheek",
    value: maxMortgage,
    unit: "EUR",
    formula: "laagste van maximale hypotheek op inkomen en op onderpand",
  })

  // --------------------------------------------------------------------- doorstromer
  const mover =
    input.goal === "doorstromer" || input.goal === "verkopen"
      ? current
        ? moverAnalysis({
            norms,
            current,
            calculationDate: date,
            move: input.move,
            referenceRatePct: rate,
            taxableIncome: highest.taxable,
            tracer: tracer.child("doorstromer"),
          })
        : null
      : null

  // --------------------------------------------------------------------- leenbedrag per doel
  const nhgWanted = input.preferences.nhg !== "no"
  const repaymentType = input.preferences.repaymentType
  let plan: FinancingPlan | null = null
  let requested = 0
  let loanAmount = 0
  let nhg: NhgResult | null = null
  let refinance: RefinanceResult | null = null
  const currentDebt = current?.loanParts.reduce((s, p) => s + p.balance, 0) ?? 0

  let partsFor: (loan: number, ratePct: number) => LoanPart[]
  if (target) {
    plan = financingPlan({
      norms,
      property: target,
      applicants: input.applicants,
      assets: input.assets,
      maxMortgageIncome: incomeCap.maxLoan,
      maxMortgageCollateral: collateral?.maxLoan ?? Number.POSITIVE_INFINITY,
      ratePct: rate,
      nhgWanted,
      netSaleProceeds: mover ? Math.max(0, mover.netProceeds) : 0,
      restschuld: mover?.restschuld ?? 0,
      eigenwoningreserve: (mover?.eigenwoningreserve ?? 0) + input.assets.eigenwoningreserve,
      transferDate: target.deliveryDate ?? date,
      interestOnlyAmount: 0,
      tracer: tracer.child("financiering"),
    })
    requested = plan.requiredMortgage
    loanAmount = plan.mortgage
    nhg = plan.nhg
    const nhgApplies = nhgWanted && plan.nhg.eligible
    if (repaymentType === "mixed" && nhgApplies && input.preferences.interestOnlyPct > 0) {
      warnings.push("Met NHG mag een nieuw leningdeel niet aflossingsvrij zijn; er is annuïtair gerekend.")
    }
    const maxOwnHomeDebt = plan.maxOwnHomeDebt + (mover?.portedParts.reduce((s, p) => s + p.principal, 0) ?? 0)
    partsFor = (loan, ratePct) =>
      buildLoanParts({
        amount: loan,
        ratePct,
        fixedYears,
        termMonths,
        repaymentType,
        interestOnlyPct: input.preferences.interestOnlyPct,
        maxOwnHomeDebt,
        nhg: nhgApplies,
        ported: mover?.portedParts,
      })
  } else if (input.goal === "verhogen" && current) {
    const extra = release?.amount ?? 0
    requested = currentDebt + extra
    loanAmount = Math.min(requested, maxMortgage)
    const deductible = !noDeduction
    const existing = current.loanParts.map((p) => toLoanPart(p, date))
    partsFor = (loan, ratePct) => {
      const extraAmount = Math.max(0, loan - currentDebt)
      return extraAmount > 0
        ? [
            ...existing,
            {
              id: "verhoging",
              label: deductible ? "Verhoging (annuïtair, box 1)" : "Verhoging (annuïtair, box 3)",
              type: "annuity",
              principal: extraAmount,
              ratePct,
              fixedYears,
              termMonths,
              deductible,
            },
          ]
        : existing
    }
    nhg = nhgCheck(norms, loanAmount, { energySaving: energySaving > 0, ownOccupation: true, interestOnlyNew: 0 })
  } else if (input.goal === "oversluiten" && current) {
    requested = currentDebt
    loanAmount = currentDebt
    refinance = refinanceAnalysis(current.loanParts, date, rate, fixedYears)
    partsFor = (_loan, ratePct) =>
      current.loanParts.map((p) => ({
        ...toLoanPart(p, date),
        id: `oversluiten-${p.id}`,
        label: `Overgesloten deel (${p.type === "interest_only" ? "aflossingsvrij" : p.type === "linear" ? "lineair" : "annuïtair"})`,
        ratePct,
        fixedYears,
        ported: false,
      }))
    nhg = nhgCheck(norms, loanAmount, { energySaving: false, ownOccupation: true, interestOnlyNew: 0 })
    if (loanAmount > incomeCap.maxLoan) {
      warnings.push(
        "Oversluiten zonder verhoging mag op grond van de uitzonderingen in de Trhk buiten de inkomenstoets blijven; veel banken toetsen wel."
      )
    }
  } else if (input.goal === "verkopen") {
    partsFor = () => []
  } else {
    // Oriëntatie zonder woning: wat kan ik maximaal lenen?
    requested = Number.isFinite(maxMortgage) ? maxMortgage : incomeCap.maxLoan
    loanAmount = requested
    partsFor = (loan, ratePct) =>
      buildLoanParts({
        amount: loan,
        ratePct,
        fixedYears,
        termMonths,
        repaymentType,
        interestOnlyPct: input.preferences.interestOnlyPct,
        maxOwnHomeDebt: Number.POSITIVE_INFINITY,
        nhg: false,
      })
  }
  loanAmount = floorEuro(Math.max(0, loanAmount))
  const shortfall = plan ? plan.shortfall : Math.max(0, requested - loanAmount)
  const nhgApplied = nhgWanted && (nhg?.eligible ?? false)

  const propertyValue = marketValue ?? loanAmount
  const woz = target?.wozValue ?? current?.wozValue ?? propertyValue
  const taxProfile = (y: number) => {
    const retired = highest.reachedAow || highest.monthsUntilAow <= y * 12
    return retired ? { taxableIncome: highest.retirementIncome, aow: true } : { taxableIncome: highest.taxable, aow: false }
  }
  const projectFor = (loan: number, ratePct: number): Projection =>
    projectLoan({
      norms,
      parts: partsFor(loan, ratePct),
      startYear,
      propertyValue,
      woz,
      valueGrowthPct: norms.market.woningwaardestijgingPct,
      taxProfile,
      hillenStepPct: norms.tax.hillenStepPct,
    })
  const parts = partsFor(loanAmount, rate)
  const projection = projectFor(loanAmount, rate)
  const interestOnlyAmount = parts.filter((p) => p.type === "interest_only" && !p.ported).reduce((s, p) => s + p.principal, 0)
  const y1 = projection.years[0]
  tracer.add({
    id: "maandlast.bruto",
    label: "Bruto maandlast (eerste maand)",
    value: projection.firstMonthGross,
    unit: "EUR/maand",
    formula: "som van rente + aflossing per leningdeel in de eerste maand",
  })
  tracer.add({
    id: "maandlast.netto",
    label: "Netto maandlast (gemiddeld jaar 1)",
    value: y1?.netMonthly ?? 0,
    unit: "EUR/maand",
    formula: "(bruto jaarlast − belastingeffect eigen woning) / 12",
    normKeys: ["ewf.percentages", "box1.max_aftrektarief_pct", "hillen.aftrek_pct"],
  })

  // --------------------------------------------------------------------- begroting en verstandig lenen
  const personIncomes: PersonIncome[] = applicants.map((a) => ({ taxable: a.taxable, labour: a.labour, aow: a.reachedAow }))
  const obligationsActual = input.obligations
    .filter((o) => !o.willBeRepaid && o.type !== "alimony_partner")
    .reduce((s, o) => s + (o.monthlyPayment > 0 ? o.monthlyPayment : (o.limitOrPrincipal * norms.trhk.bkrPctPerMonth) / 100), 0)
  const budgetFor = (housingNet: number) =>
    runBudget(norms, {
      persons: personIncomes,
      adults: persons,
      children: input.household.children,
      housingNetMonthly: housingNet,
      hoaMonthly: target?.hoaMonthly ?? 0,
      erfpachtAnnual: erfpacht,
      propertyValue,
      obligationsMonthly: obligationsActual,
      otherFixedCostsMonthly: input.household.otherFixedCostsMonthly ?? 0,
    })
  const budget = loanAmount > 0 || current ? budgetFor(y1?.netMonthly ?? 0) : null
  const netIncomeMonthly = householdNetMonthly(norms, personIncomes)
  const otherCosts = budget ? budget.totalCosts - (y1?.netMonthly ?? 0) : 0
  const prudentOk = (loan: number) => {
    const net = projectFor(loan, rate).years[0]?.netMonthly ?? 0
    const remaining = netIncomeMonthly - otherCosts - net
    const maxNet = input.preferences.maxNetMonthly
    return remaining >= (netIncomeMonthly * 10) / 100 && (maxNet === null || maxNet === undefined || net <= maxNet)
  }
  let lo = 0
  let hi = Number.isFinite(maxMortgage) ? maxMortgage : incomeCap.maxLoan
  if (prudentOk(hi)) lo = hi
  else {
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2
      if (prudentOk(mid)) lo = mid
      else hi = mid
    }
  }
  const prudentLoan = Math.floor(lo / 1000) * 1000
  const prudent = {
    loan: prudentLoan,
    netMonthly: projectFor(prudentLoan, rate).years[0]?.netMonthly ?? 0,
    explanation:
      "Het verstandige leenbedrag houdt na alle vaste lasten minimaal 10% van je netto-inkomen over om te sparen (Nibud-advies)" +
      (input.preferences.maxNetMonthly ? " en blijft onder je gewenste maximale netto maandlast." : "."),
  }
  tracer.add({
    id: "verstandigLenen",
    label: "Verstandig leenbedrag",
    value: prudentLoan,
    unit: "EUR",
    formula: "hoogste bedrag waarbij na vaste lasten ≥ 10% van het netto-inkomen overblijft (afgerond op € 1.000)",
    normKeys: ["nibud.buffer_eigenaar"],
  })

  // --------------------------------------------------------------------- stresstests
  const stressApplicants: StressApplicant[] = applicants.map((a, i) => {
    const src = input.applicants[i]!
    const wage = grossIncomeForTax(src.incomes).labour
    return {
      id: a.id,
      label: a.label,
      toetsinkomen: a.toetsinkomen,
      taxable: a.taxable,
      labour: a.labour,
      reachedAow: a.reachedAow,
      monthsUntilAow: a.monthsUntilAow,
      retirementIncome: a.retirementIncome,
      isEntrepreneur: a.isEntrepreneur && wage === 0,
      wage: wage > 0 ? wage : a.labour,
      aovMonthly: src.aovMonthlyBenefit ?? src.businesses.reduce((s, b) => s + (b.aov.has ? b.aov.monthlyBenefit : 0), 0),
      survivorPensionAnnual: src.survivorPensionAnnual ?? 0,
      orvCoverage: src.orvCoverage ?? 0,
      yearsWorked: src.yearsWorked ?? Math.max(0, a.age - 22),
    }
  })
  const stress =
    loanAmount > 0
      ? runStressTests({
          norms,
          applicants: stressApplicants,
          loanAmount,
          parts,
          projection,
          propertyValue,
          otherCostsMonthly: otherCosts,
          bufferSavings: Math.max(0, input.assets.savings - (plan ? Math.max(0, plan.ownFundsAvailable - plan.ownFundsLeft) : 0)),
          childrenUnder18: input.household.childrenUnder18,
          capacity: (apps) => capacityOf(apps).maxLoan,
          saleCostsPct: norms.costs.makelaarCourtagePct,
        })
      : []

  // --------------------------------------------------------------------- banken
  const isEntrepreneur = applicants.some((a) => a.isEntrepreneur)
  const lenders = compareLenders({
    norms,
    lenders: ctx.lenders,
    rates: ctx.rates,
    applicants: applicants.map((a, i) => ({
      id: a.id,
      label: a.label,
      employeeItems: a.employeeIncome,
      businesses: input.applicants[i]!.businesses,
      reachedAow: a.reachedAow,
      monthsUntilAow: a.monthsUntilAow,
      retirementIncome: a.retirementIncome,
    })),
    loanAmount,
    marketValue: marketValue ?? 0,
    nhg: nhgApplied,
    interestOnlyAmount,
    fixedYears,
    repayment: repaymentType === "linear" ? "linear" : "annuity",
    energyLabel,
    isEntrepreneur,
    needs: {
      bridgeMonths: input.move?.order === "buy_first" && mover ? input.move.bridgeMonths : 0,
      restschuld: mover?.restschuld ?? 0,
      consumptiveRelease: !!release && ["consumption", "gift_children", "pension"].includes(release.purpose),
      businessRelease: release?.purpose === "business",
      porting: !!mover && mover.portedParts.length > 0,
    },
    capacityWith: (apps, r) => capacityOf(apps, r).maxLoan,
    collateralWith: (ltv) =>
      marketValue !== null
        ? collateralCapacity({ norms, marketValue, energySavingAmount: energySaving, lenderMaxLtvPct: ltv }).maxLoan
        : Number.POSITIVE_INFINITY,
    project: projectFor,
  })

  // --------------------------------------------------------------------- eigen geld
  let equity: EquityOptimization | null = null
  if (plan && input.assets.savings > 0) {
    equity = optimizeEquity({
      norms,
      savings: input.assets.savings,
      investments: input.assets.investments,
      desiredBuffer: input.assets.desiredBuffer,
      requiredMortgage: plan.requiredMortgage + ownFundsAvailable(input.assets),
      maxMortgage: plan.maxMortgage,
      marketValue: plan.marketValue,
      persons,
      rateFor: (ltvPct) =>
        medianRate(ctx.rates, ctx.lenders, { fixedYears, ltvPct, nhg: nhgApplied && ltvPct <= 100, energyLabel }) ?? rate,
      project: projectFor,
    })
  }

  // --------------------------------------------------------------------- overwaarde-opties
  let equityRelease: AdviceOutput["equityRelease"] = null
  if (current && ["verhogen", "oversluiten", "orientatie", "verkopen"].includes(input.goal) && !target) {
    const r = equityReleaseOptions({
      norms,
      marketValue: current.marketValue,
      woz: current.wozValue,
      currentDebt,
      loanParts: current.loanParts,
      incomeRoom: Math.max(0, incomeCap.maxLoan - currentDebt),
      collateralRoom: Math.max(0, (collateral?.maxLoan ?? 0) - currentDebt),
      ratePct: rate,
      taxableIncome: highest.taxable,
      savingsAboveBuffer: Math.max(0, input.assets.savings - input.assets.desiredBuffer),
      persons,
      children: input.household.children,
      oldestAge: Math.max(...applicants.map((a) => a.age)),
      calculationDate: date,
      fixedYears,
      requestedAmount: release?.amount ?? 0,
      lendersAllowingConsumptive: ctx.lenders.filter((l) => l.active && l.allowsConsumptiveRelease === true).map((l) => l.name),
      lendersAllowingBusiness: ctx.lenders.filter((l) => l.active && l.allowsBusinessRelease === true).map((l) => l.name),
      isEntrepreneur,
    })
    equityRelease = { room: r.room, options: r.options }
    refinance = refinance ?? r.refinance
  }

  // --------------------------------------------------------------------- ondernemers
  let entrepreneur: EntrepreneurChapter | null = null
  if (isEntrepreneur) {
    const replaceIncome = (apps: CapacityApplicant[], id: string, income: number) =>
      apps.map((a) => (a.id === id ? { ...a, toetsinkomen: income } : a))
    entrepreneur = entrepreneurChapter({
      norms,
      applicants: input.applicants.map((a, i) => ({ ...a, label: applicants[i]!.label, taxableIncome: applicants[i]!.taxable })),
      lenders: ctx.lenders,
      lenderRows: lenders.rows,
      calculationDate: date,
      loanAmount,
      ratePct: rate,
      shortfall,
      maritalStatus: input.household.maritalStatus,
      prenup: input.household.prenup,
      confirmedDocTypes: input.confirmedDocTypes ?? [],
      showHomeInBv: !!input.flags?.showHomeInBv,
      purchasePrice: target?.purchasePrice ?? propertyValue,
      lenderCapacity: (row, id, income) =>
        capacityOf(
          replaceIncome(
            row.applicantIncome.map((x, i) => ({ ...baseApps[i]!, toetsinkomen: x.income })),
            id,
            income
          ),
          row.ratePct ?? rate
        ).maxLoan,
      defaultCapacity: (id, income) => capacityOf(replaceIncome(baseApps, id, income)).maxLoan,
      defaultIncome: (id) => applicants.find((a) => a.id === id)?.toetsinkomen ?? 0,
    })
  }

  // --------------------------------------------------------------------- knoppen om aan te draaien
  const levers: Lever[] = []
  const base = incomeCap.maxLoan
  const labelRank = ["G", "F", "E", "D", "C", "B", "A", "A+", "A++", "A+++", "A++++", "A++++EPG"]
  if (energyLabel === "geen" || labelRank.indexOf(energyLabel) < labelRank.indexOf("A")) {
    const alt = capacityOf(baseApps, rate, { energyLabel: "A" }).maxLoan - base
    if (alt > 0) levers.push({ key: "energielabel", label: "Energielabel A", extraLoan: alt, explanation: "Met energielabel A krijg je extra leenruimte buiten de inkomensnorm." })
  }
  const credits = input.obligations.filter((o) => (o.type === "revolving_credit" || o.type === "personal_loan") && !o.willBeRepaid)
  if (credits.length > 0) {
    const alt = capacityOf(baseApps, rate, { obligations: input.obligations.filter((o) => !credits.includes(o)) }).maxLoan - base
    if (alt > 0) levers.push({ key: "kredieten", label: "Kredieten aflossen en opzeggen", extraLoan: alt, explanation: "Elke euro kredietlimiet telt voor 2% per maand mee als last, ook als je hem niet gebruikt." })
  }
  const studie = input.obligations.filter((o) => o.type === "student_loan" && !o.willBeRepaid)
  if (studie.length > 0) {
    const alt = capacityOf(baseApps, rate, { obligations: input.obligations.filter((o) => !studie.includes(o)) }).maxLoan - base
    if (alt > 0) levers.push({ key: "studieschuld", label: "Studieschuld (extra) aflossen", extraLoan: alt, explanation: "Een lager DUO-termijnbedrag verhoogt je leenruimte; aflossen op de studieschuld kan lonen." })
  }
  if (fixedYears < norms.trhk.toetsrenteMinFixedYears && rate < norms.trhk.toetsrenteAfmPct) {
    const alt = capacityOf(baseApps, rate, { fixedYears: norms.trhk.toetsrenteMinFixedYears }).maxLoan - base
    if (alt > 0) levers.push({ key: "rentevast", label: "Minimaal 10 jaar rentevast", extraLoan: alt, explanation: "Bij 10 jaar of langer rentevast wordt getoetst op de werkelijke rente in plaats van de AFM-toetsrente." })
  }
  if (persons === 1) {
    levers.push({ key: "partner", label: "Samen kopen", extraLoan: 0, explanation: "Het inkomen van een partner telt voor 100% mee in de toets." })
  }

  // --------------------------------------------------------------------- controles
  const partialAssumptions = collectNormKeys({ trace: tracer.list(), plan, stress, lenders, equity, equityRelease, entrepreneur, mover })
  const staleRates = lenders.top3.filter((r) => r.rateDate && monthsBetween(parseDate(r.rateDate), parseDate(date)) >= 0 && daysBetween(r.rateDate, date) > 14).length
  const checks = buildChecks({
    loanAmount,
    maxIncome: incomeCap.maxLoan,
    maxCollateral: collateral?.maxLoan ?? null,
    shortfall,
    costsFromOwnFunds: plan?.costsFromOwnFunds ?? null,
    nhg: nhg ? { wanted: nhgWanted, eligible: nhg.eligible, reason: nhg.reason } : null,
    newInterestOnly: interestOnlyAmount,
    box3Part: plan?.box3Part ?? 0,
    aowDecisive: incomeCap.decisive === "aow",
    starterExempt: plan ? plan.costs.transferTax.starterExemptShare > 0 : null,
    budgetLight: budget?.light ?? null,
    stressReds: stress.filter((s) => s.light === "red").length,
    stressOranges: stress.filter((s) => s.light === "orange").length,
    lendersFitting: lenders.rows.filter((r) => r.accepted !== false && r.fits && r.ratePct !== null).length,
    documentChecks: input.documentChecks ?? [],
    unverifiedNorms: [...partialAssumptions].filter((k) => ctx.norms.meta[k]?.status === "needs_verification").length,
    staleRates,
    entrepreneurWarnings: entrepreneur?.businesses.flatMap((b) => b.warnings) ?? [],
    excessiveBorrowingExcess: entrepreneur?.businesses.reduce((s, b) => s + (b.excessive?.excess ?? 0), 0) ?? 0,
  })
  const allKeys = collectNormKeys({ trace: tracer.list(), plan, stress, lenders, equity, equityRelease, entrepreneur, mover, checks })
  const assumptions = [...allKeys]
    .map((k) => ctx.norms.meta[k])
    .filter((m): m is NormMeta => !!m)
    .sort((a, b) => a.key.localeCompare(b.key))

  return {
    engineVersion: ENGINE_VERSION,
    normSetVersion: ctx.norms.version,
    normYear: ctx.norms.year,
    calculationDate: date,
    goal: input.goal,
    applicants,
    capacity: { income: incomeCap, collateral, maxMortgage: Number.isFinite(maxMortgage) ? maxMortgage : incomeCap.maxLoan, limiting, levers },
    purchase: plan,
    mover,
    refinance,
    loan: {
      amount: loanAmount,
      requested,
      shortfall,
      parts,
      ratePct: rate,
      fixedYears,
      nhg,
      nhgApplied,
      interestOnlyAmount,
      years: projection.years,
      grossMonthlyYear1: projection.firstMonthGross,
      netMonthlyYear1: y1?.netMonthly ?? 0,
      avgNetMonthlyFixed: averageNetMonthly(projection, fixedYears),
      totalInterest30: projection.totalInterest,
      propertyValue,
    },
    prudent,
    budget,
    stress,
    lenders,
    equity,
    equityRelease,
    entrepreneur,
    checks,
    summary: {
      maxMortgage: Number.isFinite(maxMortgage) ? maxMortgage : incomeCap.maxLoan,
      prudentLoan,
      loanAmount,
      grossMonthly: projection.firstMonthGross,
      netMonthly: y1?.netMonthly ?? 0,
      shortfall,
      nhg: nhgApplied,
      ratePct: rate,
      limiting,
      redChecks: checks.filter((c) => c.status === "red").length,
    },
    assumptions,
    trace: tracer.list(),
    warnings,
  }
}

function daysBetween(a: string, b: string): number {
  const da = parseDate(a)
  const db = parseDate(b)
  return Math.round((Date.UTC(db.y, db.m - 1, db.d) - Date.UTC(da.y, da.m - 1, da.d)) / 86_400_000)
}

/** Verzamel alle normsleutels (velden `normKeys` en `normKey`) uit een uitkomst. */
export function collectNormKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectNormKeys(v, into)
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (k === "normKeys" && Array.isArray(v)) {
        for (const s of v) {
          if (typeof s === "string") into.add(s)
        }
      } else if (k === "normKey" && typeof v === "string") {
        into.add(v)
      } else {
        collectNormKeys(v, into)
      }
    }
  }
  return into
}
