import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildFacts } from "@/lib/advice/facts"
import { runAdvice } from "@/lib/engine"
import { baseInput, ctx } from "@/lib/engine/__tests__/fixtures"

const parse = vi.fn()
let hasClient = true
vi.mock("./client", () => ({
  getAnthropic: () => (hasClient ? { messages: { parse } } : null),
  reportModel: () => "claude-sonnet-5",
}))

const { generateAdviceTexts } = await import("./advice-text")

const facts = buildFacts(runAdvice(baseInput(), ctx))
const good = (max: number) => ({
  samenvatting: `Je kunt maximaal € ${max.toLocaleString("nl-NL")} lenen.`,
  maximaleHypotheek: "Je inkomen is bepalend.",
  financiering: "De financiering is bijna rond.",
  bankadvies: "Er zijn 3 banken in de top.",
  risico: "Houd een buffer aan.",
  ondernemer: "niet van toepassing",
  overwaarde: null,
})
const response = (parsed: unknown) => ({ stop_reason: "end_turn", parsed_output: parsed })

describe("AI-adviesteksten met getallencheck", () => {
  beforeEach(() => {
    parse.mockReset()
    hasClient = true
  })
  it("accepteert tekst waarvan alle getallen kloppen", async () => {
    parse.mockResolvedValueOnce(response(good(facts.maximaleHypotheek)))
    const r = await generateAdviceTexts(facts)
    expect(r.source).toBe("llm")
    expect(r.texts.ondernemer).toBeNull() // geen ondernemers in de feiten
    expect(parse).toHaveBeenCalledTimes(1)
  })
  it("probeert opnieuw bij een verzonnen getal en accepteert de verbeterde versie", async () => {
    parse.mockResolvedValueOnce(response(good(999999))).mockResolvedValueOnce(response(good(facts.maximaleHypotheek)))
    const r = await generateAdviceTexts(facts)
    expect(r.source).toBe("llm")
    expect(parse).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(parse.mock.calls[1]![0])).toContain("999999")
  })
  it("valt terug op de template na twee mislukte pogingen, bij weigering of fouten", async () => {
    parse.mockResolvedValue(response(good(999999)))
    expect((await generateAdviceTexts(facts)).source).toBe("template")
    parse.mockReset()
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null })
    expect((await generateAdviceTexts(facts)).source).toBe("template")
    parse.mockReset()
    parse.mockRejectedValue(new Error("netwerk"))
    expect((await generateAdviceTexts(facts)).source).toBe("template")
  })
  it("zonder API-sleutel: template", async () => {
    hasClient = false
    const r = await generateAdviceTexts(facts)
    expect(r.source).toBe("template")
    expect(r.texts.samenvatting).toContain("€")
  })
})
