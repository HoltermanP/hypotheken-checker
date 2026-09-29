import type { BusinessInput, BvEntity, BvYear, SolePropYear } from "../entrepreneur"

export const year = (y: number, profit: number, over: Partial<SolePropYear> = {}): SolePropYear => ({
  year: y,
  revenue: profit * 3,
  profit,
  depreciation: 0,
  investments: 0,
  privateWithdrawals: 0,
  incidentalGains: 0,
  incidentalLosses: 0,
  forDecrease: 0,
  hoursCriterionMet: true,
  ...over,
})

export function soleProp(profits: number[], over: Partial<BusinessInput> = {}): BusinessInput {
  return {
    id: "b1",
    legalForm: "eenmanszaak",
    startDate: `${2026 - profits.length}-01-01`,
    sector: "ict",
    profitSharePct: 100,
    soleProp: { years: profits.map((p, i) => year(2026 - profits.length + i, p)), forBalance: 0 },
    largestClientPct: 20,
    aov: { has: false, monthlyBenefit: 0 },
    annuityPremiumAnnual: 0,
    businessDebts: 0,
    guarantees: [],
    ...over,
  }
}

export const bvYear = (y: number, over: Partial<BvYear> = {}): BvYear => ({
  year: y,
  revenue: 1_000_000,
  resultBeforeTax: 110_000,
  corporateTax: 20_000,
  resultAfterTax: 90_000,
  dividendPaid: 0,
  retainedEarnings: 580_000,
  equity: 600_000,
  balanceTotal: 800_000,
  liquidAssets: 400_000,
  currentAssets: 450_000,
  currentLiabilities: 100_000,
  longTermLiabilities: 100_000,
  managementFeeReceived: 0,
  managementFeePaid: 0,
  dgaSalaryPaid: 60_000,
  intercompanyReceivables: 0,
  intercompanyPayables: 0,
  resultFromParticipations: 0,
  participationsValue: 0,
  ...over,
})

export function bv(entities: BvEntity[], over: Partial<BusinessInput> = {}, bvOver: Partial<NonNullable<BusinessInput["bv"]>> = {}): BusinessInput {
  return {
    id: "bv1",
    legalForm: entities.length > 1 ? "bv_holding" : "bv",
    startDate: "2015-01-01",
    sector: "zakelijke_dienstverlening",
    profitSharePct: 100,
    bv: {
      shareholdingPct: 100,
      statutoryDirector: true,
      salaries: [
        { year: 2023, amount: 60_000 },
        { year: 2024, amount: 60_000 },
        { year: 2025, amount: 60_000 },
      ],
      carBenefit: 0,
      pensionAccrual: 0,
      entities,
      fiscalUnity: false,
      currentAccountDga: 0,
      loansToDga: [],
      issuedCapital: 18_000,
      ...bvOver,
    },
    largestClientPct: 20,
    aov: { has: true, monthlyBenefit: 3000 },
    annuityPremiumAnnual: 0,
    businessDebts: 0,
    guarantees: [],
    ...over,
  }
}

