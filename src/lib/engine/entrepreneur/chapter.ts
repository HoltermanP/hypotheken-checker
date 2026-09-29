import { monthsBetween, parseDate } from "../age"
import type { LenderRow } from "../lenders/compare"
import type { LenderProfile } from "../lenders/types"
import type { NormValues } from "../norms"
import type { Applicant } from "../types"
import { dgaIncome, groupFigures, type DistributableTests } from "./dga"
import { businessIncome, withDefaults } from "./index"
import { continuityRisk, type RiskScore } from "./risk"
import {
  adjustBusinessForPayout,
  equityFromBv,
  excessiveBorrowing,
  homeInBv,
  mortgageAtOwnBv,
  salaryVsDividend,
  type EquityFromBvResult,
  type ExcessiveBorrowingResult,
  type HomeInBvResult,
  type OwnBvMortgageResult,
  type SalaryVsDividendResult,
} from "./scenarios"
import type { BusinessInput } from "./types"

/**
 * Ondernemershoofdstuk van het rapport: toetsinkomen per bank met rekenmethode, analyse van de
 * BV/holding, ondernemersscenario's en ontbrekende documenten voor een IVO.
 */

export const IVO_DOCUMENTS: Record<"ib" | "bv", { type: string; label: string }[]> = {
  ib: [
    { type: "kvk_uittreksel", label: "KvK-uittreksel" },
    { type: "jaarrekening", label: "Jaarcijfers van de laatste 3 jaar (balans en winst-en-verliesrekening)" },
    { type: "ib_aangifte", label: "IB-aangiften en definitieve aanslagen van de laatste 3 jaar" },
    { type: "tussentijdse_cijfers", label: "Tussentijdse cijfers en prognose lopend jaar" },
  ],
  bv: [
    { type: "kvk_uittreksel", label: "KvK-uittreksel (alle entiteiten)" },
    { type: "jaarrekening", label: "Jaarrekeningen van de laatste 3 jaar per entiteit en geconsolideerd" },
    { type: "vpb_aangifte", label: "Vpb-aangiften" },
    { type: "ib_aangifte", label: "IB-aangiften en definitieve aanslagen DGA" },
    { type: "aandeelhoudersregister", label: "Aandeelhoudersregister of oprichtingsakte" },
    { type: "organogram", label: "Organogram van de holdingstructuur" },
    { type: "jaaropgave_dga", label: "Loonstroken of jaaropgave DGA" },
    { type: "dividendbesluit", label: "Dividendbesluiten" },
    { type: "rekening_courant", label: "Rekening-courantoverzicht DGA ↔ BV" },
    { type: "tussentijdse_cijfers", label: "Tussentijdse cijfers en prognose lopend jaar" },
  ],
}

export interface BusinessChapter {
  businessId: string
  applicantId: string
  applicantLabel: string
  legalForm: BusinessInput["legalForm"]
  risk: RiskScore
  perLender: { slug: string; name: string; income: number; method: string; accepted: boolean | null; explanation: string[] }[]
  analysis: (DistributableTests & { consolidated: boolean; figuresYears: number[] }) | null
  salaryVsDividend: (SalaryVsDividendResult & { perLender: { slug: string; name: string; extraIncome: number; extraLoan: number }[] }) | null
  equityFromBv: EquityFromBvResult | null
  ownBvMortgage: OwnBvMortgageResult | null
  excessive: ExcessiveBorrowingResult | null
  timing: { nextFiguresDate: string; monthsAway: number; incomeNow: number; incomeWithNewYear: number; extraLoan: number; advice: string } | null
  homeInBv: HomeInBvResult | null
  missingDocuments: string[]
  warnings: string[]
}

export interface EntrepreneurChapter {
  businesses: BusinessChapter[]
  businessReleaseLenders: { allowed: string[]; unknown: string[] }
  advice: string[]
}

