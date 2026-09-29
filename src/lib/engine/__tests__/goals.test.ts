import { describe, expect, it } from "vitest"
import { collectNormKeys, runAdvice } from "../advice"
import type { CurrentProperty, EngineInput } from "../types"
import { applicant, baseInput, ctx, property, salary } from "./fixtures"
import { bv, bvYear, soleProp } from "./fixtures-entrepreneur"

const current = (over: Partial<CurrentProperty> = {}): CurrentProperty => ({
  wozValue: 420000,
  marketValue: 450000,
  expectedSalePrice: 450000,
  energyLabel: "C",
  loanParts: [
    {
      id: "p1",
      type: "annuity",
      balance: 200000,
      ratePct: 2.2,
      fixedRateEndDate: "2029-01-01",
      endDate: "2048-01-01",
      startedBefore2013: false,
      nhg: false,
      originalPrincipal: 260000,
      penaltyFreePct: 10,
    },
    {
      id: "p2",
      type: "interest_only",
      balance: 100000,
      ratePct: 5.2,
      fixedRateEndDate: "2031-01-01",
      endDate: "2040-06-01",
      startedBefore2013: true,
      nhg: false,
      originalPrincipal: 100000,
      penaltyFreePct: 10,
    },
  ],
  ...over,
})

const couple = (): Pick<EngineInput, "applicants" | "household"> => ({
  applicants: [
    applicant({ dateOfBirth: "1980-03-01", incomes: [salary(70000, { holidayPay: 5600 })], previousHomeOwner: true, orvCoverage: 100000, survivorPensionAnnual: 12000 }),
    applicant({ id: "a2", dateOfBirth: "1982-06-01", incomes: [salary(40000)], previousHomeOwner: true }),
  ],
  household: { children: 2, childrenUnder18: 2, maritalStatus: "married", prenup: "none" },
})

