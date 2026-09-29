import { seedNormSet } from "@/lib/norms"
import { SEED_LENDERS, SEED_RATES } from "@/lib/lenders"
import type { EngineContext } from "../advice"
import type { Applicant, EmploymentIncome, EngineInput, TargetProperty } from "../types"

export const norms2026 = seedNormSet(2026)
export const norms2025 = seedNormSet(2025)
export const N = norms2026.values
export const ctx: EngineContext = { norms: norms2026, lenders: SEED_LENDERS, rates: SEED_RATES }

export const CALC_DATE = "2026-09-29"

export function salary(gross: number, over: Partial<EmploymentIncome> = {}): EmploymentIncome {
  return {
    kind: "employment",
    contract: "permanent",
    grossAnnualSalary: gross,
    holidayPay: 0,
    thirteenthMonth: 0,
    fixedYearEndBonus: 0,
    irregularityAllowance: 0,
    commission: 0,
    ...over,
  }
}

export function applicant(over: Partial<Applicant> = {}): Applicant {
  return {
    id: "a1",
    dateOfBirth: "1996-05-01",
    incomes: [salary(50000)],
    businesses: [],
    previousHomeOwner: false,
    usedStartersExemption: false,
    alimonyPaidAnnual: 0,
    ...over,
  }
}

export function property(over: Partial<TargetProperty> = {}): TargetProperty {
  return {
    purchasePrice: 350000,
    kind: "existing",
    extraWork: 0,
    energyLabel: "C",
    erfpachtCanonAnnual: 0,
    renovationAmount: 0,
    energySavingAmount: 0,
    hoaMonthly: 0,
    ownOccupation: true,
    useBuyersAgent: false,
    useBuildingInspection: false,
    ...over,
  }
}

export function baseInput(over: Partial<EngineInput> = {}): EngineInput {
  return {
    calculationDate: CALC_DATE,
    goal: "starter",
    applicants: [applicant()],
    household: { children: 0, childrenUnder18: 0, maritalStatus: "single", prenup: "none" },
    obligations: [],
    assets: {
      savings: 40000,
      investments: 0,
      giftAmount: 0,
      familyLoanAmount: 0,
      familyLoanRatePct: 0,
      eigenwoningreserve: 0,
      desiredBuffer: 10000,
    },
    targetProperty: property(),
    preferences: {
      fixedRateYears: 10,
      repaymentType: "annuity",
      interestOnlyPct: 0,
      nhg: "unknown",
      riskAppetite: "medium",
      goals: [],
    },
    referenceRatePct: 4.0,
    ...over,
  }
}
