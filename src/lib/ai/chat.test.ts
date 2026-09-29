import { beforeEach, describe, expect, it, vi } from "vitest"
import { runAdvice } from "@/lib/engine"
import { baseInput, ctx } from "@/lib/engine/__tests__/fixtures"

const create = vi.fn()
let hasClient = true
vi.mock("./client", () => ({ getAnthropic: () => (hasClient ? { messages: { create } } : null), aiModel: () => "claude-sonnet-5" }))
const { answerChat, chatContext } = await import("./chat")

const out = runAdvice(baseInput(), ctx)
const text = (t: string) => ({ stop_reason: "end_turn", content: [{ type: "text", text: t }] })

describe("dossier-chat", () => {
  beforeEach(() => {
    create.mockReset()
    hasClient = true
  })
  it("bevat banken, controles en bronnen in de context", () => {
    const c = chatContext(out)
    expect(c.banken.length).toBeGreaterThanOrEqual(15)
    expect(c.bronnen.some((b) => b.url)).toBe(true)
  })
  it("geeft een antwoord met getallen uit de context", async () => {
    create.mockResolvedValueOnce(text(`Je maximale hypotheek is € ${out.summary.maxMortgage.toLocaleString("nl-NL")} (rapport: Maximale hypotheek).`))
    expect(await answerChat(out, [], "Hoeveel kan ik lenen?")).toContain("rapport")
  })
  it("verzonnen getallen: nieuwe poging, anders veilig antwoord", async () => {
    create.mockResolvedValue(text("Je kunt € 987.654 lenen."))
    const a = await answerChat(out, [{ role: "user", content: "x" }, { role: "assistant", content: "y" }], "Hoeveel?")
    expect(a).toMatch(/niet betrouwbaar/)
    expect(create).toHaveBeenCalledTimes(2)
    create.mockReset()
    create.mockResolvedValue({ stop_reason: "refusal", content: [] })
    expect(await answerChat(out, [], "?")).toMatch(/niet betrouwbaar/)
  })
  it("zonder API-sleutel", async () => {
    hasClient = false
    expect(await answerChat(out, [], "?")).toMatch(/niet beschikbaar/)
  })
})
