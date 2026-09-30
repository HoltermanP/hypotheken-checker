import { z } from "zod"
import { redactDeep } from "./bsn"

/**
 * Jaarcijfers van ondernemers uit bestanden (jaarrekening-pdf, Excel/CSV, jaaroverzicht DGA,
 * IB-/Vpb-aangifte). Eén document kan meerdere jaren en meerdere entiteiten (holding,
 * werkmaatschappij, geconsolideerd) bevatten. Meerdere bestanden worden samengevoegd; bij
 * tegenstrijdige waarden melden we een conflict. Puur en isomorf; het
 * Excel-deel staat in financials-xlsx.ts (houdt de xlsx-bibliotheek uit de browserbundel).
 */

// ----------------------------------------------------------------------------- velden

export const FIN_FIELDS = [
  { key: "revenue", label: "Omzet" },
  { key: "resultBeforeTax", label: "Resultaat vóór belasting" },
  { key: "corporateTax", label: "Vennootschapsbelasting" },
  { key: "resultAfterTax", label: "Resultaat na belasting" },
  { key: "incidentalItems", label: "Incidentele posten (vóór belasting, + = bate)" },
  { key: "dividendPaid", label: "Uitgekeerd dividend" },
  { key: "retainedEarnings", label: "Winstreserves / overige reserves" },
  { key: "equity", label: "Eigen vermogen" },
  { key: "issuedCapital", label: "Geplaatst kapitaal" },
  { key: "balanceTotal", label: "Balanstotaal" },
  { key: "liquidAssets", label: "Liquide middelen" },
  { key: "currentAssets", label: "Vlottende activa (incl. liquide middelen)" },
  { key: "currentLiabilities", label: "Kortlopende schulden" },
  { key: "longTermLiabilities", label: "Langlopende schulden" },
  { key: "dgaSalaryPaid", label: "Salaris DGA (betaald door deze entiteit)" },
  { key: "managementFeeReceived", label: "Ontvangen management fee" },
  { key: "managementFeePaid", label: "Betaalde management fee" },
  { key: "resultFromParticipations", label: "Resultaat deelnemingen" },
  { key: "participationsValue", label: "Boekwaarde deelnemingen" },
  { key: "intercompanyReceivables", label: "Vorderingen op groepsmaatschappijen" },
  { key: "intercompanyPayables", label: "Schulden aan groepsmaatschappijen" },
  { key: "currentAccountDga", label: "Rekening-courant DGA (vordering op DGA)" },
] as const

export type FinFieldKey = (typeof FIN_FIELDS)[number]["key"]
export type YearValues = Partial<Record<FinFieldKey, number | null>>

const nullableNumber = z.number().nullable()
const yearShape = Object.fromEntries(FIN_FIELDS.map((f) => [f.key, nullableNumber])) as Record<FinFieldKey, typeof nullableNumber>

/** Structured-output-schema voor het model. */
export const financialsModelSchema = z.object({
  documentKind: z.enum(["jaarrekening", "spreadsheet", "jaaroverzicht_dga", "ib_aangifte", "vpb_aangifte", "tussentijdse_cijfers", "overig"]),
  entities: z.array(
    z.object({
      name: z.string(),
      role: z.enum(["holding", "werkmaatschappij", "geconsolideerd", "eenmanszaak", "onbekend"]),
      ownershipPct: z.number().nullable(),
      parentName: z.string().nullable(),
      years: z.array(z.object({ year: z.number(), isForecast: z.boolean(), confidence: z.number(), ...yearShape })),
    })
  ),
  dgaSalaries: z.array(z.object({ year: z.number(), amount: z.number(), confidence: z.number() })),
  shareholdingPct: z.number().nullable(),
  warnings: z.array(z.string()),
})

export type FinancialsModelOutput = z.infer<typeof financialsModelSchema>

export interface FinEntityYear {
  year: number
  isForecast: boolean
  confidence: number
  values: YearValues
}

export interface FinEntity {
  name: string
  role: "holding" | "werkmaatschappij" | "geconsolideerd" | "eenmanszaak" | "onbekend"
  ownershipPct: number | null
  parentName: string | null
  years: FinEntityYear[]
}

