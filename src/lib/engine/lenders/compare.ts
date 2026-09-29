import { applicantBusinessIncome, withDefaults, type BusinessIncome } from "../entrepreneur"
import type { BusinessInput } from "../entrepreneur/types"
import type { IncomeAssessment } from "../income/employee"
import type { CapacityApplicant } from "../capacity/income-capacity"
import { averageNetMonthly, interestOverYears, type Projection } from "../loan/schedule"
import type { EnergyLabel, NormValues } from "../norms"
import { lookupRate } from "./rates"
import type { LenderProfile, RateRow, RepaymentKind, Tri } from "./types"

/**
 * Bankadvies: per geldverstrekker acceptatie (met reden), toetsinkomen, maximale leenruimte,
 * rente, netto maandlast (jaar 1 en gemiddeld over de rentevaste periode), totale kosten over de
 * rentevaste periode en flexibiliteit. Rangschikking: eerst geaccepteerd en passend, dan op
 * totale kosten.
 */

export interface LenderApplicantInput {
  id: string
  label: string
  employeeItems: IncomeAssessment[]
  businesses: BusinessInput[]
  reachedAow: boolean
  monthsUntilAow: number
  retirementIncome: number
}

export interface LenderNeeds {
  bridgeMonths: number
  restschuld: number
  consumptiveRelease: boolean
  businessRelease: boolean
  porting: boolean
}

export interface LenderRow {
  slug: string
  name: string
  active: boolean
  accepted: Tri
  reasons: string[]
  toetsinkomen: number
  applicantIncome: { id: string; label: string; income: number; business: BusinessIncome[] }[]
  maxLoanIncome: number
  maxLoanCollateral: number
  maxLoan: number
  fits: boolean
  ratePct: number | null
  rateDate: string | null
  rateStatus: string | null
  rateSourceUrl: string | null
  rateNotes: string[]
  energyDiscountPct: number
  grossMonthlyYear1: number | null
  netMonthlyYear1: number | null
  avgNetMonthlyFixed: number | null
  interestFixedPeriod: number | null
  closingCosts: number
  totalCostsFixedPeriod: number | null
  flexibility: { score: number; items: string[] }
  rank: number
}

export interface LenderComparison {
  rows: LenderRow[]
  top3: LenderRow[]
  explanation: string
}

function flexibility(l: LenderProfile): { score: number; items: string[] } {
  const items: string[] = []
  let score = 0
  if (l.meeneemregeling) {
    score += 1
    items.push("meeneemregeling")
  }
  if (l.verhuisregeling) {
    score += 1
    items.push("verhuisregeling")
  }
  if ((l.penaltyFreeRepaymentPct ?? 0) >= 20) {
    score += 1
    items.push(`${l.penaltyFreeRepaymentPct}% boetevrij aflossen`)
  } else if ((l.penaltyFreeRepaymentPct ?? 0) >= 10) {
    score += 0.5
    items.push(`${l.penaltyFreeRepaymentPct}% boetevrij aflossen`)
  }
  if (l.rentemiddeling) {
    score += 1
    items.push("rentemiddeling")
  }
  if (l.bouwdepot) {
    score += 1
    items.push("bouwdepot")
  }
  return { score, items }
}

const REQUIRE_FLAG: Record<NonNullable<IncomeAssessment["requires"]>, keyof LenderProfile["accepts"]> = {
  acceptsIntentieverklaring: "intentieverklaring",
  acceptsFlexIBL: "flexIBL",
  acceptsPerspectiefverklaring: "perspectiefverklaring",
  acceptsBenefits: "benefits",
  acceptsPension: "pension",
}

