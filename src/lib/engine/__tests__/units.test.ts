import { describe, expect, it } from "vitest"
import { addMonths, ageInYears, aowAgeMonths, aowDate, formatYMD, hasReachedAow, monthsBetween, parseDate } from "../age"
import { budget } from "../budget/budget"
import { findIncomeRow, findRateColumn, toetsrente } from "../capacity/financieringslast"
import { obligationBurdens, studentLoanFactor, studentLoanMonthly } from "../capacity/obligations"
import { buildChecks, type CheckInputs } from "../checks/checks"
import { assessIncome, employeeToetsinkomen, grossIncomeForTax } from "../income/employee"
import { lookupRate, ltvClassFor, medianRate } from "../lenders/rates"
import type { LenderProfile, RateRow } from "../lenders/types"
import { buildLoanParts, partSchedule, projectLoan } from "../loan/schedule"
import {
  annuityBalance,
  annuityBalanceRatio,
  annuityPayment,
  annuityPrincipal,
  average,
  bracketTax,
  clamp,
  coefficientOfVariation,
  floorEuro,
  futureValue,
  linearSlope,
  marginalRate,
  presentValueOfMonthly,
  round,
} from "../math"
import { refinanceAnalysis } from "../mover/penalty"
import { algemeneHeffingskorting, arbeidskorting, netIncome } from "../tax/income-tax"
import { eigenwoningforfait } from "../tax/own-home"
import { box2MarginalPct, box2Tax, box3MarginalPct, vpbTax } from "../tax/wealth-tax"
import { Tracer } from "../trace"
import { N, salary } from "./fixtures"

describe("math", () => {
  it("annuïteit en inverse", () => {
    expect(annuityPayment(0, 4, 360)).toBe(0)
    expect(annuityPayment(1200, 0, 12)).toBe(100)
    expect(annuityPrincipal(100, 0, 12)).toBe(1200)
    expect(annuityPrincipal(0, 4, 360)).toBe(0)
    const pay = annuityPayment(250000, 3.5, 360)
    expect(annuityPrincipal(pay, 3.5, 360)).toBeCloseTo(250000, 6)
    expect(presentValueOfMonthly(pay, 3.5, 360)).toBeCloseTo(250000, 6)
  })
  it("restschuld annuïteit", () => {
    expect(annuityBalance(100000, 4, 360, 0)).toBe(100000)
    expect(annuityBalance(100000, 4, 360, 360)).toBe(0)
    expect(annuityBalance(120000, 0, 120, 60)).toBe(60000)
    expect(annuityBalanceRatio(4, 360, 180)).toBeGreaterThan(0.5)
  })
  it("overige hulpfuncties", () => {
    expect(futureValue(1000, 0, 0, 12)).toBe(1000)
    expect(futureValue(1000, 100, 0, 12)).toBe(2200)
    expect(futureValue(1000, 0, 12, 12)).toBeCloseTo(1126.83, 1)
    expect(round(1.005, 2)).toBe(1.01)
    expect(floorEuro(10.9999999999)).toBe(11)
    expect(clamp(5, 0, 3)).toBe(3)
    expect(average([])).toBe(0)
    expect(coefficientOfVariation([5])).toBe(0)
    expect(coefficientOfVariation([0, 0])).toBe(0)
    expect(linearSlope([1])).toBe(0)
    expect(linearSlope([1, 2, 3])).toBe(1)
    expect(bracketTax(-5, [[0, null, 10]])).toBe(0)
    expect(marginalRate(100000, N.tax.box1)).toBe(49.5)
  })
})

describe("datums en AOW", () => {
  it("datumrekenen", () => {
    expect(() => parseDate("x")).toThrow()
    expect(formatYMD(addMonths(parseDate("2024-01-31"), 1))).toBe("2024-02-29")
    expect(monthsBetween(parseDate("2026-03-15"), parseDate("2026-01-20"))).toBe(-1)
    expect(ageInYears("1990-10-01", "2026-09-29")).toBe(35)
  })
  it("AOW-leeftijd volgens schema", () => {
    expect(aowAgeMonths("1959-06-01", N)).toBe(804) // 67 in 2026
    expect(aowAgeMonths("1961-06-01", N)).toBe(807) // AOW in 2028: 67 jaar en 3 maanden
    expect(aowAgeMonths("1940-01-01", N)).toBe(804) // vóór het schema: eerste waarde
    expect(aowAgeMonths("1990-01-01", N)).toBe(807) // na het schema: laatste bekende waarde
    expect(aowDate("1959-06-01", N)).toBe("2026-06-01")
    expect(hasReachedAow("1959-06-01", "2026-09-29", N)).toBe(true)
    expect(aowAgeMonths("1960-01-01", { ...N, trhk: { ...N.trhk, aowAgeMonthsByYear: {} } })).toBe(804)
  })
})