export interface FinancialsExtraction {
  kind: "financials"
  documentKind: FinancialsModelOutput["documentKind"]
  source: "ai" | "template" | "manual"
  entities: FinEntity[]
  dgaSalaries: { year: number; amount: number; confidence: number }[]
  shareholdingPct: number | null
  warnings: string[]
  model: string
  extractedAt: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
export const validYear = (y: number) => Number.isInteger(y) && y >= 1990 && y <= 2100

export function normalizeFinancials(raw: FinancialsModelOutput, source: FinancialsExtraction["source"], model: string, now: string): FinancialsExtraction {
  const entities: FinEntity[] = raw.entities
    .map((e) => ({
      name: e.name.trim().slice(0, 80) || "Onderneming",
      role: e.role,
      ownershipPct: e.ownershipPct !== null && e.ownershipPct >= 0 && e.ownershipPct <= 100 ? e.ownershipPct : null,
      parentName: e.parentName?.trim() || null,
      years: e.years
        .filter((y) => validYear(y.year))
        .map((y) => {
          const values: YearValues = {}
          for (const f of FIN_FIELDS) {
            const v = y[f.key]
            if (typeof v === "number" && Number.isFinite(v)) values[f.key] = Math.round(v)
          }
          return { year: y.year, isForecast: y.isForecast, confidence: clamp01(y.confidence), values }
        })
        .filter((y) => Object.keys(y.values).length > 0)
        .sort((a, b) => a.year - b.year),
    }))
    .filter((e) => e.years.length > 0)
  return redactDeep({
    kind: "financials" as const,
    documentKind: raw.documentKind,
    source,
    entities,
    dgaSalaries: raw.dgaSalaries.filter((s) => validYear(s.year) && s.amount >= 0).map((s) => ({ year: s.year, amount: Math.round(s.amount), confidence: clamp01(s.confidence) })),
    shareholdingPct: raw.shareholdingPct !== null && raw.shareholdingPct > 0 && raw.shareholdingPct <= 100 ? raw.shareholdingPct : null,
    warnings: raw.warnings.slice(0, 10).map((w) => w.slice(0, 300)),
    model,
    extractedAt: now,
  })
}

// ----------------------------------------------------------------------------- samenvoegen

export function entityKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(b\.?\s?v\.?|bv|holding|beheer|n\.?v\.?)\b/g, (m) => (m.includes("holding") || m.includes("beheer") ? "holding" : ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export interface MergedValue {
  value: number
  confidence: number
  sourceIds: string[]
}

export interface MergedEntity {
  key: string
  name: string
  role: FinEntity["role"]
  ownershipPct: number | null
  parentName: string | null
  years: { year: number; isForecast: boolean; values: Partial<Record<FinFieldKey, MergedValue>> }[]
}

export interface MergedFinancials {
  entities: MergedEntity[]
  salaries: { year: number; amount: number; sourceIds: string[] }[]
  shareholdingPct: number | null
  conflicts: string[]
}

const differs = (a: number, b: number) => Math.abs(a - b) > Math.max(1, Math.abs(Math.max(Math.abs(a), Math.abs(b))) * 0.01)

/** Voeg extracties van meerdere bestanden samen. De waarde met de hoogste betrouwbaarheid wint. */
export function mergeFinancials(items: { id: string; extraction: FinancialsExtraction }[]): MergedFinancials {
  const map = new Map<string, MergedEntity>()
  const conflicts: string[] = []
  const salaries = new Map<number, { amount: number; confidence: number; sourceIds: string[] }>()
  let shareholdingPct: number | null = null
  for (const { id, extraction } of items) {
    if (extraction.shareholdingPct !== null) shareholdingPct = extraction.shareholdingPct
    for (const s of extraction.dgaSalaries) {
      const cur = salaries.get(s.year)
      if (!cur) salaries.set(s.year, { amount: s.amount, confidence: s.confidence, sourceIds: [id] })
      else {
        if (differs(cur.amount, s.amount)) conflicts.push(`DGA-salaris ${s.year}: ${cur.amount} en ${s.amount} in verschillende bestanden.`)
        if (s.confidence > cur.confidence) salaries.set(s.year, { amount: s.amount, confidence: s.confidence, sourceIds: [...cur.sourceIds, id] })
        else cur.sourceIds.push(id)
      }
    }
    for (const e of extraction.entities) {
      const key = e.role === "geconsolideerd" ? "__geconsolideerd" : entityKey(e.name) || entityKey(e.role)
      const target =
        map.get(key) ??
        ({ key, name: e.role === "geconsolideerd" ? "Geconsolideerd" : e.name, role: e.role, ownershipPct: e.ownershipPct, parentName: e.parentName, years: [] } as MergedEntity)
      if (target.role === "onbekend" && e.role !== "onbekend") target.role = e.role
      target.ownershipPct ??= e.ownershipPct
      target.parentName ??= e.parentName
      for (const y of e.years) {
        let ty = target.years.find((x) => x.year === y.year)
        if (!ty) {
          ty = { year: y.year, isForecast: y.isForecast, values: {} }
          target.years.push(ty)
        }
        ty.isForecast = ty.isForecast && y.isForecast
        for (const [k, v] of Object.entries(y.values) as [FinFieldKey, number][]) {
          const cur = ty.values[k]
          if (!cur) ty.values[k] = { value: v, confidence: y.confidence, sourceIds: [id] }
          else {
            if (differs(cur.value, v)) {
              const label = FIN_FIELDS.find((f) => f.key === k)!.label
              conflicts.push(`${target.name} ${y.year}, ${label}: ${cur.value} en ${v} in verschillende bestanden.`)
            }
            if (y.confidence > cur.confidence) ty.values[k] = { value: v, confidence: y.confidence, sourceIds: [...cur.sourceIds, id] }
            else cur.sourceIds.push(id)
          }
        }
      }
      target.years.sort((a, b) => a.year - b.year)
      map.set(key, target)
    }
  }
  return {
    entities: [...map.values()],
    salaries: [...salaries.entries()].sort((a, b) => a[0] - b[0]).map(([year, s]) => ({ year, amount: s.amount, sourceIds: s.sourceIds })),
    shareholdingPct,
    conflicts,
  }
}

// ----------------------------------------------------------------------------- bestandstypen

export const SPREADSHEET_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
] as const

export function isSpreadsheet(contentType: string): boolean {
  return (SPREADSHEET_TYPES as readonly string[]).includes(contentType)
}