describe("doelstromen", () => {
  it("doorstromer, eerst kopen: overbrugging, dubbele lasten, meeneemregeling en bijleenregeling", () => {
    const cp = current()
    cp.loanParts[1]!.portOnMove = true
    const out = runAdvice(
      baseInput({
        goal: "doorstromer",
        ...couple(),
        currentProperty: cp,
        targetProperty: property({ purchasePrice: 600000, energyLabel: "A" }),
        move: { order: "buy_first", bridgeMonths: 6, bridgeRatePct: 5, temporaryHousingMonthly: 0, temporaryHousingMonths: 0 },
      }),
      ctx
    )
    expect(out.mover!.bridge!.amount).toBeGreaterThan(0)
    expect(out.mover!.doubleCosts!.months).toBe(6)
    expect(out.mover!.portedParts).toHaveLength(1)
    expect(out.loan.parts.some((p) => p.ported)).toBe(true)
    expect(out.purchase!.maxOwnHomeDebt).toBeGreaterThan(0)
    expect(out.stress.some((s) => s.key.startsWith("overlijden"))).toBe(true)
    expect(out.stress.some((s) => s.key.startsWith("scheiding"))).toBe(true)
    expect(out.lenders.rows.length).toBeGreaterThanOrEqual(15)
  })

  it("doorstromer, eerst verkopen: tijdelijke woonlasten", () => {
    const out = runAdvice(
      baseInput({
        goal: "doorstromer",
        ...couple(),
        currentProperty: current(),
        targetProperty: property({ purchasePrice: 550000 }),
        move: { order: "sell_first", bridgeMonths: 0, temporaryHousingMonthly: 1500, temporaryHousingMonths: 4 },
      }),
      ctx
    )
    expect(out.mover!.temporaryHousing!.total).toBe(6000)
    expect(out.mover!.bridge).toBeNull()
  })

  it("verhogen voor verbouwing: bestaande delen + aftrekbaar verhogingsdeel, overwaarde-opties", () => {
    const out = runAdvice(
      baseInput({
        goal: "verhogen",
        ...couple(),
        targetProperty: null,
        currentProperty: current(),
        equityRelease: { amount: 50000, purpose: "renovation" },
      }),
      ctx
    )
    const extra = out.loan.parts.find((p) => p.id === "verhoging")!
    expect(extra.principal).toBe(50000)
    expect(extra.deductible).toBe(true)
    expect(out.equityRelease!.options.map((o) => o.key)).toEqual(
      expect.arrayContaining(["verbouwing", "verduurzamen", "aflossen", "sparen", "beleggen", "oversluiten", "consumptief", "schenken", "verzilveren", "sale_leaseback"])
    )
  })

  it("verhogen voor consumptie: box 3-tabel en banken die vrij opnemen toestaan", () => {
    const out = runAdvice(
      baseInput({ goal: "verhogen", ...couple(), targetProperty: null, currentProperty: current(), equityRelease: { amount: 30000, purpose: "consumption" } }),
      ctx
    )
    expect(out.capacity.income.table).toBe("box3Regular")
    expect(out.loan.parts.find((p) => p.id === "verhoging")!.deductible).toBe(false)
    const consumptief = out.equityRelease!.options.find((o) => o.key === "consumptief")!
    expect(consumptief.lenders!.length).toBeGreaterThan(0)
    expect(out.lenders.rows.some((r) => r.reasons.some((x) => x.includes("vrij opnemen")))).toBe(true)
  })

  it("oversluiten: boeterente, besparing en rentemiddeling", () => {
    const out = runAdvice(
      baseInput({ goal: "oversluiten", ...couple(), targetProperty: null, currentProperty: current(), referenceRatePct: 3.8 }),
      ctx
    )
    expect(out.refinance).not.toBeNull()
    expect(out.refinance!.totalPenalty).toBeGreaterThan(0)
    expect(out.refinance!.averagedRatePct).toBeGreaterThan(3.8)
    expect(out.loan.amount).toBe(300000)
  })

  it("alleen verkopen: overwaarde en eigenwoningreserve zonder nieuwe lening", () => {
    const out = runAdvice(baseInput({ goal: "verkopen", ...couple(), targetProperty: null, currentProperty: current() }), ctx)
    expect(out.loan.amount).toBe(0)
    expect(out.mover!.eigenwoningreserve).toBeGreaterThan(0)
    expect(out.stress).toHaveLength(0)
  })

  it("oriëntatie zonder woning: maximale hypotheek op inkomen", () => {
    const out = runAdvice(baseInput({ goal: "orientatie", targetProperty: null }), ctx)
    expect(out.capacity.collateral).toBeNull()
    expect(out.loan.amount).toBe(out.capacity.income.maxLoan)
    expect(out.capacity.levers.some((l) => l.key === "partner")).toBe(true)
  })

  it("oriëntatie met huidige woning maar zonder aankoop: overwaarde-opties", () => {
    const out = runAdvice(baseInput({ goal: "orientatie", ...couple(), targetProperty: null, currentProperty: current() }), ctx)
    expect(out.equityRelease).not.toBeNull()
  })

  it("knoppen: kredieten, studieschuld, energielabel en rentevaste periode", () => {
    const out = runAdvice(
      baseInput({
        obligations: [
          { id: "k", type: "revolving_credit", limitOrPrincipal: 10000, monthlyPayment: 0, outstanding: 0 },
          { id: "s", type: "student_loan", limitOrPrincipal: 0, monthlyPayment: 120, outstanding: 25000 },
          { id: "l", type: "private_lease", limitOrPrincipal: 0, monthlyPayment: 300, outstanding: 0 },
          { id: "a", type: "alimony_partner", limitOrPrincipal: 0, monthlyPayment: 400, outstanding: 0 },
          { id: "x", type: "revolving_credit", limitOrPrincipal: 5000, monthlyPayment: 0, outstanding: 0, willBeRepaid: true },
        ],
        targetProperty: property({ energyLabel: "E" }),
        preferences: { fixedRateYears: 5, repaymentType: "annuity", interestOnlyPct: 0, nhg: "no", riskAppetite: "medium", goals: [], maxNetMonthly: 900 },
        referenceRatePct: 3.8,
      }),
      ctx
    )
    const keys = out.capacity.levers.map((l) => l.key)
    expect(keys).toEqual(expect.arrayContaining(["energielabel", "kredieten", "studieschuld"]))
    expect(out.capacity.income.combinedIncome).toBe(50000 - 4800)
    expect(out.prudent.netMonthly).toBeLessThanOrEqual(900.01)
  })

  it("knop rentevaste periode: bij 10 jaar vast toetsen op de werkelijke rente", () => {
    const out = runAdvice(
      baseInput({
        preferences: { fixedRateYears: 5, repaymentType: "annuity", interestOnlyPct: 0, nhg: "no", riskAppetite: "medium", goals: [] },
        referenceRatePct: 3.8,
      }),
      ctx
    )
    const lever = out.capacity.levers.find((l) => l.key === "rentevast")!
    expect(lever.extraLoan).toBeGreaterThan(0)
  })

  it("aflossingsvrij deel zonder NHG en AOW-gerechtigde", () => {
    const out = runAdvice(
      baseInput({
        applicants: [applicant({ dateOfBirth: "1957-01-01", incomes: [{ kind: "pension", pensionType: "pension", grossAnnual: 45000 }] })],
        preferences: { fixedRateYears: 20, repaymentType: "mixed", interestOnlyPct: 40, nhg: "no", riskAppetite: "low", goals: [] },
        targetProperty: property({ purchasePrice: 300000 }),
        assets: { savings: 200000, investments: 50000, giftAmount: 10000, familyLoanAmount: 20000, familyLoanRatePct: 2, eigenwoningreserve: 0, desiredBuffer: 20000 },
      }),
      ctx
    )
    expect(out.applicants[0]!.reachedAow).toBe(true)
    expect(out.capacity.income.table).toBe("aow")
    expect(out.loan.interestOnlyAmount).toBeGreaterThan(0)
    expect(out.checks.find((c) => c.id === "aflossingseis")!.status).toBe("orange")
    expect(out.equity).not.toBeNull()
    expect(out.purchase!.sources.map((s) => s.key)).toEqual(expect.arrayContaining(["schenking", "familiebank"]))
  })

  it("NHG gewenst maar te hoge lening: oranje NHG-check", () => {
    const out = runAdvice(
      baseInput({
        ...couple(),
        targetProperty: property({ purchasePrice: 650000 }),
        preferences: { fixedRateYears: 10, repaymentType: "mixed", interestOnlyPct: 20, nhg: "yes", riskAppetite: "high", goals: [] },
      }),
      ctx
    )
    expect(out.loan.nhgApplied).toBe(false)
    expect(out.checks.find((c) => c.id === "nhg")!.status).toBe("orange")
  })

  it("nieuwbouw met meerwerk en bouwrente", () => {
    const out = runAdvice(
      baseInput({ ...couple(), targetProperty: property({ kind: "new_build", purchasePrice: 450000, extraWork: 15000, constructionMonths: 14 }) }),
      ctx
    )
    expect(out.purchase!.uses.find((u) => u.key === "meerwerk")!.amount).toBe(15000)
    expect(out.purchase!.costs.lines.find((l) => l.key === "bouwrente")!.amount).toBeGreaterThan(0)
  })

  it("ondernemers: eenmanszaak (starter) en DGA met BV end-to-end", () => {
    const starter = runAdvice(
      baseInput({
        applicants: [
          applicant({
            incomes: [],
            businesses: [soleProp([48000], { soleProp: { years: [{ year: 2025, revenue: 90000, profit: 48000, depreciation: 0, investments: 0, privateWithdrawals: 0, incidentalGains: 0, incidentalLosses: 0, forDecrease: 0, hoursCriterionMet: true }], forBalance: 0, forecastProfit: 52000 }, nextFiguresDate: "2027-03-01", expectedCurrentYearProfit: 55000 })],
          }),
        ],
      }),
      ctx
    )
    const rows = starter.lenders.rows.filter((r) => r.active)
    // Banken verschillen: sommige accepteren 1 jaar cijfers, andere niet
    expect(new Set(rows.map((r) => r.applicantIncome[0]!.income > 0)).size).toBe(2)
    expect(starter.entrepreneur!.businesses[0]!.timing).not.toBeNull()
    expect(starter.entrepreneur!.advice.join(" ")).toMatch(/AOV/)

    const dga = runAdvice(
      baseInput({
        applicants: [
          applicant({
            incomes: [],
            businesses: [
              bv([{ key: "bv", name: "BV", role: "werkmaatschappij", parentKey: null, ownershipPct: 100, financials: [bvYear(2023), bvYear(2024), bvYear(2025)] }], {
                guarantees: [{ amount: 50000, description: "borg krediet", jointAndSeveral: true }],
                nextFiguresDate: "2027-05-01",
                expectedCurrentYearProfit: 120000,
              }, { salaries: [{ year: 2025, amount: 50000 }], currentAccountDga: 20000 }),
            ],
          }),
        ],
        household: { children: 0, childrenUnder18: 0, maritalStatus: "married", prenup: "none" },
        flags: { showHomeInBv: true },
      }),
      ctx
    )
    const b = dga.entrepreneur!.businesses[0]!
    expect(b.homeInBv).not.toBeNull()
    expect(b.ownBvMortgage!.excessive.excess).toBe(0)
    expect(b.equityFromBv!.dividend.gross).toBeGreaterThan(b.equityFromBv!.amountNeeded)
    expect(b.warnings.join(" ")).toMatch(/gebruikelijkloon/)
    expect(b.warnings.join(" ")).toMatch(/rekening-courant/)
    expect(dga.entrepreneur!.advice.join(" ")).toMatch(/borgstelling/)
    expect(dga.entrepreneur!.advice.join(" ")).toMatch(/gemeenschap van goederen/)
  })

  it("verzamelt normsleutels voor de bronnenlijst", () => {
    const keys = collectNormKeys({ a: { normKeys: ["x", 1] }, b: [{ normKey: "y" }], c: null })
    expect([...keys].sort()).toEqual(["x", "y"])
    const out = runAdvice(baseInput(), ctx)
    expect(out.assumptions.length).toBeGreaterThan(20)
    expect(out.assumptions.every((a) => a.sourceUrl || a.status === "needs_verification")).toBe(true)
  })
})