describe("inkomen loondienst", () => {
  it("contractvormen", () => {
    const full = salary(40000, { holidayPay: 3200, thirteenthMonth: 3333, irregularityAllowance: 1000, commission: 500, fixedYearEndBonus: 400 })
    expect(assessIncome(full).amount).toBe(48433)
    expect(assessIncome({ ...full, contract: "temporary_with_intent" }).requires).toBe("acceptsIntentieverklaring")
    expect(assessIncome({ ...full, contract: "perspectiefverklaring" }).requires).toBe("acceptsPerspectiefverklaring")
    expect(assessIncome({ ...full, contract: "flex", iblToetsinkomen: 38000 }).amount).toBe(38000)
    expect(assessIncome({ ...full, contract: "temporary" }).treatment).toBe("not_counted")
  })
  it("uitkering, pensioen, alimentatie en huur", () => {
    expect(assessIncome({ kind: "benefit", benefitType: "wia_iva", grossAnnual: 20000, permanent: true }).amount).toBe(20000)
    expect(assessIncome({ kind: "benefit", benefitType: "ww", grossAnnual: 20000, permanent: false }).amount).toBe(0)
    expect(assessIncome({ kind: "pension", pensionType: "aow", grossAnnual: 15000 }).amount).toBe(15000)
    expect(assessIncome({ kind: "alimony_received", grossAnnual: 6000 }).amount).toBe(6000)
    expect(assessIncome({ kind: "rental", grossAnnual: 9000 }).amount).toBe(0)
    const all = employeeToetsinkomen([salary(30000), { kind: "rental", grossAnnual: 9000 }])
    expect(all.total).toBe(30000)
    expect(grossIncomeForTax([salary(30000), { kind: "rental", grossAnnual: 9000 }])).toEqual({ labour: 30000, other: 9000 })
  })
})

describe("financieringslasttabellen en verplichtingen", () => {
  it("rij- en kolomkeuze", () => {
    const t = N.trhk.tables.regular
    expect(findIncomeRow(t, -10)).toBe(0)
    expect(findIncomeRow(t, 10_000_000)).toBe(t.incomeBrackets.length - 1)
    expect(findRateColumn(t, 0.5)).toBe(0)
    expect(findRateColumn(t, 9)).toBe(t.rateBrackets.length - 1)
    expect(findRateColumn(t, 2.0)).toBe(1)
    expect(findRateColumn(t, 2.0004)).toBe(1)
    expect(toetsrente(N, 5.5, 5)).toBe(5.5)
    expect(toetsrente(N, 3.5, 20)).toBe(3.5)
  })
  it("studieschuld in aanloopfase en factoren", () => {
    expect(studentLoanFactor(N, 1.5)).toBe(1.05)
    expect(studentLoanFactor(N, 7)).toBe(1.4)
    const m = studentLoanMonthly({ id: "s", type: "student_loan", limitOrPrincipal: 0, monthlyPayment: 0, outstanding: 20000, studentLoanReducedPhase: true, studentLoanRatePct: 2.5, studentLoanRemainingMonths: 180 })
    expect(m).toBeCloseTo(annuityPayment(20000, 2.5, 180), 6)
    const b = obligationBurdens(
      [
        { id: "p", type: "personal_loan", limitOrPrincipal: 10000, monthlyPayment: 250, outstanding: 8000 },
        { id: "o", type: "other", limitOrPrincipal: 0, monthlyPayment: 75, outstanding: 0 },
      ],
      N,
      4
    )
    expect(b.map((x) => x.monthly)).toEqual([200, 75])
  })
})

describe("belastingen", () => {
  it("heffingskortingen en netto-inkomen", () => {
    expect(algemeneHeffingskorting(N, 20000)).toBe(N.tax.heffingskortingen.ahk.max)
    expect(algemeneHeffingskorting(N, 200000)).toBe(0)
    expect(algemeneHeffingskorting(N, 20000, true)).toBe(N.tax.heffingskortingen.ahk.aowMax)
    expect(arbeidskorting(N, 0)).toBe(0)
    expect(arbeidskorting(N, 10000)).toBeCloseTo(832.4, 1)
    expect(arbeidskorting(N, 200000)).toBe(0)
    expect(arbeidskorting(N, 30000, true)).toBeGreaterThan(0)
    const n = netIncome(N, 60000, 60000)
    expect(n.net).toBeLessThan(60000)
    expect(n.marginalPct).toBe(37.56)
  })
  it("eigenwoningforfait incl. villataks", () => {
    expect(eigenwoningforfait(N, 0)).toBe(0)
    expect(eigenwoningforfait(N, 20000)).toBeCloseTo(20, 6)
    expect(eigenwoningforfait(N, 2_000_000)).toBeCloseTo(4725 + 650000 * 0.0235, 6)
  })
  it("box 2, box 3 en Vpb", () => {
    expect(box2Tax(N, 100000)).toBeCloseTo(68843 * 0.245 + 31157 * 0.31, 6)
    expect(box2MarginalPct(N, 100000)).toBe(31)
    expect(vpbTax(N, 300000)).toBeCloseTo(200000 * 0.19 + 100000 * 0.258, 6)
    expect(box3MarginalPct(N, { bankBalances: 100000, otherAssets: 0, debts: 0, persons: 1 }, "bank")).toBeCloseTo(1.28 * 0.36, 3)
    expect(box3MarginalPct(N, { bankBalances: 0, otherAssets: 100000, debts: 0, persons: 1 }, "other")).toBeCloseTo(6 * 0.36, 3)
  })
})

