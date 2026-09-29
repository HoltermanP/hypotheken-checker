import type { EngineInput } from "@/lib/engine/types"

/** Voorbeeldprofielen voor de openbare demo (fictief). */

const base = (over: Partial<EngineInput>): EngineInput => ({
  calculationDate: "2026-09-29",
  goal: "starter",
  applicants: [],
  household: { children: 0, childrenUnder18: 0, maritalStatus: "single", prenup: "none" },
  obligations: [],
  assets: { savings: 30000, investments: 0, giftAmount: 0, familyLoanAmount: 0, familyLoanRatePct: 0, eigenwoningreserve: 0, desiredBuffer: 8000 },
  targetProperty: null,
  preferences: { fixedRateYears: 10, repaymentType: "annuity", interestOnlyPct: 0, nhg: "unknown", riskAppetite: "medium", goals: [] },
  referenceRatePct: 4.3,
  ...over,
})

const employment = (gross: number) => ({
  kind: "employment" as const,
  contract: "permanent" as const,
  grossAnnualSalary: gross,
  holidayPay: Math.round(gross * 0.08),
  thirteenthMonth: 0,
  fixedYearEndBonus: 0,
  irregularityAllowance: 0,
  commission: 0,
})

const target = (price: number) => ({
  purchasePrice: price,
  kind: "existing" as const,
  extraWork: 0,
  energyLabel: "B" as const,
  erfpachtCanonAnnual: 0,
  renovationAmount: 0,
  energySavingAmount: 0,
  hoaMonthly: 0,
  ownOccupation: true,
  useBuyersAgent: false,
  useBuildingInspection: true,
})

export const DEMO_PROFILES: { key: string; title: string; description: string; input: EngineInput }[] = [
  {
    key: "starter",
    title: "Starter, alleenstaand",
    description: "30 jaar, € 52.000 bruto per jaar plus vakantiegeld, € 30.000 spaargeld, koopt een appartement van € 325.000.",
    input: base({
      applicants: [{ id: "a1", dateOfBirth: "1996-04-01", incomes: [employment(52000)], businesses: [], previousHomeOwner: false, usedStartersExemption: false, alimonyPaidAnnual: 0 }],
      targetProperty: target(325000),
      obligations: [{ id: "duo", type: "student_loan", limitOrPrincipal: 0, monthlyPayment: 95, outstanding: 21000 }],
    }),
  },
  {
    key: "doorstromer",
    title: "Doorstromers met kinderen",
    description: "Stel (41 en 39), € 68.000 en € 42.000, verkoopt voor € 450.000 (schuld € 240.000) en koopt voor € 575.000.",
    input: base({
      goal: "doorstromer",
      household: { children: 2, childrenUnder18: 2, maritalStatus: "married", prenup: "none" },
      applicants: [
        { id: "a1", dateOfBirth: "1985-02-01", incomes: [employment(68000)], businesses: [], previousHomeOwner: true, usedStartersExemption: false, alimonyPaidAnnual: 0, orvCoverage: 150000 },
        { id: "a2", dateOfBirth: "1987-06-01", incomes: [employment(42000)], businesses: [], previousHomeOwner: true, usedStartersExemption: false, alimonyPaidAnnual: 0 },
      ],
      assets: { savings: 45000, investments: 10000, giftAmount: 0, familyLoanAmount: 0, familyLoanRatePct: 0, eigenwoningreserve: 0, desiredBuffer: 15000 },
      currentProperty: {
        wozValue: 420000,
        marketValue: 450000,
        expectedSalePrice: 450000,
        energyLabel: "C",
        loanParts: [{ id: "p1", type: "annuity", balance: 240000, ratePct: 2.1, fixedRateEndDate: "2030-06-01", endDate: "2046-06-01", startedBefore2013: false, nhg: false }],
      },
      targetProperty: target(575000),
      move: { order: "sell_first", bridgeMonths: 0, temporaryHousingMonthly: 0, temporaryHousingMonths: 0 },
    }),
  },
  {
    key: "dga",
    title: "DGA met een BV",
    description: "DGA (45), salaris € 60.000, BV met winst na belasting rond € 90.000, koopt voor € 480.000.",
    input: base({
      applicants: [
        {
          id: "a1",
          dateOfBirth: "1981-09-01",
          incomes: [],
          previousHomeOwner: true,
          usedStartersExemption: false,
          alimonyPaidAnnual: 0,
          businesses: [
            {
              id: "bv",
              legalForm: "bv",
              startDate: "2014-01-01",
              sector: "ict",
              profitSharePct: 100,
              bv: {
                shareholdingPct: 100,
                statutoryDirector: true,
                salaries: [{ year: 2025, amount: 60000 }],
                carBenefit: 0,
                pensionAccrual: 0,
                fiscalUnity: false,
                currentAccountDga: 0,
                loansToDga: [],
                issuedCapital: 18000,
                entities: [
                  {
                    key: "bv",
                    name: "Werk BV",
                    role: "werkmaatschappij",
                    parentKey: null,
                    ownershipPct: 100,
                    financials: [2023, 2024, 2025].map((year, i) => ({
                      year,
                      revenue: 600000,
                      resultBeforeTax: 105000 + i * 5000,
                      corporateTax: 20000 + i * 1000,
                      resultAfterTax: 85000 + i * 4000,
                      dividendPaid: 0,
                      retainedEarnings: 300000 + i * 80000,
                      equity: 318000 + i * 80000,
                      balanceTotal: 500000 + i * 80000,
                      liquidAssets: 250000 + i * 60000,
                      currentAssets: 320000 + i * 60000,
                      currentLiabilities: 120000,
                      longTermLiabilities: 60000,
                      managementFeeReceived: 0,
                      managementFeePaid: 0,
                      dgaSalaryPaid: 60000,
                      intercompanyReceivables: 0,
                      intercompanyPayables: 0,
                      resultFromParticipations: 0,
                      participationsValue: 0,
                    })),
                  },
                ],
              },
              largestClientPct: 25,
              aov: { has: true, monthlyBenefit: 3500 },
              annuityPremiumAnnual: 0,
              businessDebts: 0,
              guarantees: [],
            },
          ],
        },
      ],
      assets: { savings: 80000, investments: 0, giftAmount: 0, familyLoanAmount: 0, familyLoanRatePct: 0, eigenwoningreserve: 0, desiredBuffer: 20000 },
      targetProperty: target(480000),
    }),
  },
]
