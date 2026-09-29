import type {
  AssetsStep,
  BusinessForm,
  CurrentHomeStep,
  EntrepreneurStep,
  IncomeItem,
  IncomeStep,
  IntakeData,
  ObligationsStep,
  PersonalStep,
  PreferencesStep,
  RisksStep,
  TargetHomeStep,
} from "./schema"
import { z } from "zod"
import { bvYear } from "./schema"

/** Startwaarden voor elke stap (als er nog niets is opgeslagen). */

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)

export function defaultPersonal(): PersonalStep {
  return {
    hasPartner: false,
    applicants: [{ firstName: "", dateOfBirth: "", previousHomeOwner: false, usedStartersExemption: false, yearsWorked: null }],
    maritalStatus: "single",
    prenup: "none",
    children: 0,
    childrenUnder18: 0,
  }
}

export function defaultEmployment(): IncomeItem {
  return {
    id: newId(),
    kind: "employment",
    employer: "",
    contract: "permanent",
    grossAnnualSalary: 0,
    holidayPay: 0,
    thirteenthMonth: 0,
    fixedYearEndBonus: 0,
    irregularityAllowance: 0,
    commission: 0,
    iblToetsinkomen: null,
  }
}

export function defaultIncome(count: number): IncomeStep {
  return {
    applicants: Array.from({ length: count }, () => ({
      incomes: [defaultEmployment()],
      isEntrepreneur: false,
      expectedRetirementIncome: null,
      alimonyPaidAnnual: 0,
    })),
  }
}

type BvYearForm = z.infer<typeof bvYear>

export function emptyBvYear(year: number): BvYearForm {
  return {
    year,
    revenue: 0,
    resultBeforeTax: 0,
    corporateTax: 0,
    resultAfterTax: 0,
    dividendPaid: 0,
    retainedEarnings: 0,
    equity: 0,
    balanceTotal: 0,
    liquidAssets: 0,
    currentAssets: 0,
    currentLiabilities: 0,
    longTermLiabilities: 0,
    managementFeeReceived: 0,
    managementFeePaid: 0,
    dgaSalaryPaid: 0,
    intercompanyReceivables: 0,
    intercompanyPayables: 0,
    resultFromParticipations: 0,
    participationsValue: 0,
  }
}

export function lastYears(calcYear: number, n = 3): number[] {
  return Array.from({ length: n }, (_, i) => calcYear - n + i)
}

export function defaultBusiness(calcYear: number): BusinessForm {
  const years = lastYears(calcYear)
  return {
    id: newId(),
    name: "",
    kvkNumber: "",
    legalForm: "eenmanszaak",
    startDate: "",
    sector: "zakelijke_dienstverlening",
    profitSharePct: 100,
    largestClientPct: 0,
    orderBookMonths: null,
    aovHas: false,
    aovMonthlyBenefit: 0,
    broodfonds: false,
    annuityPremiumAnnual: 0,
    businessDebts: 0,
    guarantees: [],
    ivoIncome: null,
    nextFiguresDate: "",
    expectedCurrentYearProfit: null,
    fluctuationExplanation: "",
    soleProp: {
      years: years.map((year) => ({
        year,
        revenue: 0,
        profit: 0,
        depreciation: 0,
        investments: 0,
        privateWithdrawals: 0,
        incidentalGains: 0,
        incidentalLosses: 0,
        forDecrease: 0,
        hoursCriterionMet: true,
      })),
      forBalance: 0,
      forecastProfit: null,
    },
    bv: {
      shareholdingPct: 100,
      statutoryDirector: true,
      salaries: years.map((year) => ({ year, amount: 0 })),
      carBenefit: 0,
      pensionAccrual: 0,
      fiscalUnity: false,
      currentAccountDga: 0,
      issuedCapital: 0,
      managementFee: { annual: 0, contractual: false, structural: false, armsLength: false },
      entities: [{ key: newId(), name: "Werkmaatschappij", role: "werkmaatschappij", parentKey: null, ownershipPct: 100, financials: years.map(emptyBvYear) }],
      loansToDga: [],
    },
  }
}

export function defaultEntrepreneur(intake: IntakeData, calcYear: number): EntrepreneurStep {
  const apps = intake.inkomen?.applicants ?? [{ isEntrepreneur: true }]
  return { applicants: apps.map((a) => ({ businesses: a.isEntrepreneur ? [defaultBusiness(calcYear)] : [] })) }
}

export function defaultObligations(): ObligationsStep {
  return { obligations: [], bkrRegistrations: "" }
}

export function defaultAssets(): AssetsStep {
  return {
    savings: 0,
    investments: 0,
    giftAmount: 0,
    familyLoanAmount: 0,
    familyLoanRatePct: 0,
    eigenwoningreserve: 0,
    desiredBuffer: 5000,
    ownFundsToContribute: null,
  }
}

export function defaultCurrentHome(): CurrentHomeStep {
  return {
    wozValue: 0,
    marketValue: 0,
    expectedSalePrice: 0,
    energyLabel: "C",
    erfpachtCanonAnnual: 0,
    loanParts: [],
    expectedSaleDate: "",
    brokerFeePct: null,
    moveOrder: "sell_first",
    bridgeMonths: 6,
    temporaryHousingMonthly: 0,
    temporaryHousingMonths: 0,
  }
}

export function defaultTargetHome(): TargetHomeStep {
  return {
    purchasePrice: 0,
    marketValue: null,
    wozValue: null,
    kind: "existing",
    propertyType: "tussenwoning",
    extraWork: 0,
    constructionMonths: null,
    energyLabel: "C",
    erfpachtCanonAnnual: 0,
    renovationAmount: 0,
    energySavingAmount: 0,
    hoaMonthly: 0,
    deliveryDate: "",
    ownOccupation: true,
    useBuyersAgent: false,
    useBuildingInspection: true,
  }
}

export function defaultPreferences(): PreferencesStep {
  return {
    fixedRateYears: 10,
    repaymentType: "annuity",
    interestOnlyPct: 0,
    nhg: "unknown",
    riskAppetite: "medium",
    maxNetMonthly: null,
    goals: [],
    equityReleaseAmount: 0,
    equityReleasePurpose: "renovation",
    showHomeInBv: false,
  }
}

export function defaultRisks(count: number): RisksStep {
  return {
    applicants: Array.from({ length: count }, () => ({
      aovMonthlyBenefit: null,
      orvCoverage: null,
      survivorPensionAnnual: null,
      unemploymentRisk: "low" as const,
      incomeOutlook: "stable" as const,
    })),
    otherFixedCostsMonthly: null,
  }
}
