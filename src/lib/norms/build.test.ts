import { describe, expect, it } from "vitest"
import { buildNormSet, dutchNumber, NormBuildError, parseAkFormula, SEED_ENTRIES, seedNormSet } from "./index"
import { parseAkFormula as parseAk } from "./build"

describe("normen bouwen", () => {
  it("bouwt 2025 en 2026 uit de seed", () => {
    const s25 = seedNormSet(2025)
    const s26 = seedNormSet(2026)
    expect(s25.values.nhg.kostengrens).toBe(450000)
    expect(s26.values.nhg.kostengrens).toBe(470000)
    expect(s26.values.tax.hillenStepPct).toBeCloseTo(4.8, 6)
    expect(s26.version).toBe("2026.1")
    expect(seedNormSet(2026)).toBe(s26) // cache
    expect(() => seedNormSet(1999)).toThrow()
  })
  it("elke seednorm heeft een bron of is gemarkeerd als needs_verification", () => {
    for (const year of [2025, 2026]) {
      for (const e of SEED_ENTRIES[year]!) {
        expect(e.status === "needs_verification" || !!e.sourceUrl, `${year} ${e.key}`).toBe(true)
      }
    }
  })
  it("parseert Nederlandse getallen en arbeidskortingsformules", () => {
    expect(dutchNumber("1.234,56")).toBe(1234.56)
    expect(parseAkFormula("996 + 31,009% x (ai - 11.965)")).toEqual([996, 31.009])
    expect(parseAkFormula("5.685 - 6,510% x (ai - 45.592)")).toEqual([5685, -6.51])
    expect(parseAkFormula("8,324% x arbeidsinkomen")).toEqual([0, 8.324])
    expect(parseAk("0")).toEqual([0, 0])
    expect(() => parseAkFormula("onzin")).toThrow(NormBuildError)
  })
  it("geeft een duidelijke fout bij een ontbrekende norm", () => {
    const entries = SEED_ENTRIES[2026]!.filter((e) => e.key !== "nhg.kostengrens")
    expect(() => buildNormSet(entries, { year: 2026, version: "x" })).toThrow(/nhg.kostengrens ontbreekt/)
    const bad = SEED_ENTRIES[2026]!.map((e) => (e.key === "trhk.toetsrente_afm" ? { ...e, value: "vijf" } : e))
    expect(() => buildNormSet(bad, { year: 2026, version: "x" })).toThrow(/verwacht een getal/)
  })
})
