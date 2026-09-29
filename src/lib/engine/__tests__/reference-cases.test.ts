import { describe, expect, it } from "vitest"
import { runAdvice } from "../advice"
import { incomeCapacity, type CapacityApplicant } from "../capacity/income-capacity"
import { collateralCapacity, nhgCheck } from "../capacity/collateral"
import { purchaseCosts, transferTax } from "../costs/purchase-costs"
import { moverAnalysis } from "../mover/move"
import { penaltyForPart } from "../mover/penalty"
import { annuityPayment, annuityPrincipal } from "../math"
import { ownHomeTaxEffect, eigenwoningforfait } from "../tax/own-home"
import { box3Tax } from "../tax/wealth-tax"
import { projectLoan, buildLoanParts } from "../loan/schedule"
import type { Obligation } from "../types"
import { applicant, baseInput, ctx, N, property, salary } from "./fixtures"

/**
 * Handgerekende referentiecasussen (normen 2026). Elke casus noemt de berekening:
 *   pct uit Trhk Bijlage 1 (tabel, rij, kolom), woonlast = inkomen × pct, ruimte per maand,
 *   contante waarde over 360 maanden, plus extra bedragen buiten de financieringslast.
 * De verwachte bedragen zijn onafhankelijk nagerekend (formule en tabelwaarde).
 */

const app = (toets: number, over: Partial<CapacityApplicant> = {}): CapacityApplicant => ({
  id: "a1",
  toetsinkomen: toets,
  reachedAow: false,
  monthsUntilAow: 400,
  retirementIncome: 20000,
  ...over,
})

function cap(
  apps: CapacityApplicant[],
  opts: Partial<Parameters<typeof incomeCapacity>[0]> = {}
) {
  return incomeCapacity({
    norms: N,
    applicants: apps,
    obligations: [],
    alimonyPaidAnnual: 0,
    erfpachtAnnual: 0,
    ratePct: 4.0,
    fixedYears: 10,
    energyLabel: "C",
    energySavingAmount: 0,
    ...opts,
  })
}

const ob = (o: Partial<Obligation>): Obligation => ({
  id: "o1",
  type: "other",
  limitOrPrincipal: 0,
  monthlyPayment: 0,
  outstanding: 0,
  ...o,
})