export function entrepreneurChapter(params: {
  norms: NormValues
  applicants: (Applicant & { label: string; taxableIncome: number })[]
  lenders: LenderProfile[]
  lenderRows: LenderRow[]
  calculationDate: string
  loanAmount: number
  ratePct: number
  shortfall: number
  maritalStatus: string
  prenup: string
  confirmedDocTypes: string[]
  showHomeInBv: boolean
  purchasePrice: number
  /** Maximale hypotheek bij de bank uit de rij, met een aangepast inkomen voor één aanvrager. */
  lenderCapacity: (row: LenderRow, applicantId: string, newIncome: number) => number
  /** Maximale hypotheek (standaardbeleid) bij een aangepast inkomen voor één aanvrager. */
  defaultCapacity: (applicantId: string, newIncome: number) => number
  defaultIncome: (applicantId: string) => number
}): EntrepreneurChapter {
  const { norms } = params
  const businesses: BusinessChapter[] = []
  for (const a of params.applicants) {
    for (const b of a.businesses) {
      const warnings: string[] = []
      const risk = continuityRisk(b, params.calculationDate)
      warnings.push(...risk.warnings)
      if (b.fluctuationExplanation === null || b.fluctuationExplanation === undefined) {
        if (risk.volatile) warnings.push("Licht de grote verschillen tussen de jaren toe (incidentele baten of lasten).")
      }
      const perLender = params.lenderRows
        .filter((r) => r.active)
        .map((r) => {
          const l = params.lenders.find((x) => x.slug === r.slug)!
          const inc = businessIncome(b, withDefaults(l.entrepreneur), norms)
          return { slug: r.slug, name: r.name, income: inc.income, method: inc.method, accepted: inc.accepted, explanation: [...inc.explanation, ...inc.warnings] }
        })
      let analysis: BusinessChapter["analysis"] = null
      let svd: BusinessChapter["salaryVsDividend"] = null
      let efb: EquityFromBvResult | null = null
      let own: OwnBvMortgageResult | null = null
      let exc: ExcessiveBorrowingResult | null = null
      let hib: HomeInBvResult | null = null
      const isBv = b.legalForm === "bv" || b.legalForm === "bv_holding"
      if (isBv && b.bv) {
        const def = dgaIncome(b, withDefaults(null), { gebruikelijkLoon: norms.ondernemer.gebruikelijkLoon })
        warnings.push(...def.warnings)
        const { figures, consolidated } = groupFigures(b)
        if (def.tests) analysis = { ...def.tests, consolidated, figuresYears: figures.map((f) => f.year) }
        const latest = figures[figures.length - 1] ?? null
        const delta = 10000
        const base = salaryVsDividend(norms, {
          delta,
          currentSalary: def.salary,
          otherBox2Income: 0,
          bvProfitBeforeTax: latest?.resultBeforeTax ?? 0,
        })
        const adjusted = adjustBusinessForPayout(b, "salary", delta, norms)
        svd = {
          ...base,
          perLender: params.lenderRows
            .filter((r) => r.active && r.ratePct !== null)
            .map((r) => {
              const l = params.lenders.find((x) => x.slug === r.slug)!
              const policy = withDefaults(l.entrepreneur)
              const before = businessIncome(b, policy, norms).income
              const after = businessIncome(adjusted, policy, norms).income
              const current = r.applicantIncome.find((x) => x.id === a.id)?.income ?? 0
              const extraIncome = after - before
              const extraLoan = Math.max(
                0,
                params.lenderCapacity(r, a.id, current + extraIncome) - params.lenderCapacity(r, a.id, current)
              )
              return { slug: r.slug, name: r.name, extraIncome, extraLoan }
            }),
        }
        const need = Math.max(params.shortfall, 25000)
        efb = equityFromBv(norms, {
          amountNeeded: need,
          latest,
          existingLoans: b.bv.loansToDga,
          loanRatePct: params.ratePct,
          taxableIncome: a.taxableIncome,
          forOwnHomeWithMortgageRight: true,
        })
        own = mortgageAtOwnBv(norms, {
          loanAmount: params.loanAmount,
          bankRatePct: params.ratePct,
          bvRatePct: params.ratePct,
          taxableIncome: a.taxableIncome,
          bvProfit: latest?.resultBeforeTax ?? 0,
          existingLoans: b.bv.loansToDga,
          mortgageRight: true,
          otherBox2Income: 0,
        })
        exc = excessiveBorrowing(norms, b.bv.loansToDga)
        if (b.bv.currentAccountDga > 0) {
          warnings.push("Je hebt een rekening-courantschuld aan je BV; die telt mee voor de Wet excessief lenen.")
          exc = excessiveBorrowing(norms, [
            ...b.bv.loansToDga,
            { id: "rc", amount: b.bv.currentAccountDga, purpose: "overig", mortgageRight: false, existedBefore2023: false, ratePct: 0 },
          ])
        }
        if (params.showHomeInBv) {
          hib = homeInBv(norms, { price: params.purchasePrice, loan: params.loanAmount, ratePct: params.ratePct, taxableIncome: a.taxableIncome })
        }
      }

      // Timing: wachten op de volgende jaarcijfers?
      let timing: BusinessChapter["timing"] = null
      if (b.nextFiguresDate && b.expectedCurrentYearProfit !== null && b.expectedCurrentYearProfit !== undefined) {
        const monthsAway = monthsBetween(parseDate(params.calculationDate), parseDate(b.nextFiguresDate))
        if (monthsAway >= 0 && monthsAway <= 12) {
          const incomeNow = params.defaultIncome(a.id)
          const withYear = withExtraYear(b, b.expectedCurrentYearProfit)
          const bizNow = businessIncome(b, withDefaults(null), norms).income
          const bizNext = businessIncome(withYear, withDefaults(null), norms).income
          const incomeWithNewYear = incomeNow - bizNow + bizNext
          const extraLoan = params.defaultCapacity(a.id, incomeWithNewYear) - params.defaultCapacity(a.id, incomeNow)
          timing = {
            nextFiguresDate: b.nextFiguresDate,
            monthsAway,
            incomeNow,
            incomeWithNewYear,
            extraLoan,
            advice:
              extraLoan > 0
                ? "Met de nieuwe jaarcijfers stijgt je leenruimte. Als je niet haast hebt, kan wachten lonen."
                : "De nieuwe jaarcijfers verhogen je leenruimte niet; wachten levert niets op.",
          }
        }
      }

      const docs = IVO_DOCUMENTS[isBv ? "bv" : "ib"]
      const missingDocuments = docs.filter((d) => !params.confirmedDocTypes.includes(d.type)).map((d) => d.label)
      businesses.push({
        businessId: b.id,
        applicantId: a.id,
        applicantLabel: a.label,
        legalForm: b.legalForm,
        risk,
        perLender,
        analysis,
        salaryVsDividend: svd,
        equityFromBv: efb,
        ownBvMortgage: own,
        excessive: exc,
        timing,
        homeInBv: hib,
        missingDocuments,
        warnings,
      })
    }
  }

  const allowed = params.lenders.filter((l) => l.active && l.allowsBusinessRelease === true).map((l) => l.name)
  const unknown = params.lenders.filter((l) => l.active && l.allowsBusinessRelease === null).map((l) => l.name)
  const hasSole = params.applicants.some((a) => a.businesses.some((b) => !b.bv))
  const hasAov = params.applicants.every((a) => a.businesses.every((b) => b.aov.has || b.broodfonds))
  const advice: string[] = []
  if (!hasAov) advice.push("Je hebt als ondernemer geen WW en meestal geen WIA. Overweeg een AOV of een broodfonds.")
  advice.push("Een overlijdensrisicoverzekering beschermt je partner tegen een te hoge hypotheeklast.")
  if (hasSole) {
    advice.push(
      "Met een eenmanszaak of vof ben je privé aansprakelijk voor zakelijke schulden. Scheid risico's, bijvoorbeeld met een BV of huwelijkse voorwaarden."
    )
  }
  if (params.applicants.some((a) => a.businesses.some((b) => b.guarantees.length > 0))) {
    advice.push("Je hebt privé-borgstellingen voor zakelijke kredieten. Banken kunnen die als verplichting meewegen.")
  }
  if (params.maritalStatus === "married" && params.prenup === "none") {
    advice.push("Je bent in gemeenschap van goederen getrouwd; zakelijke schulden kunnen dan ook je partner raken.")
  }
  return { businesses, businessReleaseLenders: { allowed, unknown }, advice }
}

function withExtraYear(b: BusinessInput, expected: number): BusinessInput {
  if (b.soleProp) {
    const years = b.soleProp.years.filter((y) => !y.isForecast)
    const lastYear = Math.max(...years.map((y) => y.year), parseDate(b.startDate).y)
    return {
      ...b,
      soleProp: {
        ...b.soleProp,
        years: [
          ...years,
          {
            year: lastYear + 1,
            revenue: 0,
            profit: expected,
            depreciation: 0,
            investments: 0,
            privateWithdrawals: 0,
            incidentalGains: 0,
            incidentalLosses: 0,
            forDecrease: 0,
            hoursCriterionMet: true,
          },
        ],
      },
    }
  }
  if (b.bv) {
    const { figures } = groupFigures(b)
    const last = figures[figures.length - 1]
    if (!last) return b
    const next = { ...last, year: last.year + 1, resultAfterTax: expected }
    return { ...b, bv: { ...b.bv, consolidated: [...figures, next] } }
  }
  return b
}