describe("leningschema", () => {
  it("lineair, aflossingsvrij en renteschok", () => {
    const lin = partSchedule({ id: "l", label: "l", type: "linear", principal: 120000, ratePct: 4, fixedYears: 10, termMonths: 360, deductible: true })
    expect(lin.months[0]!.repayment).toBeCloseTo(333.33, 2)
    expect(lin.firstMonthGross).toBeCloseTo(333.33 + 400, 2)
    const io = partSchedule({ id: "i", label: "i", type: "interest_only", principal: 100000, ratePct: 3, fixedYears: 10, termMonths: 120, deductible: false })
    expect(io.months[119]!.repayment).toBe(100000)
    expect(io.months[130]!.interest).toBe(0)
    const shocked = partSchedule({ id: "a", label: "a", type: "annuity", principal: 200000, ratePct: 4, fixedYears: 10, termMonths: 360, deductible: true }, { rateShockPp: 2 })
    const normal = partSchedule({ id: "a", label: "a", type: "annuity", principal: 200000, ratePct: 4, fixedYears: 10, termMonths: 360, deductible: true })
    expect(shocked.paymentAfterReset).toBeGreaterThan(normal.paymentAfterReset)
    const noFixed = partSchedule({ id: "n", label: "n", type: "annuity", principal: 1000, ratePct: 4, fixedYears: 0, termMonths: 12, deductible: true })
    expect(noFixed.paymentAfterReset).toBe(noFixed.firstMonthGross)
  })
  it("leningdelen: box 3 boven maximale eigenwoningschuld en aflossingsvrij deel", () => {
    const parts = buildLoanParts({ amount: 300000, ratePct: 4, fixedYears: 10, termMonths: 360, repaymentType: "mixed", interestOnlyPct: 60, maxOwnHomeDebt: 100000, nhg: false })
    expect(parts.find((p) => p.id === "nieuw-aflossingsvrij")!.principal).toBe(150000) // max 50%
    expect(parts.find((p) => p.id === "nieuw-box1")!.principal).toBe(100000)
    expect(parts.find((p) => p.id === "nieuw-box3")!.principal).toBe(50000)
    expect(buildLoanParts({ amount: 0, ratePct: 4, fixedYears: 10, termMonths: 360, repaymentType: "linear", interestOnlyPct: 0, maxOwnHomeDebt: 0, nhg: false })).toEqual([])
    const noOwnHome = projectLoan({ norms: N, parts: parts.filter((p) => !p.deductible), startYear: 2026, propertyValue: 400000, woz: 400000, valueGrowthPct: 2, taxProfile: () => ({ taxableIncome: 50000, aow: false }), hillenStepPct: 4.8, years: 2 })
    expect(noOwnHome.years[0]!.taxBenefit).toBe(0)
    expect(noOwnHome.years[1]!.propertyValue).toBe(408000)
  })
})

