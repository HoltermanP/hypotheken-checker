import type { EnergyLabel } from "../norms"
import type { LegalForm } from "../entrepreneur/types"

/** Onbekend = null. De engine behandelt onbekend als "niet uitgesloten, maar met voorbehoud". */
export type Tri = boolean | null

export type EntCalcMethod = "avg3_capped_by_last" | "avg3" | "last_year" | "weighted" | "ivo"
export type DgaTreatment = "salary_only" | "salary_plus_distributable_profit" | "ivo"
export type IvoPolicy = "required" | "accepted" | "not_accepted"

export interface LenderEntrepreneurPolicy {
  minYearsFigures: number | null
  acceptsForecastForStarters: Tri
  ivoPolicy: IvoPolicy | null
  calcMethod: EntCalcMethod | null
  acceptedLegalForms: LegalForm[] | null
  dgaTreatment: DgaTreatment | null
  minSolvencyPct: number | null
  minCurrentRatio: number | null
  countsManagementFee: Tri
  dgaThresholdPct: number | null
  allowsLoanNextToOwnBv: Tri
  guaranteesTreatment: string | null
  maxLtvPct: number | null
  maxInterestOnlyPct: number | null
}

export interface LenderProfile {
  slug: string
  name: string
  active: boolean
  activeNote?: string | null
  maxLtvPct: number | null
  maxInterestOnlyPctOfValue: number | null
  meeneemregeling: Tri
  verhuisregeling: Tri
  accepts: {
    permanentContract: Tri
    intentieverklaring: Tri
    flexIBL: Tri
    perspectiefverklaring: Tri
    benefits: Tri
    pension: Tri
  }
  entrepreneur: LenderEntrepreneurPolicy
  bridgeLoanMaxMonths: number | null
  restschuldFinancing: Tri
  penaltyFreeRepaymentPct: number | null
  rentemiddeling: Tri
  /** Rentekorting (procentpunt, positief = korting) per energielabel. */
  energyLabelDiscounts: Partial<Record<EnergyLabel, number>>
  /** Afwijkende korting bij een rentevaste periode langer dan 10 jaar. */
  energyLabelDiscountsAbove10y?: Partial<Record<EnergyLabel, number>>
  closingCostsEur: number | null
  bouwdepot: Tri
  /** Staat overwaarde vrij opnemen (consumptief) toe. */
  allowsConsumptiveRelease: Tri
  /** Staat verhogen voor zakelijke doeleinden toe. */
  allowsBusinessRelease: Tri
  /** Bron per veld. */
  sources: Record<string, { sourceUrl: string | null; status: "verified" | "needs_verification" | "unknown" }>
}

export type LtvClass = "nhg" | "ltv60" | "ltv70" | "ltv80" | "ltv90" | "ltv100"
export type RepaymentKind = "annuity" | "linear" | "interest_only"

export interface RateRow {
  lenderSlug: string
  fixedYears: number
  ltvClass: LtvClass
  repaymentType: RepaymentKind
  ratePct: number
  rateDate: string
  status: "verified" | "needs_verification" | "derived"
  sourceUrl?: string | null
}
