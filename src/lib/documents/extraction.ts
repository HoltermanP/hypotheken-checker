import { z } from "zod"
import { parseEuroInput } from "@/lib/format"
import { redactDeep } from "./bsn"
import type { DocTypeDef, FieldDef } from "./types"

/**
 * Uitvoer van het model (structured output) en de normalisatie naar getypeerde velden.
 * Eén generiek schema voor alle documenttypes: het model vult per verwachte sleutel een waarde
 * (als tekst) en een betrouwbaarheid; wij zetten het om naar het juiste type.
 */

export const modelExtractionSchema = z.object({
  documentTypeMatches: z.boolean(),
  detectedDocumentType: z.string(),
  fields: z.array(
    z.object({
      key: z.string(),
      value: z.string().nullable(),
      confidence: z.number(),
      note: z.string().nullable(),
    })
  ),
  warnings: z.array(z.string()),
})

export type ModelExtraction = z.infer<typeof modelExtractionSchema>

export type FieldValue = string | number | boolean | null

export interface ExtractedField {
  key: string
  label: string
  kind: FieldDef["kind"]
  value: FieldValue
  confidence: number
  note: string | null
}

export interface NormalizedExtraction {
  documentTypeMatches: boolean
  detectedDocumentType: string
  fields: ExtractedField[]
  warnings: string[]
  model: string
  extractedAt: string
}

function toDate(v: string): string | null {
  const s = v.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const nl = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s)
  if (nl) return `${nl[3]}-${nl[2]!.padStart(2, "0")}-${nl[1]!.padStart(2, "0")}`
  return null
}

export function coerce(kind: FieldDef["kind"], raw: string | null): FieldValue {
  if (raw === null || raw.trim() === "") return null
  switch (kind) {
    case "money":
    case "number":
    case "percent":
      return parseEuroInput(raw.replace("%", ""))
    case "date":
      return toDate(raw)
    case "boolean":
      return /^(ja|yes|true|waar|1)$/i.test(raw.trim()) ? true : /^(nee|no|false|onwaar|0)$/i.test(raw.trim()) ? false : null
    default:
      return raw.trim().slice(0, 500)
  }
}

export function normalizeExtraction(def: DocTypeDef, raw: ModelExtraction, model: string, now: string): NormalizedExtraction {
  const byKey = new Map(raw.fields.map((f) => [f.key, f]))
  const fields: ExtractedField[] = def.fields.map((fd) => {
    const f = byKey.get(fd.key)
    const value = f ? coerce(fd.kind, f.value) : null
    return {
      key: fd.key,
      label: fd.label,
      kind: fd.kind,
      value,
      confidence: f && value !== null ? Math.max(0, Math.min(1, f.confidence)) : 0,
      note: f?.note ?? null,
    }
  })
  return redactDeep({
    documentTypeMatches: raw.documentTypeMatches,
    detectedDocumentType: raw.detectedDocumentType.slice(0, 80),
    fields,
    warnings: raw.warnings.slice(0, 10).map((w) => w.slice(0, 300)),
    model,
    extractedAt: now,
  })
}

/** Bevestigde waarden als eenvoudig sleutel → waarde-object. */
export function confirmedValues(fields: ExtractedField[]): Record<string, FieldValue> {
  return Object.fromEntries(fields.map((f) => [f.key, f.value]))
}
