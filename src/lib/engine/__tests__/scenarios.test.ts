import { describe, expect, it } from "vitest"
import { applyOverrides, estimateReferenceRate, runScenarios, suggestScenarios } from "../scenarios/scenarios"
import { applicant, baseInput, ctx, property, salary } from "./fixtures"
import { bv, bvYear } from "./fixtures-entrepreneur"

describe("scenario's", () => {
  const couple = baseInput({
    applicants: [applicant({ incomes: [salary(60000)] }), applicant({ id: "a2", incomes: [salary(45000)] })],
    targetProperty: property({ purchasePrice: 420000 }),
    assets: { savings: 80000, investments: 0, giftAmount: 0, familyLoanAmount: 0, familyLoanRatePct: 0, eigenwoningreserve: 0, desiredBuffer: 15000 },
  })

  it("referentierente is de mediaan van de bankrentes", () => {
    const r = estimateReferenceRate(couple, ctx)
    expect(r).toBeGreaterThan(3)
    expect(r).toBeLessThan(6)
    expect(estimateReferenceRate(baseInput({ targetProperty: null, goal: "orientatie" }), ctx)).toBeGreaterThan(3)
  })

  it("stelt maximaal 4 scenario's voor en rekent ze door", () => {
    const defs = suggestScenarios(couple)
    expect(defs.length).toBeLessThanOrEqual(4)
    expect(defs[0]!.id).toBe("basis")
    const res = runScenarios(couple, defs, ctx)
    expect(res).toHaveLength(defs.length)
    const noNhg = res.find((r) => r.id === "nhg")!
    expect(noNhg.nhg).toBe(false)
    const twenty = res.find((r) => r.id === "rentevast")!
    expect(twenty.ratePct).not.toBe(res[0]!.ratePct)
  })

  it("overrides: eigen geld, volgorde, prijs, looptijd", () => {
    const i = applyOverrides(couple, { ownFunds: "none", purchasePrice: 380000, termMonths: 300, repaymentType: "linear", ratePct: 4.1, moveOrder: "sell_first" }, ctx)
    expect(i.assets.ownFundsToContribute).toBe(0)
    expect(i.targetProperty!.purchasePrice).toBe(380000)
    expect(i.preferences.termMonths).toBe(300)
    expect(i.referenceRatePct).toBe(4.1)
    expect(i.move!.order).toBe("sell_first")
    expect(applyOverrides(couple, { ownFunds: 5000 }, ctx).assets.ownFundsToContribute).toBe(5000)
    expect(applyOverrides(couple, { ownFunds: "all" }, ctx).assets.ownFundsToContribute).toBe(65000)
  })

  it("DGA: salarisverhoging en hypotheek bij eigen BV", () => {
    const dga = baseInput({
      applicants: [applicant({ incomes: [], businesses: [bv([{ key: "bv", name: "BV", role: "werkmaatschappij", parentKey: null, ownershipPct: 100, financials: [bvYear(2023), bvYear(2024), bvYear(2025)] }])] })],
      goal: "doorstromer",
      currentProperty: { wozValue: 300000, marketValue: 320000, expectedSalePrice: 320000, energyLabel: "C", loanParts: [] },
    })
    const defs = suggestScenarios(dga)
    expect(defs.map((d) => d.id)).toEqual(expect.arrayContaining(["salaris", "eigen_bv", "volgorde"]))
    const res = runScenarios(dga, defs, ctx)
    expect(res.find((r) => r.id === "eigen_bv")!.notes.join()).toMatch(/eigen BV/)
    expect(res.find((r) => r.id === "salaris")!.notes.length).toBeGreaterThan(0)
  })
})
