import "server-only"
import type Anthropic from "@anthropic-ai/sdk"
import { buildFacts } from "@/lib/advice/facts"
import type { AdviceOutput } from "@/lib/engine"
import { aiModel, getAnthropic } from "./client"
import { checkNumbers } from "./number-check"

/**
 * Dossier-chat: beantwoordt vragen ("waarom kan ik bij bank X minder lenen?") op basis van
 * UITSLUITEND de dossiergegevens en de engine-uitvoer, met bronvermelding. Getallen in het
 * antwoord worden gecontroleerd tegen dezelfde context.
 */

export function chatContext(out: AdviceOutput) {
  return {
    feiten: buildFacts(out),
    banken: out.lenders.rows.map((r) => ({
      bank: r.name,
      acceptatie: r.accepted === false ? "nee" : r.accepted === null ? "onder voorbehoud" : "ja",
      past: r.fits,
      toetsinkomen: Math.round(r.toetsinkomen),
      maximaleLeenruimte: Math.round(r.maxLoan),
      rentePct: r.ratePct,
      renteDatum: r.rateDate,
      nettoMaandlast: r.netMonthlyYear1 !== null ? Math.round(r.netMonthlyYear1) : null,
      totaleKostenRentevast: r.totalCostsFixedPeriod !== null ? Math.round(r.totalCostsFixedPeriod) : null,
      redenen: r.reasons.slice(0, 6),
      ondernemersinkomen: r.applicantIncome.flatMap((a) => a.business.map((b) => ({ methode: b.method, inkomen: Math.round(b.income), uitleg: b.explanation.slice(0, 3) }))),
    })),
    controles: out.checks.map((c) => ({ toets: c.label, resultaat: c.status, toelichting: c.detail })),
    bronnen: out.assumptions.map((a) => ({ sleutel: a.key, naam: a.label, url: a.sourceUrl, status: a.status })),
  }
}

const SYSTEM = `Je bent de assistent bij een indicatief hypotheekadvies van HypotheekCheck NL.

Regels:
- Beantwoord vragen UITSLUITEND op basis van de context (JSON) met dossiergegevens en berekeningsuitkomsten. Weet je het niet op basis van de context, zeg dat dan en verwijs naar een erkend hypotheekadviseur.
- Reken niets zelf uit. Gebruik alleen getallen die letterlijk in de context staan (bedragen als "€ 1.234", percentages als "4,25%").
- Vermeld je bronnen: verwijs naar het onderdeel van het rapport (bijv. "rapport: Bankadvies") en, als je een norm noemt, naar de bron uit "bronnen" met naam en URL.
- Schrijf kort en helder in het Nederlands (B1), in de je-vorm.
- Dit is geen financieel advies in de zin van de Wft.`

export async function answerChat(out: AdviceOutput, history: { role: "user" | "assistant"; content: string }[], question: string): Promise<string> {
  const client = getAnthropic()
  if (!client) return "De chat-assistent is niet beschikbaar omdat er geen AI-sleutel is ingesteld. Je vindt de onderbouwing in het rapport."
  const context = chatContext(out)
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Context (JSON):\n${JSON.stringify(context)}` },
    { role: "assistant", content: "Ik heb de context gelezen. Wat is je vraag?" },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ]
  const ask = async (extra?: string) => {
    const r = await client.messages.create({
      model: aiModel(),
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages: extra ? [...messages, { role: "assistant", content: "…" }, { role: "user", content: extra }] : messages,
    })
    if (r.stop_reason === "refusal") return null
    return r.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
  }
  const first = await ask()
  if (first) {
    const c = checkNumbers(first, context)
    if (c.ok) return first
    const second = await ask(`Je antwoord bevatte getallen die niet in de context staan (${c.unmatched.join(", ")}). Beantwoord mijn vorige vraag opnieuw met alleen getallen uit de context.`)
    if (second && checkNumbers(second, context).ok) return second
  }
  return "Ik kan deze vraag niet betrouwbaar beantwoorden met de gegevens uit je dossier. Bekijk het rapport (onderdelen Bankadvies en Gecheckt op) of vraag het een erkend hypotheekadviseur."
}
