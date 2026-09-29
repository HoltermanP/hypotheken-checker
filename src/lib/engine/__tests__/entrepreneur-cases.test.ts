import { describe, expect, it } from "vitest"
import { runAdvice } from "../advice"
import {
  businessIncome,
  consolidate,
  continuityRisk,
  DEFAULT_POLICY,
  excessiveBorrowing,
  salaryVsDividend,
  withDefaults,
  type BvEntity,
  type BvYear,
} from "../entrepreneur"
import { applicant, baseInput, ctx, N, property, salary } from "./fixtures"
import { bv, bvYear, soleProp, year } from "./fixtures-entrepreneur"

/**
 * Referentiecasussen ondernemers (§6B), met handberekening in het commentaar.
 */

const single = (financials: BvYear[]): BvEntity[] => [
  { key: "bv", name: "Werk BV", role: "werkmaatschappij", parentKey: null, ownershipPct: 100, financials },
]

const P = (over: Partial<typeof DEFAULT_POLICY> = {}) => withDefaults(over)

describe("Referentiecasussen ondernemers", () => {
  it("E1. starter-eenmanszaak met 1 jaar cijfers: afhankelijk van bankbeleid", () => {
    const b = soleProp([45000], { soleProp: { years: [year(2025, 45000)], forBalance: 0, forecastProfit: 50000 } })
    // Standaard: 3 jaar vereist, geen prognose → niet geaccepteerd
    expect(businessIncome(b, P(), N).accepted).toBe(false)
    // Bank met minimaal 1 jaar cijfers → 45.000
    expect(businessIncome(b, P({ minYearsFigures: 1 }), N).income).toBe(45000)
    // Bank met 2 jaar + prognose → min(gemiddelde 45.000, prognose 50.000) = 45.000
    const r = businessIncome(b, P({ minYearsFigures: 2, acceptsForecastForStarters: true }), N)
    expect(r.accepted).toBe(true)
    expect(r.income).toBe(45000)
    // Lagere prognose (40.000) is bepalend
    const low = { ...b, soleProp: { ...b.soleProp!, forecastProfit: 40000 } }
    expect(businessIncome(low, P({ minYearsFigures: 2, acceptsForecastForStarters: true }), N).income).toBe(40000)
  })

  it("E2. eenmanszaak met stijgende winst (40k, 50k, 60k): gemiddelde 50.000 als plafond", () => {
    const b = soleProp([40000, 50000, 60000])
    expect(businessIncome(b, P(), N).income).toBe(50000)
    expect(businessIncome(b, P({ calcMethod: "avg3" }), N).income).toBe(50000)
    expect(businessIncome(b, P({ calcMethod: "last_year" }), N).income).toBe(60000)
    // Gewogen: (1×40 + 2×50 + 3×60) / 6 = 53.333,33
    expect(businessIncome(b, P({ calcMethod: "weighted" }), N).income).toBeCloseTo(53333.33, 1)
  })

  it("E3. eenmanszaak met dalend laatste jaar (60k, 70k, 45k): laatste jaar bepalend", () => {
    const b = soleProp([60000, 70000, 45000])
    expect(businessIncome(b, P(), N).income).toBe(45000)
    // Incidentele bate van 10.000 in jaar 2 wordt eruit gehaald; laatste jaar blijft bepalend
    const inc = soleProp([60000, 70000, 45000])
    inc.soleProp!.years[1]!.incidentalGains = 10000
    const r = businessIncome(inc, P({ calcMethod: "avg3" }), N)
    expect(r.income).toBeCloseTo((60000 + 60000 + 45000) / 3, 6)
  })

  it("E4. vof met twee vennoten: ieder zijn eigen winstaandeel", () => {
    // Winstaandeel per vennoot 45k, 48k, 50k → gemiddelde 47.666,67 (laatste jaar hoger → gemiddelde)
    const vof = soleProp([45000, 48000, 50000], { legalForm: "vof", profitSharePct: 50 })
    const r = businessIncome(vof, P(), N)
    expect(r.income).toBeCloseTo(47666.67, 1)
    const out = runAdvice(
      baseInput({
        applicants: [
          applicant({ incomes: [], businesses: [vof] }),
          applicant({ id: "a2", dateOfBirth: "1990-01-01", incomes: [], businesses: [{ ...vof, id: "b2" }] }),
        ],
        targetProperty: property({ purchasePrice: 400000 }),
      }),
      ctx
    )
    expect(out.capacity.income.combinedIncome).toBeCloseTo(95333.33, 1)
    expect(out.entrepreneur?.businesses).toHaveLength(2)
  })

  it("E5. ZZP'er met loondienst ernaast: salaris + ondernemersinkomen", () => {
    // Salaris 30.000 + winst (20k, 25k, 22k): laatste 22.000 < gemiddelde 22.333 → 22.000 → totaal 52.000
    const out = runAdvice(
      baseInput({ applicants: [applicant({ incomes: [salary(30000)], businesses: [soleProp([20000, 25000, 22000])] })] }),
      ctx
    )
    expect(out.applicants[0]!.toetsinkomen).toBe(52000)
    expect(out.applicants[0]!.isEntrepreneur).toBe(true)
  })

  it("E6. DGA met alleen salaris (bank telt geen winst)", () => {
    const b = bv(single([bvYear(2023), bvYear(2024), bvYear(2025)]))
    const r = businessIncome(b, P({ dgaTreatment: "salary_only" }), N)
    expect(r.income).toBe(60000)
  })

  it("E7. DGA met hoge winstreserves en goede solvabiliteit: winstcapaciteit bepalend", () => {
    // Resultaat na belasting 80k, 90k, 100k → gemiddelde 90k (laatste hoger → 90k)
    // Solvabiliteit: (600k − 20% × 800k) / 0,8 = 550k; liquiditeit: min(400k, 450k − 100k) = 350k
    // Uitkeringstoets: 600k − 18k = 582k → uitkeerbaar 90k → toetsinkomen 60k + 90k = 150k
    const b = bv(single([bvYear(2023, { resultAfterTax: 80000 }), bvYear(2024), bvYear(2025, { resultAfterTax: 100000 })]))
    const r = businessIncome(b, P(), N)
    expect(r.dga!.tests!.maxBySolvency).toBeCloseTo(550000, 6)
    expect(r.dga!.tests!.maxByLiquidity).toBe(350000)
    expect(r.dga!.tests!.limitingTest).toBe("winstcapaciteit")
    expect(r.income).toBe(150000)
  })

  it("E8. DGA met slechte liquiditeit: liquiditeitstoets bepalend", () => {
    // Liquide 20k, vlottende activa 120k, kortlopende schulden 110k → min(20k, 10k) = 10k
    const b = bv(single([bvYear(2023), bvYear(2024), bvYear(2025, { liquidAssets: 20000, currentAssets: 120000, currentLiabilities: 110000 })]))
    const r = businessIncome(b, P(), N)
    expect(r.dga!.tests!.limitingTest).toBe("liquiditeit")
    expect(r.dga!.tests!.maxByLiquidity).toBe(10000)
    expect(r.income).toBe(70000)
  })

  const holdingEntities = (): BvEntity[] => [
    {
      key: "h",
      name: "Holding BV",
      role: "holding",
      parentKey: null,
      ownershipPct: 100,
      financials: [2023, 2024, 2025].map((y) =>
        bvYear(y, {
          revenue: 90000,
          resultBeforeTax: 20000,
          corporateTax: 3800,
          resultAfterTax: 116000, // incl. 100k resultaat deelneming
          resultFromParticipations: 100000,
          managementFeeReceived: 90000,
          dgaSalaryPaid: 70000,
          equity: 500000,
          participationsValue: 400000,
          balanceTotal: 520000,
          liquidAssets: 100000,
          currentAssets: 110000,
          currentLiabilities: 10000,
          retainedEarnings: 480000,
        })
      ),
    },
    {
      key: "w",
      name: "Werk BV",
      role: "werkmaatschappij",
      parentKey: "h",
      ownershipPct: 100,
      financials: [2023, 2024, 2025].map((y) =>
        bvYear(y, {
          revenue: 1000000,
          resultAfterTax: 100000,
          managementFeePaid: 90000,
          dgaSalaryPaid: 0,
          equity: 400000,
          balanceTotal: 700000,
          liquidAssets: 200000,
          currentAssets: 350000,
          currentLiabilities: 150000,
          retainedEarnings: 380000,
        })
      ),
    },
  ]

  it("E9. holding met één werkmaatschappij en management fee: consolidatie zonder dubbeltelling", () => {
    // Geconsolideerd resultaat = (116k − 100k deelneming) + 100k = 116k; omzet 1.000k + 90k − 90k fee
    // EV = (500k − 400k) + 400k = 500k; BT = (520k − 400k) + 700k = 820k
    const c = consolidate(holdingEntities())
    expect(c[2]!.resultAfterTax).toBe(116000)
    expect(c[2]!.revenue).toBe(1000000)
    expect(c[2]!.equity).toBe(500000)
    expect(c[2]!.balanceTotal).toBe(820000)
    const b = bv(holdingEntities(), {}, {
      salaries: [{ year: 2025, amount: 70000 }],
      managementFee: { annual: 90000, contractual: true, structural: true, armsLength: true },
    })
    const r = businessIncome(b, P(), N)
    // Uitkeerbaar = min(116k, solv (500k − 164k)/0,8 = 420k, liq min(300k, 460k − 160k) = 300k, 482k) = 116k
    expect(r.dga!.consolidated).toBe(true)
    expect(r.dga!.tests!.maxBySolvency).toBeCloseTo(420000, 6)
    expect(r.income).toBe(70000 + 116000)
  })

  it("E10. holding met twee werkmaatschappijen (60% en 40%) en fiscale eenheid", () => {
    // W1 (100%) 60k integraal; W2 (40%) naar rato 40% × 40k = 16k; holding eigen resultaat 0 → 76k
    const ents: BvEntity[] = [
      { key: "h", name: "Holding", role: "holding", parentKey: null, ownershipPct: 100, financials: [2023, 2024, 2025].map((y) => bvYear(y, { revenue: 0, resultAfterTax: 0, equity: 50000, balanceTotal: 60000, liquidAssets: 50000, currentAssets: 50000, currentLiabilities: 5000, dgaSalaryPaid: 60000 })) },
      { key: "w1", name: "Werk 1", role: "werkmaatschappij", parentKey: "h", ownershipPct: 100, financials: [2023, 2024, 2025].map((y) => bvYear(y, { resultAfterTax: 60000, dgaSalaryPaid: 0 })) },
      { key: "w2", name: "Werk 2", role: "werkmaatschappij", parentKey: "h", ownershipPct: 40, financials: [2023, 2024, 2025].map((y) => bvYear(y, { resultAfterTax: 40000, dgaSalaryPaid: 0 })) },
    ]
    const c = consolidate(ents)
    expect(c[0]!.resultAfterTax).toBe(76000)
    const b = bv(ents, {}, { fiscalUnity: true })
    const r = businessIncome(b, P(), N)
    expect(r.income).toBe(60000 + 76000)
  })

  it("E11. lening bij de eigen BV onder de drempel van excessief lenen", () => {
    const r = excessiveBorrowing(N, [{ id: "l", amount: 300000, purpose: "overig", mortgageRight: false, existedBefore2023: false, ratePct: 5 }])
    expect(r.countedDebt).toBe(300000)
    expect(r.excess).toBe(0)
    expect(r.box2Tax).toBe(0)
  })

  it("E12. lening bij de eigen BV boven de drempel: excessief deel belast in box 2", () => {
    // 450k overig + 200k eigen woning zonder hypotheekrecht (na 2022) = 650k; eigen woning mét hypotheekrecht uitgezonderd
    // Excess 150k: 68.843 × 24,5% + 81.157 × 31% = 16.866,54 + 25.158,67 = 42.025,20
    const r = excessiveBorrowing(N, [
      { id: "a", amount: 450000, purpose: "overig", mortgageRight: false, existedBefore2023: false, ratePct: 5 },
      { id: "b", amount: 200000, purpose: "eigen_woning", mortgageRight: false, existedBefore2023: false, ratePct: 4 },
      { id: "c", amount: 300000, purpose: "eigen_woning", mortgageRight: true, existedBefore2023: false, ratePct: 4 },
      { id: "d", amount: 100000, purpose: "eigen_woning", mortgageRight: false, existedBefore2023: true, ratePct: 4 },
    ])
    expect(r.countedDebt).toBe(650000)
    expect(r.excludedDebt).toBe(400000)
    expect(r.excess).toBe(150000)
    expect(r.box2Tax).toBeCloseTo(68843 * 0.245 + 81157 * 0.31, 6)
  })

  it("E13. management fee niet contractueel vastgelegd: salaris uit de fee telt niet", () => {
    const b = bv(holdingEntities(), {}, {
      salaries: [{ year: 2025, amount: 70000 }],
      managementFee: { annual: 90000, contractual: false, structural: true, armsLength: true },
    })
    const r = businessIncome(b, P(), N)
    // Holding heeft geen andere inkomsten dan de fee → het hele salaris (70k) wordt uit de fee betaald
    expect(r.dga!.salaryCounted).toBe(0)
    expect(r.income).toBe(116000)
    expect(r.warnings.join(" ")).toMatch(/managementovereenkomst/)
  })

  it("E14. Inkomensverklaring Ondernemer (IVO) gaat voor bij banken die IVO accepteren", () => {
    const b = soleProp([40000, 50000, 60000], { ivoIncome: 55000 })
    expect(businessIncome(b, P({ ivoPolicy: "accepted" }), N).income).toBe(55000)
    const noIvo = soleProp([40000, 50000, 60000])
    const req = businessIncome(noIvo, P({ ivoPolicy: "required" }), N)
    expect(req.accepted).toBeNull()
  })

  it("E15. aandeelhouder onder de DGA-grens wordt als werknemer behandeld", () => {
    const b = bv(single([bvYear(2023), bvYear(2024), bvYear(2025)]), {}, { shareholdingPct: 4 })
    const r = businessIncome(b, P({ dgaThresholdPct: 5 }), N)
    expect(r.dga!.treatedAsEmployee).toBe(true)
    expect(r.income).toBe(60000)
  })

  it("E16. continuïteitsrisico: sterk schommelende winst geeft een waarschuwing", () => {
    const b = soleProp([20000, 80000, 30000], { largestClientPct: 70, sector: "horeca", startDate: "2024-06-01" })
    const r = continuityRisk(b, "2026-09-29")
    expect(r.volatile).toBe(true)
    expect(r.level).toBe("hoog")
    expect(r.warnings.length).toBeGreaterThanOrEqual(2)
  })

  it("E17. salaris verhogen vs. dividend: netto kosten en box 2", () => {
    // Dividend 10.000 → box 2: 10.000 × 24,5% = 2.450
    const r = salaryVsDividend(N, { delta: 10000, currentSalary: 60000, otherBox2Income: 0, bvProfitBeforeTax: 100000 })
    expect(r.dividend.box2Tax).toBeCloseTo(2450, 6)
    expect(r.salary.vpbSaving).toBeCloseTo(1900, 6) // 19% Vpb
    expect(r.salary.extraBox1Tax).toBeGreaterThan(3000)
  })

  it("E18. volledige flow DGA met holding: toetsinkomen per bank en ondernemershoofdstuk", () => {
    const b = bv(holdingEntities(), {}, {
      salaries: [{ year: 2025, amount: 70000 }],
      managementFee: { annual: 90000, contractual: true, structural: true, armsLength: true },
    })
    const out = runAdvice(
      baseInput({ applicants: [applicant({ incomes: [], businesses: [b] })], targetProperty: property({ purchasePrice: 600000 }) }),
      ctx
    )
    const ch = out.entrepreneur!
    expect(ch.businesses[0]!.perLender.length).toBeGreaterThanOrEqual(15)
    expect(ch.businesses[0]!.analysis!.consolidated).toBe(true)
    expect(ch.businesses[0]!.salaryVsDividend!.perLender.length).toBeGreaterThan(0)
    expect(ch.businesses[0]!.missingDocuments.length).toBeGreaterThan(0)
    const incomes = out.lenders.rows.filter((r) => r.active).map((r) => r.applicantIncome[0]!.income)
    expect(Math.max(...incomes)).toBe(186000)
  })
})
