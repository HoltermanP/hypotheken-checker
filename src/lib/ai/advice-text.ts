import "server-only"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"
import { z } from "zod"
import type { AdviceFacts } from "@/lib/advice/facts"
import { templateTexts, type AdviceTexts } from "@/lib/advice/template"
import { getAnthropic, reportModel } from "./client"
import { checkNumbers } from "./number-check"

/**
 * Toelichtende adviesteksten door Claude, op basis van UITSLUITEND de feiten uit de engine.
 * Daarna controleert `checkNumbers` of elk getal in de tekst in de feiten voorkomt. Faalt dat, dan
 * volgt één nieuwe poging met de afwijkende getallen als feedback; daarna de vaste template.
 */

const textsSchema = z.object({
  samenvatting: z.string(),
  maximaleHypotheek: z.string(),
  financiering: z.string(),
  bankadvies: z.string(),
  risico: z.string(),
  ondernemer: z.string().nullable(),
  overwaarde: z.string().nullable(),
})

const SYSTEM = `Je schrijft de toelichting bij een indicatief hypotheekadvies voor een consument in Nederland.

Regels:
- Schrijf in helder Nederlands op B1-niveau, in de je-vorm, zakelijk en vriendelijk. Per onderdeel 2 tot 5 zinnen.
- Gebruik UITSLUITEND de getallen uit de meegegeven feiten (JSON). Reken niets zelf uit, tel niets op en rond niet anders af dan hele euro's.
- Noteer bedragen als "€ 1.234" en percentages als "4,25%".
- Geef geen productadvies dat verder gaat dan de feiten; dit is geen financieel advies in de zin van de Wft.
- Zet "ondernemer" op null als de feiten geen ondernemers bevatten, en "overwaarde" op null als er geen overwaarde-opties zijn.`

export interface GeneratedTexts {
  texts: AdviceTexts
  source: "llm" | "template"
  model: string | null
  numberCheckPassed: boolean
}

function failing(texts: AdviceTexts, facts: AdviceFacts): number[] {
  return Object.values(texts).flatMap((t) => (t ? checkNumbers(t, facts).unmatched : []))
}

export async function generateAdviceTexts(facts: AdviceFacts): Promise<GeneratedTexts> {
  const fallback = templateTexts(facts)
  const client = getAnthropic()
  if (!client) return { texts: fallback, source: "template", model: null, numberCheckPassed: true }
  const model = reportModel()
  const ask = async (feedback?: number[]) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(textsSchema) },
      messages: [
        {
          role: "user",
          content:
            `Feiten (JSON):\n${JSON.stringify(facts)}` +
            (feedback ? `\n\nIn je vorige versie stonden getallen die niet in de feiten voorkomen: ${feedback.join(", ")}. Gebruik alleen getallen uit de feiten.` : ""),
        },
      ],
    })
    if (response.stop_reason === "refusal" || !response.parsed_output) return null
    const p = response.parsed_output
    const texts: AdviceTexts = {
      ...p,
      ondernemer: facts.ondernemers?.length ? p.ondernemer : null,
      overwaarde: facts.overwaardeOpties?.length ? p.overwaarde : null,
    }
    return texts
  }
  try {
    const first = await ask()
    if (first) {
      const bad = failing(first, facts)
      if (bad.length === 0) return { texts: first, source: "llm", model, numberCheckPassed: true }
      const second = await ask(bad)
      if (second && failing(second, facts).length === 0) return { texts: second, source: "llm", model, numberCheckPassed: true }
    }
  } catch (err) {
    console.error("Adviestekst genereren mislukt:", (err as Error).name)
  }
  return { texts: fallback, source: "template", model: null, numberCheckPassed: true }
}
