import { describe, expect, it } from "vitest"
import { runAdvice } from "@/lib/engine"
import { ctx } from "@/lib/engine/__tests__/fixtures"
import {
  defaultAssets,
  defaultBusiness,
  defaultCurrentHome,
  defaultIncome,
  defaultPersonal,
  defaultPreferences,
  defaultRisks,
  defaultTargetHome,
} from "./defaults"
import { STEP_SCHEMAS, type IntakeData } from "./schema"
import { applicableSteps, missingSteps, nextStep, prevStep } from "./steps"
import { IntakeIncompleteError, intakeToEngineInput } from "./to-engine"

function fullIntake(goal: NonNullable<IntakeData["doel"]>["goal"]): IntakeData {
  const personal = defaultPersonal()
  personal.applicants[0]!.dateOfBirth = "1992-04-01"
  const income = defaultIncome(1)
  const emp = income.applicants[0]!.incomes[0]!
  if (emp.kind === "employment") emp.grossAnnualSalary = 60000
  const assets = { ...defaultAssets(), savings: 50000 }
  const target = { ...defaultTargetHome(), purchasePrice: 325000 }
  const current = {
    ...defaultCurrentHome(),
    wozValue: 300000,
    marketValue: 320000,
    expectedSalePrice: 320000,
    loanParts: [
      { id: "p", type: "annuity" as const, balance: 180000, ratePct: 2.1, fixedRateEndDate: "2030-01-01", endDate: "2048-01-01", startedBefore2013: false, nhg: false, portOnMove: true },
    ],
  }
  return {
    doel: { goal },
    persoonlijk: personal,
    inkomen: income,
    verplichtingen: { obligations: [] },
    vermogen: assets,
    "huidige-woning": ["doorstromer", "oversluiten", "verhogen", "verkopen"].includes(goal) ? current : undefined,
    "nieuwe-woning": ["starter", "doorstromer", "orientatie"].includes(goal) ? target : undefined,
    voorkeuren: { ...defaultPreferences(), equityReleaseAmount: 20000 },
    risicos: defaultRisks(1),
  }
}

describe("intake", () => {
  it("standaardwaarden zijn geldig na het invullen van de verplichte velden", () => {
    const i = fullIntake("starter")
    expect(STEP_SCHEMAS.persoonlijk.safeParse(i.persoonlijk).success).toBe(true)
    expect(STEP_SCHEMAS.inkomen.safeParse(i.inkomen).success).toBe(true)
    expect(STEP_SCHEMAS.vermogen.safeParse(i.vermogen).success).toBe(true)
    expect(STEP_SCHEMAS["nieuwe-woning"].safeParse(i["nieuwe-woning"]).success).toBe(true)
    expect(STEP_SCHEMAS.voorkeuren.safeParse(i.voorkeuren).success).toBe(true)
    expect(STEP_SCHEMAS.risicos.safeParse(i.risicos).success).toBe(true)
    expect(STEP_SCHEMAS.persoonlijk.safeParse(defaultPersonal()).success).toBe(false) // geboortedatum leeg
  })

  it("conditionele stappen per doel en profiel", () => {
    const keys = (i: IntakeData) => applicableSteps(i).map((s) => s.key)
    expect(keys(fullIntake("starter"))).not.toContain("huidige-woning")
    expect(keys(fullIntake("doorstromer"))).toEqual(expect.arrayContaining(["huidige-woning", "nieuwe-woning"]))
    expect(keys(fullIntake("verhogen"))).not.toContain("nieuwe-woning")
    const ent = fullIntake("starter")
    ent.inkomen!.applicants[0]!.isEntrepreneur = true
    expect(keys(ent)).toContain("ondernemer")
    const ori = fullIntake("orientatie")
    expect(applicableSteps(ori).find((s) => s.key === "nieuwe-woning")!.optional).toBe(true)
    expect(nextStep(ori, "vermogen")).toBe("nieuwe-woning")
    expect(prevStep(ori, "doel")).toBeNull()
    expect(missingSteps({ doel: { goal: "starter" } }).map((s) => s.key)).toContain("persoonlijk")
  })

  it("zet een volledige intake om naar engine-invoer voor alle doelen", () => {
    for (const goal of ["starter", "doorstromer", "oversluiten", "verhogen", "verkopen", "orientatie"] as const) {
      const input = intakeToEngineInput(fullIntake(goal), { calculationDate: "2026-09-29", referenceRatePct: 4.2 })
      expect(input.goal).toBe(goal)
      const out = runAdvice(input, ctx)
      expect(out.engineVersion).toBeTruthy()
    }
    const d = intakeToEngineInput(fullIntake("doorstromer"), { calculationDate: "2026-09-29", referenceRatePct: 4.2 })
    expect(d.move?.order).toBe("sell_first")
    expect(d.currentProperty?.loanParts[0]!.portOnMove).toBe(true)
    const v = intakeToEngineInput(fullIntake("verhogen"), { calculationDate: "2026-09-29", referenceRatePct: 4.2 })
    expect(v.equityRelease?.amount).toBe(20000)
    const o = intakeToEngineInput(fullIntake("orientatie"), { calculationDate: "2026-09-29", referenceRatePct: 4.2, skipped: ["nieuwe-woning"] })
    expect(o.targetProperty).toBeNull()
  })

  it("ondernemer: BV-entiteiten met parentKey '' worden null", () => {
    const i = fullIntake("starter")
    i.inkomen!.applicants[0]!.isEntrepreneur = true
    const b = defaultBusiness(2026)
    b.legalForm = "bv"
    b.startDate = "2018-01-01"
    b.bv!.entities[0]!.parentKey = ""
    i.ondernemer = { applicants: [{ businesses: [b] }] }
    const input = intakeToEngineInput(i, { calculationDate: "2026-09-29", referenceRatePct: 4.2 })
    expect(input.applicants[0]!.businesses[0]!.bv!.entities[0]!.parentKey).toBeNull()
    expect(input.applicants[0]!.businesses[0]!.soleProp).toBeUndefined()
    expect(STEP_SCHEMAS.ondernemer.safeParse(i.ondernemer).success).toBe(true)
  })

  it("onvolledige intake geeft een duidelijke fout", () => {
    expect(() => intakeToEngineInput({ doel: { goal: "doorstromer" } }, { calculationDate: "2026-09-29", referenceRatePct: 4 })).toThrow(IntakeIncompleteError)
    try {
      intakeToEngineInput({}, { calculationDate: "2026-09-29", referenceRatePct: 4 })
    } catch (e) {
      expect((e as IntakeIncompleteError).missing).toEqual(expect.arrayContaining(["doel", "persoonlijk", "inkomen"]))
    }
  })
})