export function compareLenders(params: {
  norms: NormValues
  lenders: LenderProfile[]
  rates: RateRow[]
  applicants: LenderApplicantInput[]
  loanAmount: number
  marketValue: number
  nhg: boolean
  interestOnlyAmount: number
  fixedYears: number
  repayment: RepaymentKind
  energyLabel: EnergyLabel
  isEntrepreneur: boolean
  needs: LenderNeeds
  capacityWith: (apps: CapacityApplicant[], ratePct: number) => number
  collateralWith: (maxLtvPct: number) => number
  project: (loan: number, ratePct: number) => Projection
}): LenderComparison {
  const rows: LenderRow[] = params.lenders.map((l) => {
    const reasons: string[] = []
    let accepted = true as Tri
    const reject = (reason: string) => {
      accepted = false
      reasons.push(reason)
    }
    const unsure = (reason: string) => {
      if (accepted === true) accepted = null
      reasons.push(reason)
    }
    if (!l.active) reject(l.activeNote ?? "Deze geldverstrekker biedt geen nieuwe hypotheken meer aan.")

    const policy = withDefaults(l.entrepreneur)
    const applicantIncome = params.applicants.map((a) => {
      let income = 0
      for (const item of a.employeeItems) {
        if (item.amount <= 0) continue
        if (item.requires) {
          const flag = l.accepts[REQUIRE_FLAG[item.requires]]
          if (flag === false) {
            reasons.push(`${a.label}: ${item.reason.split(":")[0]} wordt door deze bank niet geaccepteerd.`)
            continue
          }
          if (flag === null) unsure(`${a.label}: onbekend of deze bank dit inkomen accepteert (${item.kind}).`)
        }
        income += item.amount
      }
      const biz = applicantBusinessIncome(a.businesses, policy, params.norms)
      if (a.businesses.length > 0) {
        if (biz.accepted === false) reasons.push(`${a.label}: ondernemersinkomen telt niet mee bij deze bank.`)
        else if (biz.accepted === null) unsure(`${a.label}: ondernemersinkomen onder voorbehoud (zie toelichting).`)
        for (const item of biz.items) reasons.push(...item.explanation.map((e) => `${a.label}: ${e}`))
      }
      income += biz.accepted === false ? 0 : biz.total
      return { id: a.id, label: a.label, income, business: biz.items }
    })
    const toetsinkomen = applicantIncome.reduce((s, a) => s + a.income, 0)
    if (toetsinkomen <= 0) reject("Er telt geen inkomen mee bij deze bank.")

    const ltvPct = params.marketValue > 0 ? (params.loanAmount / params.marketValue) * 100 : 0
    const maxLtv = Math.min(l.maxLtvPct ?? 100, params.isEntrepreneur ? (l.entrepreneur.maxLtvPct ?? 100) : 100)
    if (ltvPct > maxLtv + 0.01 && params.marketValue > 0) reject(`De lening is ${ltvPct.toFixed(0)}% van de woningwaarde; deze bank gaat tot ${maxLtv}%.`)
    const ioPct = params.marketValue > 0 ? (params.interestOnlyAmount / params.marketValue) * 100 : 0
    const maxIo = Math.min(
      l.maxInterestOnlyPctOfValue ?? 50,
      params.isEntrepreneur ? (l.entrepreneur.maxInterestOnlyPct ?? 100) : 100
    )
    if (ioPct > maxIo + 0.01) reject(`Het aflossingsvrije deel (${ioPct.toFixed(0)}%) is hoger dan het maximum van ${maxIo}% bij deze bank.`)
    if (params.needs.restschuld > 0 && l.restschuldFinancing === false) reject("Deze bank financiert geen restschuld mee.")
    if (params.needs.bridgeMonths > 0 && l.bridgeLoanMaxMonths !== null && params.needs.bridgeMonths > l.bridgeLoanMaxMonths) {
      reject(`Overbrugging van ${params.needs.bridgeMonths} maanden; deze bank gaat tot ${l.bridgeLoanMaxMonths} maanden.`)
    }
    if (params.needs.consumptiveRelease) {
      if (l.allowsConsumptiveRelease === false) reject("Deze bank staat vrij opnemen van overwaarde niet toe.")
      else if (l.allowsConsumptiveRelease === null) unsure("Onbekend of deze bank vrij opnemen van overwaarde toestaat.")
    }
    if (params.needs.businessRelease) {
      if (l.allowsBusinessRelease === false) reject("Deze bank staat verhogen voor zakelijke doeleinden niet toe.")
      else if (l.allowsBusinessRelease === null) unsure("Onbekend of deze bank verhogen voor zakelijke doeleinden toestaat.")
    }
    if (params.needs.porting && l.meeneemregeling === false) {
      reasons.push("Let op: meenemen van je huidige leningdelen kan alleen bij je huidige bank.")
    }

    const rate = lookupRate(params.rates, l, {
      fixedYears: params.fixedYears,
      ltvPct,
      nhg: params.nhg,
      repayment: params.repayment,
      energyLabel: params.energyLabel,
    })
    if (!rate) unsure("Geen actuele rente bekend voor deze combinatie.")

    const capacityApps: CapacityApplicant[] = params.applicants.map((a, i) => ({
      id: a.id,
      toetsinkomen: applicantIncome[i]!.income,
      reachedAow: a.reachedAow,
      monthsUntilAow: a.monthsUntilAow,
      retirementIncome: a.retirementIncome,
    }))
    const maxLoanIncome = rate && toetsinkomen > 0 ? params.capacityWith(capacityApps, rate.ratePct) : 0
    const maxLoanCollateral = params.marketValue > 0 ? params.collateralWith(maxLtv) : Infinity
    const maxLoan = Math.min(maxLoanIncome, maxLoanCollateral)
    const fits = maxLoan >= params.loanAmount - 1
    if (!fits && accepted !== false) reasons.push("De gewenste hypotheek is hoger dan de maximale leenruimte bij deze bank.")

    let grossMonthlyYear1: number | null = null
    let netMonthlyYear1: number | null = null
    let avgNet: number | null = null
    let interestFixed: number | null = null
    if (rate && params.loanAmount > 0) {
      const proj = params.project(params.loanAmount, rate.ratePct)
      grossMonthlyYear1 = proj.years[0]?.grossMonthly ?? null
      netMonthlyYear1 = proj.years[0]?.netMonthly ?? null
      avgNet = averageNetMonthly(proj, params.fixedYears)
      interestFixed = interestOverYears(proj, params.fixedYears)
    }
    const closingCosts = l.closingCostsEur ?? 0
    return {
      slug: l.slug,
      name: l.name,
      active: l.active,
      accepted,
      reasons,
      toetsinkomen,
      applicantIncome,
      maxLoanIncome,
      maxLoanCollateral: Number.isFinite(maxLoanCollateral) ? maxLoanCollateral : 0,
      maxLoan: Number.isFinite(maxLoan) ? maxLoan : maxLoanIncome,
      fits,
      ratePct: rate?.ratePct ?? null,
      rateDate: rate?.row.rateDate ?? null,
      rateStatus: rate?.row.status ?? null,
      rateSourceUrl: rate?.row.sourceUrl ?? null,
      rateNotes: rate?.notes ?? [],
      energyDiscountPct: rate?.energyDiscountPct ?? 0,
      grossMonthlyYear1,
      netMonthlyYear1,
      avgNetMonthlyFixed: avgNet,
      interestFixedPeriod: interestFixed,
      closingCosts,
      totalCostsFixedPeriod: interestFixed !== null ? interestFixed + closingCosts : null,
      flexibility: flexibility(l),
      rank: 0,
    }
  })

  const group = (r: LenderRow) =>
    r.accepted === true && r.fits ? 0 : r.accepted === null && r.fits ? 1 : r.accepted !== false ? 2 : 3
  rows.sort((a, b) => {
    const g = group(a) - group(b)
    if (g !== 0) return g
    const ca = a.totalCostsFixedPeriod ?? Infinity
    const cb = b.totalCostsFixedPeriod ?? Infinity
    if (ca !== cb) return ca - cb
    return b.flexibility.score - a.flexibility.score
  })
  rows.forEach((r, i) => (r.rank = i + 1))
  const top3 = rows.filter((r) => r.accepted !== false && r.fits && r.ratePct !== null).slice(0, 3)
  return {
    rows,
    top3,
    explanation:
      "Banken die je profiel accepteren en waar de hypotheek past, staan bovenaan. Daarbinnen is gesorteerd op de totale kosten over de rentevaste periode (rente + afsluitkosten), daarna op flexibiliteit.",
  }
}
