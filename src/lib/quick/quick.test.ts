import { describe, expect, it } from "vitest"
import { runAdvice } from "@/lib/engine"
import { ctx } from "@/lib/engine/__tests__/fixtures"
import type { MergedFinancials } from "@/lib/documents/financials"
import { STEP_SCHEMAS, type IntakeData } from "@/lib/intake/schema"
import { intakeToEngineInput } from "@/lib/intake/to-engine"
import { emptyLoanPart, emptyQuickApplicant, fillFromSuggestions, quickForm, quickFromIntake, quickToIntake, salarySuggestion, type QuickForm } from "./quick"

const YEAR = 2026

function base(goal: QuickForm["goal"]): QuickForm {
  const q = quickFromIntake({}, YEAR)
  q.goal = goal
  q.applicants[0] = { ...emptyQuickApplicant(), dateOfBirth: "1992-04-01", grossMonthlySalary: 5000 }
  q.savings = 40000
  return q
}

/** Stappen valideren zoals saveStep dat doet en samenvoegen tot een intake. */
function toIntake(steps: [string, unknown][]): IntakeData {
  const out: Record<string, unknown> = {}
  for (const [k, v] of steps) out[k] = STEP_SCHEMAS[k as keyof typeof STEP_SCHEMAS].parse(v)
  return out as IntakeData
}

const val = (value: number) => ({ value, confidence: 0.9, sourceIds: ["d1"] })

function bvFinancials(): MergedFinancials {
  return {
    entities: [
      {
        key: "werk",
        name: "Werk BV",
        role: "werkmaatschappij",
        ownershipPct: 100,
        parentName: "Holding BV",
        years: [2023, 2024, 2025].map((year) => ({
          year,
          isForecast: false,
          values: { revenue: val(400000), resultBeforeTax: val(90000), resultAfterTax: val(72000), equity: val(150000), balanceTotal: val(300000), liquidAssets: val(80000), currentLiabilities: val(60000) },
        })),
      },
      { key: "holding", name: "Holding BV", role: "holding", ownershipPct: null, parentName: null, years: [{ year: 2025, isForecast: false, values: { equity: val(200000), balanceTotal: val(210000) } }] },
    ],
    salaries: [],
    shareholdingPct: 100,
    conflicts: [],
  }
}