describe("rentetabellen", () => {
  const rows: RateRow[] = [
    { lenderSlug: "x", fixedYears: 10, ltvClass: "ltv80", repaymentType: "annuity", ratePct: 4.2, rateDate: "2026-09-01", status: "verified" },
    { lenderSlug: "x", fixedYears: 10, ltvClass: "ltv100", repaymentType: "annuity", ratePct: 4.5, rateDate: "2026-09-01", status: "verified" },
    { lenderSlug: "x", fixedYears: 20, ltvClass: "ltv100", repaymentType: "annuity", ratePct: 4.8, rateDate: "2026-09-01", status: "verified" },
  ]
  const lender = { slug: "x", energyLabelDiscounts: { A: 0.1 }, energyLabelDiscountsAbove10y: { A: 0.03 } } as unknown as LenderProfile
  it("LTV-klassen en terugvaloptie", () => {
    expect(ltvClassFor(55, false)).toBe("ltv60")
    expect(ltvClassFor(65, false)).toBe("ltv70")
    expect(ltvClassFor(95, false)).toBe("ltv100")
    expect(ltvClassFor(95, true)).toBe("nhg")
    const nhg = lookupRate(rows, lender, { fixedYears: 10, ltvPct: 75, nhg: true, repayment: "annuity", energyLabel: "C" })!
    expect(nhg.ratePct).toBe(4.2)
    expect(nhg.notes.join()).toMatch(/NHG/)
    const low = lookupRate(rows, lender, { fixedYears: 10, ltvPct: 50, nhg: false, repayment: "interest_only", energyLabel: "A" })!
    expect(low.row.ltvClass).toBe("ltv80")
    expect(low.ratePct).toBeCloseTo(4.1, 6)
    const p15 = lookupRate(rows, lender, { fixedYears: 15, ltvPct: 95, nhg: false, repayment: "linear", energyLabel: "A" })!
    expect(p15.row.fixedYears).toBe(20)
    expect(p15.ratePct).toBeCloseTo(4.77, 6)
    expect(lookupRate(rows, { ...lender, slug: "y" }, { fixedYears: 10, ltvPct: 50, nhg: false, repayment: "annuity", energyLabel: "A" })).toBeNull()
    expect(lookupRate([], lender, { fixedYears: 10, ltvPct: 50, nhg: false, repayment: "annuity", energyLabel: "A" })).toBeNull()
  })
  it("mediaanrente", () => {
    const l = (slug: string) => ({ slug, active: true, energyLabelDiscounts: {} }) as unknown as LenderProfile
    const r2: RateRow[] = [...rows, { ...rows[0]!, lenderSlug: "y", ratePct: 4.0 }]
    expect(medianRate(r2, [l("x"), l("y")], { fixedYears: 10, ltvPct: 70, nhg: false, energyLabel: "C" })).toBeCloseTo(4.1, 6)
    expect(medianRate(r2, [l("x"), l("y"), l("z")], { fixedYears: 10, ltvPct: 70, nhg: false, energyLabel: "C" })).toBeCloseTo(4.1, 6)
    expect(medianRate([], [l("x")], { fixedYears: 10, ltvPct: 70, nhg: false, energyLabel: "C" })).toBeNull()
  })
})

describe("begroting, controles, oversluiten en trace", () => {
  it("begroting rood en oranje", () => {
    const base = { persons: [{ taxable: 40000, labour: 40000, aow: false }], adults: 1, children: 6, hoaMonthly: 150, erfpachtAnnual: 1200, propertyValue: 300000, obligationsMonthly: 200, otherFixedCostsMonthly: 300 }
    expect(budget(N, { ...base, housingNetMonthly: 2500 }).light).toBe("red")
    const orange = budget(N, { ...base, children: 0, housingNetMonthly: 1100, obligationsMonthly: 0, otherFixedCostsMonthly: 0 })
    expect(["orange", "green"]).toContain(orange.light)
  })
  it("controles in alle kleuren", () => {
    const i: CheckInputs = {
      loanAmount: 300000, maxIncome: 250000, maxCollateral: 280000, shortfall: 1000,
      costsFromOwnFunds: { ok: false, message: "x" }, nhg: { wanted: true, eligible: false, reason: "x" },
      newInterestOnly: 0, box3Part: 5000, aowDecisive: true, starterExempt: false, budgetLight: "red",
      stressReds: 0, stressOranges: 1, lendersFitting: 0, documentChecks: [{ label: "Salaris", status: "green", detail: "ok" }],
      unverifiedNorms: 0, staleRates: 2, entrepreneurWarnings: ["w"], excessiveBorrowingExcess: 1,
    }
    const c = buildChecks(i)
    expect(c.find((x) => x.id === "trhk_inkomen")!.status).toBe("red")
    expect(c.find((x) => x.id === "bijleenregeling")!.status).toBe("orange")
    expect(c.find((x) => x.id === "acceptatie")!.status).toBe("red")
    expect(c.find((x) => x.id === "document_0")!.status).toBe("green")
    expect(c.find((x) => x.id === "excessief_lenen")!.status).toBe("red")
    expect(buildChecks({ ...i, budgetLight: "orange", lendersFitting: 1, stressOranges: 0 }).find((x) => x.id === "budget")!.status).toBe("orange")
  })
  it("oversluiten zonder besparing", () => {
    const r = refinanceAnalysis(
      [{ id: "p", type: "linear", balance: 100000, ratePct: 2, fixedRateEndDate: "2026-01-01", endDate: "2040-01-01", startedBefore2013: false, nhg: false }],
      "2026-09-29",
      4,
      10
    )
    expect(r.totalPenalty).toBe(0)
    expect(r.paybackMonths).toBeNull()
  })
  it("tracer met prefix", () => {
    const t = new Tracer("a")
    t.child("b").add({ id: "c", label: "x", value: 1, unit: "EUR", formula: "f" })
    expect(t.list()[0]!.id).toBe("a.b.c")
  })
})
