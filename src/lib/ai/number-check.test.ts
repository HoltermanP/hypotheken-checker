import { describe, expect, it } from "vitest"
import { buildFacts } from "@/lib/advice/facts"
import { templateTexts } from "@/lib/advice/template"
import { runAdvice } from "@/lib/engine"
import { baseInput, ctx } from "@/lib/engine/__tests__/fixtures"
import { checkNumbers, collectNumbers, extractNumbers } from "./number-check"

describe("anti-hallucinatiecheck", () => {
  it("haalt Nederlandse getallen uit tekst", () => {
    expect(extractNumbers("Je leent € 219.242 tegen 4,25% over 30 jaar; 1.234,56 en -5")).toEqual([219242, 4.25, 30, 1234.56, -5])
    expect(extractNumbers("geen getallen")).toEqual([])
  })
  it("accepteert getallen uit de feiten (ook afgerond) en weigert verzonnen getallen", () => {
    const facts = { max: 219242.4, rente: 4.253, jaren: 30, deel: 0.375 }
    expect(checkNumbers("Maximaal € 219.242 tegen 4,25% (30 jaar).", facts).ok).toBe(true)
    expect(checkNumbers("Ruim € 219.000.", facts).ok).toBe(true)
    expect(checkNumbers("Dat is 37,5% van het totaal.", facts).ok).toBe(true)
    expect(checkNumbers("3 banken, stap 2", facts).ok).toBe(true)
    const bad = checkNumbers("Je kunt € 250.000 lenen tegen 3,9%.", facts)
    expect(bad.ok).toBe(false)
    expect(bad.unmatched).toEqual([250000, 3.9])
  })
  it("de vaste templatetekst doorstaat altijd de check", () => {
    const out = runAdvice(baseInput(), ctx)
    const facts = buildFacts(out)
    const texts = templateTexts(facts)
    for (const t of Object.values(texts)) {
      if (!t) continue
      const r = checkNumbers(t, facts)
      expect(r.unmatched, t).toEqual([])
    }
    expect(collectNumbers({ a: [1, { b: 2 }], c: "3" })).toEqual([1, 2])
  })
})