describe("snelle invoer → intake", () => {
  it("starter: alle stappen valide en de engine rekent", () => {
    const q = base("starter")
    q.targetHome.purchasePrice = 350000
    q.studentLoanMonthly = 120
    q.studentLoanOutstanding = 20000
    expect(quickForm.safeParse(q).success).toBe(true)
    const { steps } = quickToIntake(q, {}, [null, null], YEAR)
    const intake = toIntake(steps)
    expect(intake.persoonlijk!.applicants[0]!.previousHomeOwner).toBe(false)
    const emp = intake.inkomen!.applicants[0]!.incomes[0]!
    expect(emp.kind === "employment" && emp.grossAnnualSalary).toBe(60000)
    expect(emp.kind === "employment" && emp.holidayPay).toBe(4800)
    expect(intake.verplichtingen!.obligations).toHaveLength(1)
    expect(intake["huidige-woning"]).toBeUndefined()
    const out = runAdvice(intakeToEngineInput(intake, { calculationDate: "2026-03-01", referenceRatePct: 4 }), ctx)
    expect(out.capacity.maxMortgage).toBeGreaterThan(200000)
  })

  it("koopsom is verplicht voor een starter, woningwaarde voor oversluiten", () => {
    expect(quickForm.safeParse(base("starter")).success).toBe(false)
    expect(quickForm.safeParse(base("oversluiten")).success).toBe(false)
    expect(quickForm.safeParse(base("orientatie")).success).toBe(true)
  })

  it("doorstromer: leningdelen met afgeleide looptijd", () => {
    const q = base("doorstromer")
    q.targetHome.purchasePrice = 500000
    q.currentHome.marketValue = 400000
    q.currentHome.mortgageStartYear = 2010
    q.currentHome.loanParts = [
      { ...emptyLoanPart(YEAR), type: "interest_only", balance: 150000, ratePct: 4.2, fixedRateEndDate: "2030-01-01" },
      { ...emptyLoanPart(YEAR), balance: 0 },
    ]
    const intake = toIntake(quickToIntake(q, {}, [null, null], YEAR).steps)
    const ch = intake["huidige-woning"]!
    expect(ch.wozValue).toBe(400000)
    expect(ch.loanParts).toHaveLength(1)
    expect(ch.loanParts[0]!.endDate).toBe("2040-01-01")
    expect(ch.loanParts[0]!.startedBefore2013).toBe(true)
    expect(intake.persoonlijk!.applicants[0]!.previousHomeOwner).toBe(true)
    const out = runAdvice(intakeToEngineInput(intake, { calculationDate: "2026-03-01", referenceRatePct: 4 }), ctx)
    expect(out.capacity.maxMortgage).toBeGreaterThan(0)
  })

  it("DGA: jaarcijfers worden een BV met holding en het loonstrooksalaris telt als DGA-salaris", () => {
    const q = base("orientatie")
    q.applicants[0]!.salaryFromOwnBv = true
    const { steps } = quickToIntake(q, {}, [bvFinancials(), null], YEAR)
    const intake = toIntake(steps)
    expect(intake.inkomen!.applicants[0]!.isEntrepreneur).toBe(true)
    expect(intake.inkomen!.applicants[0]!.incomes).toHaveLength(0)
    const b = intake.ondernemer!.applicants[0]!.businesses[0]!
    expect(b.legalForm).toBe("bv_holding")
    expect(b.startDate).toBe("2023-01-01")
    expect(b.bv!.salaries).toEqual([{ year: YEAR, amount: 64800 }])
    expect(b.bv!.entities.find((e) => e.name === "Werk BV")!.financials.map((f) => f.year)).toEqual([2023, 2024, 2025])
    const out = runAdvice(intakeToEngineInput(intake, { calculationDate: "2026-03-01", referenceRatePct: 4 }), ctx)
    expect(out.capacity.maxMortgage).toBeGreaterThan(0)
  })

  it("eenmanszaak: alleen de jaren uit de cijfers, geen lege voorgevulde jaren", () => {
    const q = base("orientatie")
    q.applicants[0]!.grossMonthlySalary = 0
    const m: MergedFinancials = {
      entities: [{ key: "x", name: "Klus", role: "eenmanszaak", ownershipPct: null, parentName: null, years: [2022, 2023, 2024].map((year) => ({ year, isForecast: false, values: { resultBeforeTax: val(60000) } })) }],
      salaries: [],
      shareholdingPct: null,
      conflicts: [],
    }
    const intake = toIntake(quickToIntake(q, {}, [m, null], YEAR).steps)
    const b = intake.ondernemer!.applicants[0]!.businesses[0]!
    expect(b.legalForm).toBe("eenmanszaak")
    expect(b.soleProp!.years.map((y) => [y.year, y.profit])).toEqual([
      [2022, 60000],
      [2023, 60000],
      [2024, 60000],
    ])
  })

  it("bewaart details uit de uitgebreide intake", () => {
    const q = base("starter")
    q.targetHome.purchasePrice = 300000
    const first = toIntake(quickToIntake(q, {}, [null, null], YEAR).steps)
    first.persoonlijk!.children = 2
    const inc = first.inkomen!.applicants[0]!.incomes[0]!
    if (inc.kind === "employment") inc.irregularityAllowance = 3000
    first.verplichtingen!.obligations.push({ id: "lease", applicantPosition: 1, type: "private_lease", limitOrPrincipal: 0, monthlyPayment: 300, outstanding: 10000 })
    const again = toIntake(quickToIntake(quickFromIntake(first, YEAR), first, [null, null], YEAR).steps)
    expect(again.persoonlijk!.children).toBe(2)
    const e = again.inkomen!.applicants[0]!.incomes[0]!
    expect(e.kind === "employment" && e.irregularityAllowance).toBe(3000)
    expect(e.kind === "employment" && e.grossAnnualSalary).toBe(60000)
    expect(again.verplichtingen!.obligations.map((o) => o.type)).toEqual(["private_lease"])
  })
})

describe("salaris uit documenten", () => {
  it("werkgeversverklaring gaat vóór de loonstrook; nieuwste loonstrook wint", () => {
    const s = salarySuggestion([
      { type: "salarisstrook", createdAt: "2026-01-01T00:00:00Z", values: { bruto_maandsalaris: 4000, datum_document: "2025-12-31", geboortedatum: "1990-02-03" } },
      { type: "salarisstrook", createdAt: "2026-01-02T00:00:00Z", values: { bruto_maandsalaris: 4200, datum_document: "2026-01-31", vakantiegeld_pct: 8 } },
    ])
    expect(s).toMatchObject({ grossMonthlySalary: 4200, holidayPayPct: 8, dateOfBirth: "1990-02-03" })
    const w = salarySuggestion([
      { type: "werkgeversverklaring", createdAt: "2026-01-01T00:00:00Z", values: { bruto_jaarsalaris: 60000, vakantiegeld: 4800, dienstverband: "bepaalde tijd", intentieverklaring: true } },
      { type: "salarisstrook", createdAt: "2026-02-01T00:00:00Z", values: { bruto_maandsalaris: 4200 } },
    ])
    expect(w).toMatchObject({ grossMonthlySalary: 5000, holidayPayPct: 8, contract: "temporary_with_intent" })
  })

  it("vult alleen lege velden aan", () => {
    const q = base("orientatie")
    q.applicants[0]!.dateOfBirth = ""
    const filled = fillFromSuggestions(q, [{ grossMonthlySalary: 9999, dateOfBirth: "1990-01-01", date: "" }])
    expect(filled.applicants[0]!.grossMonthlySalary).toBe(5000)
    expect(filled.applicants[0]!.dateOfBirth).toBe("1990-01-01")
  })
})
