/**
 * Anti-hallucinatiecheck: elk getal in een door het LLM geschreven tekst moet voorkomen in de
 * getallen die we het LLM hebben gegeven (de engine-uitvoer). Puur en getest.
 *
 * Toegestane afwijking: afronding. Een getal in de tekst matcht als een feitgetal na afronding
 * op 0, 1 of 2 decimalen (of op hele honderden/duizenden, zoals "ruim € 250.000") gelijk is.
 * Kleine telwoorden (0–12) zijn altijd toegestaan ("3 banken", "stap 2").
 */

export interface NumberCheckResult {
  ok: boolean
  numbersInText: number[]
  unmatched: number[]
}

/** Haal getallen uit Nederlandse tekst: "€ 1.234,56", "4,25%", "30 jaar", "250.000". */
export function extractNumbers(text: string): number[] {
  const out: number[] = []
  const re = /(?<![\w.,])-?\d{1,3}(?:\.\d{3})+(?:,\d+)?(?![\d])|(?<![\w.,])-?\d+(?:,\d+)?(?![\d.,]*\d)/g
  for (const m of text.matchAll(re)) {
    const raw = m[0]
    const n = Number(raw.replace(/\./g, "").replace(",", "."))
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

/** Verzamel alle numerieke waarden uit een (genest) object. */
export function collectNumbers(value: unknown, into: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) into.push(value)
  else if (Array.isArray(value)) for (const v of value) collectNumbers(v, into)
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectNumbers(v, into)
  return into
}

function variants(n: number): number[] {
  const abs = Math.abs(n)
  const out = [n, Math.round(n), Math.round(n * 10) / 10, Math.round(n * 100) / 100, Math.floor(n), Math.ceil(n)]
  if (abs >= 1000) out.push(Math.round(n / 100) * 100, Math.round(n / 1000) * 1000, Math.floor(n / 1000) * 1000)
  if (abs > 0 && abs <= 1) out.push(Math.round(n * 1000) / 10, Math.round(n * 100)) // fracties als procenten
  return out.flatMap((v) => [v, -v])
}

export function checkNumbers(text: string, facts: unknown): NumberCheckResult {
  const allowed = new Set<number>()
  for (const n of collectNumbers(facts)) for (const v of variants(n)) allowed.add(Number(v.toFixed(2)))
  const numbersInText = extractNumbers(text)
  const unmatched = numbersInText.filter((n) => {
    if (Number.isInteger(n) && n >= 0 && n <= 12) return false
    return !allowed.has(Number(n.toFixed(2)))
  })
  return { ok: unmatched.length === 0, numbersInText, unmatched }
}