describe("Referentiecasussen algemeen (2026)", () => {
  it("1. starter alleenstaand, € 50.000, 4,0% 10 jaar vast, label C", () => {
    // pct 22,6% (rij 50.000, kolom 3,501–4,000) → 11.300/jr → 941,67/mnd
    // PV(941,67; 4%; 360) = 197.242 + label C 5.000 + alleenstaande 17.000 = 219.242
    const r = cap([app(50000)])
    expect(r.financieringslastPct).toBe(22.6)
    expect(r.baseLoan).toBe(197242)
    expect(r.singleExtra).toBe(17000)
    expect(r.maxLoan).toBe(219242)
  })

  it("2. stel met twee inkomens (50k + 40k), 100% partnerinkomen", () => {
    // 90.000 × 25,7% = 23.130 → 1.927,50/mnd → 403.736 + 5.000 = 408.736 (geen alleenstaandenbedrag)
    const r = cap([app(50000), app(40000, { id: "a2" })])
    expect(r.combinedIncome).toBe(90000)
    expect(r.financieringslastPct).toBe(25.7)
    expect(r.maxLoan).toBe(408736)
  })

  it("3. rentevast 5 jaar: toetsrente = AFM 5% i.p.v. 3,9%", () => {
    // 60.000 × 24,6% (kolom 4,501–5,000) → 1.230/mnd → PV @5% = 229.126 + 5.000 + 17.000 = 251.126
    const r = cap([app(60000)], { ratePct: 3.9, fixedYears: 5 })
    expect(r.toetsrentePct).toBe(5)
    expect(r.maxLoan).toBe(251126)
  })

  it("4. studieschuld: DUO-termijn € 150 × bruteringsfactor 1,20 bij 4,0%", () => {
    // 55.000 × 22,6% = 12.430 → 1.035,83 − 180 = 855,83 → 179.263 + 22.000 = 201.263
    const r = cap([app(55000)], { obligations: [ob({ type: "student_loan", monthlyPayment: 150 })] })
    expect(r.obligationsMonthly).toBeCloseTo(180, 6)
    expect(r.maxLoan).toBe(201263)
  })

  it("5. doorlopend krediet € 5.000 limiet telt voor 2% per maand (label B)", () => {
    // 70.000 × 24,5% (kolom 4,001–4,5) = 17.150 → 1.429,17 − 100 → PV @4,2% = 271.803 + 10.000
    const r = cap([app(40000), app(30000, { id: "a2" })], {
      ratePct: 4.2,
      energyLabel: "B",
      obligations: [ob({ type: "revolving_credit", limitOrPrincipal: 5000 })],
    })
    expect(r.obligationsMonthly).toBe(100)
    expect(r.maxLoan).toBe(281803)
  })

  it("6. private lease € 350/mnd telt volledig mee, geen energielabel", () => {
    // 45.000 × 23,6% = 10.620 → 885 − 350 = 535 → PV @4,1% = 110.720 + 0 + 17.000
    const r = cap([app(45000)], { ratePct: 4.1, energyLabel: "geen", obligations: [ob({ type: "private_lease", monthlyPayment: 350 })] })
    expect(r.maxLoan).toBe(127720)
  })

  it("7. AOW-gerechtigde alleenstaande: AOW-tabel", () => {
    // 35.000 × 25,6% (AOW-tabel, kolom 4,001–4,5) = 8.960 → 746,67 → PV @4,3% = 150.880 + A 10.000 + 17.000
    const r = cap([app(35000, { reachedAow: true, monthsUntilAow: 0 })], { ratePct: 4.3, energyLabel: "A" })
    expect(r.table).toBe("aow")
    expect(r.maxLoan).toBe(177880)
  })

  it("8. AOW binnen 10 jaar: laagste van toets nu en toets na AOW", () => {
    // Nu: 70.000 × 23,6% → 310.358. Na AOW: 30.000 × 21,5% (AOW-tabel) → 134.585 → bepalend.
    const r = cap([app(70000, { monthsUntilAow: 30, retirementIncome: 30000 })])
    expect(r.currentMaxLoan).toBe(310358)
    expect(r.aowTest[0]!.maxLoan).toBe(134585)
    expect(r.decisive).toBe("aow")
    expect(r.maxLoan).toBe(134585)
  })

  it("9. energielabel A++++: € 30.000 extra (2026)", () => {
    // 80.000 × 25,3% = 20.240 → 1.686,67 → 353.291 + 30.000 = 383.291
    const r = cap([app(50000), app(30000, { id: "a2" })], { energyLabel: "A++++" })
    expect(r.energyLabelExtra).toBe(30000)
    expect(r.maxLoan).toBe(383291)
  })

  it("10. energiebesparende voorzieningen bij label D: tot € 15.000 buiten de norm", () => {
    const r = cap([app(50000), app(30000, { id: "a2" })], { energyLabel: "D", energySavingAmount: 25000 })
    expect(r.energySavingExtra).toBe(15000)
    expect(r.maxLoan).toBe(353291 + 5000 + 15000)
  })

  it("11. betaalde partneralimentatie verlaagt het toetsinkomen", () => {
    // (80.000 − 6.000) × 24,5% = 18.130 → 316.461 + 5.000
    const r = cap([app(50000), app(30000, { id: "a2" })], { alimonyPaidAnnual: 6000 })
    expect(r.combinedIncome).toBe(74000)
    expect(r.maxLoan).toBe(321461)
  })

  it("12. erfpachtcanon € 2.400/jr telt als last", () => {
    // 1.686,67 − 200 = 1.486,67 → 311.399 + 5.000
    const r = cap([app(50000), app(30000, { id: "a2" })], { erfpachtAnnual: 2400 })
    expect(r.maxLoan).toBe(316399)
  })

  it("13. laag inkomen onder de eerste tabelrij: eerste rij, geen alleenstaandenbedrag", () => {
    // 25.000 × 20,1% = 5.025 → 418,75 → 87.711 + 5.000 (inkomen ≤ 30.000: geen 17.000)
    const r = cap([app(25000)])
    expect(r.financieringslastPct).toBe(20.1)
    expect(r.singleExtra).toBe(0)
    expect(r.maxLoan).toBe(92711)
  })

  it("14. hoog inkomen boven de hoogste rij: laatste rij", () => {
    const r = cap([app(120000), app(80000, { id: "a2" })])
    expect(r.financieringslastPct).toBe(27.4)
    expect(r.maxLoan).toBe(961539)
  })

  it("15. box 3-lening (geen renteaftrek): box 3-tabel", () => {
    const r = cap([app(50000), app(30000, { id: "a2" })], { noInterestDeduction: true })
    expect(r.table).toBe("box3Regular")
    expect(r.financieringslastPct).toBe(20)
    expect(r.maxLoan).toBe(284281)
  })

  it("16. onderpand: 100% marktwaarde + energiebesparend tot 106%", () => {
    const c = collateralCapacity({ norms: N, marketValue: 400000, energySavingAmount: 30000 })
    expect(c.baseMax).toBe(400000)
    expect(c.energyExtra).toBe(24000) // max 6% van 400.000
    expect(c.maxLoan).toBe(424000)
  })

  it("17. NHG: binnen kostengrens (€ 470.000) wel, erboven niet", () => {
    expect(nhgCheck(N, 470000, { energySaving: false, ownOccupation: true, interestOnlyNew: 0 }).eligible).toBe(true)
    expect(nhgCheck(N, 470001, { energySaving: false, ownOccupation: true, interestOnlyNew: 0 }).eligible).toBe(false)
    expect(nhgCheck(N, 490000, { energySaving: true, ownOccupation: true, interestOnlyNew: 0 }).eligible).toBe(true)
    expect(nhgCheck(N, 300000, { energySaving: false, ownOccupation: false, interestOnlyNew: 0 }).eligible).toBe(false)
    expect(nhgCheck(N, 300000, { energySaving: false, ownOccupation: true, interestOnlyNew: 1 }).eligible).toBe(false)
    expect(nhgCheck(N, 300000, { energySaving: false, ownOccupation: true, interestOnlyNew: 0 }).provisie).toBe(1200)
  })

  it("18. startersvrijstelling: 30 jaar en koopsom € 500.000 → geen OVB", () => {
    const t = transferTax(N, { purchasePrice: 500000, kind: "existing", ownOccupation: true }, [applicant({ dateOfBirth: "1996-01-01" })], "2026-10-01")
    expect(t.amount).toBe(0)
    expect(t.starterExemptShare).toBe(1)
  })

  it("19. geen startersvrijstelling boven woningwaardegrens (€ 555.000): 2%", () => {
    const t = transferTax(N, { purchasePrice: 600000, kind: "existing", ownOccupation: true }, [applicant({ dateOfBirth: "1996-01-01" })], "2026-10-01")
    expect(t.amount).toBe(12000)
  })

  it("20. twee kopers, één jonger en één ouder dan 35: de helft vrijgesteld", () => {
    const t = transferTax(
      N,
      { purchasePrice: 400000, kind: "existing", ownOccupation: true },
      [applicant({ dateOfBirth: "1996-01-01" }), applicant({ id: "a2", dateOfBirth: "1980-01-01" })],
      "2026-10-01"
    )
    expect(t.starterExemptShare).toBe(0.5)
    expect(t.amount).toBe(4000) // 400.000 × 50% × 2%
  })

  it("21. geen eigen bewoning: tarief overige woningen 8%", () => {
    const t = transferTax(N, { purchasePrice: 300000, kind: "existing", ownOccupation: false }, [applicant()], "2026-10-01")
    expect(t.amount).toBe(24000)
  })

  it("22. nieuwbouw v.o.n.: geen OVB en geen akte van levering; bouwrente aftrekbaar", () => {
    const pc = purchaseCosts(N, property({ kind: "new_build" }), [applicant()], 300000, {
      nhg: false,
      transferDate: "2026-10-01",
      constructionInterest: 3000,
    })
    expect(pc.lines.find((l) => l.key === "ovb")).toBeUndefined()
    expect(pc.lines.find((l) => l.key === "notaris_levering")).toBeUndefined()
    expect(pc.lines.find((l) => l.key === "bouwrente")?.deductible).toBe(true)
  })

  it("23. doorstromer met overwaarde: overwaarde, eigenwoningreserve en verkoopkosten", () => {
    // Verkoopkosten: 1,34% × 450.000 = 6.030 + royement 200 + overig 950 = 7.180
    // Overwaarde = 450.000 − 7.180 − 250.000 = 192.820; EWR = idem (schuld volledig box 1)
    const m = moverAnalysis({
      norms: N,
      current: {
        wozValue: 430000,
        marketValue: 450000,
        expectedSalePrice: 450000,
        energyLabel: "C",
        loanParts: [
          { id: "p1", type: "annuity", balance: 250000, ratePct: 2.5, fixedRateEndDate: "2030-01-01", endDate: "2046-01-01", startedBefore2013: false, nhg: false },
        ],
      },
      calculationDate: "2026-09-29",
      move: null,
      referenceRatePct: 4,
      taxableIncome: 70000,
    })
    expect(m.saleCosts.total).toBeCloseTo(7180, 6)
    expect(m.netProceeds).toBeCloseTo(192820, 6)
    expect(m.eigenwoningreserve).toBeCloseTo(192820, 6)
    expect(m.restschuld).toBe(0)
  })

  it("24. doorstromer met restschuld", () => {
    const m = moverAnalysis({
      norms: N,
      current: {
        wozValue: 280000,
        marketValue: 280000,
        expectedSalePrice: 280000,
        energyLabel: "E",
        loanParts: [
          { id: "p1", type: "annuity", balance: 300000, ratePct: 2.0, fixedRateEndDate: "2028-01-01", endDate: "2050-01-01", startedBefore2013: false, nhg: true },
        ],
      },
      calculationDate: "2026-09-29",
      move: null,
      referenceRatePct: 4,
      taxableIncome: 50000,
    })
    // 280.000 − (3.752 + 200 + 950) − 300.000 = −24.902
    expect(m.restschuld).toBeCloseTo(24902, 6)
    expect(m.eigenwoningreserve).toBe(0)
  })

  it("25. oude hypotheek van vóór 2013 (aflossingsvrij) blijft aftrekbaar bij meenemen", () => {
    const m = moverAnalysis({
      norms: N,
      current: {
        wozValue: 400000,
        marketValue: 420000,
        expectedSalePrice: 420000,
        energyLabel: "C",
        loanParts: [
          { id: "old", type: "interest_only", balance: 150000, ratePct: 3.0, fixedRateEndDate: "2031-01-01", endDate: "2040-06-01", startedBefore2013: true, nhg: false, portOnMove: true },
        ],
      },
      calculationDate: "2026-09-29",
      move: null,
      referenceRatePct: 4,
      taxableIncome: 70000,
    })
    expect(m.portedParts).toHaveLength(1)
    expect(m.portedParts[0]!.deductible).toBe(true)
    expect(m.portedParts[0]!.type).toBe("interest_only")
    expect(m.portedDebt).toBe(150000)
  })

  it("26. boeterente: contante waarde renteverschil boven 10% boetevrij", () => {
    // Boetevrij 10% van 200.000 = 20.000; basis 180.000; verschil (4% − 3%)/12 × 180.000 = 150/mnd
    // PV(150; 3%; 24 maanden) = 150 × (1 − 1,0025^−24) / 0,0025 = 3.489,90
    const p = penaltyForPart(
      { id: "p", type: "annuity", balance: 200000, ratePct: 4, fixedRateEndDate: "2028-09-29", endDate: "2050-01-01", startedBefore2013: false, nhg: false, originalPrincipal: 200000, penaltyFreePct: 10 },
      "2026-09-29",
      3
    )
    expect(p.remainingFixedMonths).toBe(24)
    expect(p.monthlyDifference).toBeCloseTo(150, 6)
    expect(p.penalty).toBeCloseTo(annuityPrincipal(150, 3, 24), 6)
    expect(p.penalty).toBeCloseTo(3489.9, 1)
  })

  it("27. bruto maandlast annuïteit € 300.000 tegen 4% over 30 jaar = € 1.432,25", () => {
    expect(annuityPayment(300000, 4, 360)).toBeCloseTo(1432.2459, 3)
  })

  it("28. netto maandlast jaar 1: renteaftrek tegen 37,56% minus eigenwoningforfait", () => {
    // EWF 0,35% × 350.000 = 1.225. Rente jaar 1 ≈ 11.938. Voordeel = (rente − 1.225) × 37,56%
    const parts = buildLoanParts({ amount: 300000, ratePct: 4, fixedYears: 10, termMonths: 360, repaymentType: "annuity", interestOnlyPct: 0, maxOwnHomeDebt: 1e9, nhg: false })
    const p = projectLoan({ norms: N, parts, startYear: 2026, propertyValue: 350000, woz: 350000, valueGrowthPct: 0, taxProfile: () => ({ taxableIncome: 80000, aow: false }), hillenStepPct: 4.8 })
    const y1 = p.years[0]!
    expect(eigenwoningforfait(N, 350000)).toBeCloseTo(1225, 6)
    expect(y1.taxBenefit).toBeCloseTo((y1.interest - 1225) * 0.3756, 6)
    expect(y1.netMonthly).toBeCloseTo((y1.gross - y1.taxBenefit) / 12, 6)
  })

  it("29. Wet Hillen: EWF hoger dan rente → bijtelling × (1 − 71,867%)", () => {
    const e = ownHomeTaxEffect(N, 500000, 500, 60000)
    // EWF 1.750; saldo 1.250; belastbaar 1.250 × 28,133% = 351,66; × 37,56% = 132,08
    expect(e.hillenApplied).toBe(true)
    expect(e.benefit).toBeCloseTo(-1250 * (1 - 0.71867) * 0.3756, 6)
  })

  it("30. box 3: vermogen boven heffingvrij vermogen", () => {
    // 100.000 bank: rendement 1,28% = 1.280; grondslag 100.000 − 59.357 = 40.643
    // heffing = 40.643 × 1,28% × 36% = 187,28
    const b = box3Tax(N, { bankBalances: 100000, otherAssets: 0, debts: 0, persons: 1 })
    expect(b.tax).toBeCloseTo(40643 * 0.0128 * 0.36, 6)
  })

  it("31. volledige flow starter: kosten koper niet uit de hypotheek en tekort eigen geld", () => {
    const out = runAdvice(baseInput(), ctx)
    expect(out.capacity.maxMortgage).toBe(219242)
    expect(out.purchase!.mortgage).toBe(219242)
    expect(out.purchase!.costsFromOwnFunds.ok).toBe(true)
    expect(out.purchase!.shortfall).toBeGreaterThan(0)
    expect(out.checks.find((c) => c.id === "tekort")!.status).toBe("red")
    expect(out.lenders.rows.length).toBeGreaterThanOrEqual(15)
  })

  it("32. volledige flow stel: hypotheek rond, NHG van toepassing", () => {
    const out = runAdvice(
      baseInput({
        applicants: [applicant({ incomes: [salary(55000)] }), applicant({ id: "a2", dateOfBirth: "1995-02-01", incomes: [salary(45000)] })],
        household: { children: 0, childrenUnder18: 0, maritalStatus: "cohabiting", prenup: "none" },
        targetProperty: property({ purchasePrice: 400000 }),
        assets: { savings: 60000, investments: 0, giftAmount: 0, familyLoanAmount: 0, familyLoanRatePct: 0, eigenwoningreserve: 0, desiredBuffer: 10000 },
      }),
      ctx
    )
    expect(out.purchase!.shortfall).toBe(0)
    expect(out.loan.nhgApplied).toBe(true)
    expect(out.loan.amount).toBe(out.purchase!.requiredMortgage)
    expect(out.checks.find((c) => c.id === "trhk_inkomen")!.status).toBe("green")
  })
})
