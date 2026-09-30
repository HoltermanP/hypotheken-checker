import * as XLSX from "xlsx"
import { FIN_FIELDS, validYear, type FinancialsExtraction, type FinEntity, type FinEntityYear, type YearValues } from "./financials"

/** Excel-sjabloon maken/inlezen en spreadsheets naar tekst (alleen server en tests). */

// ----------------------------------------------------------------------------- Excel

export const TEMPLATE_MARKER = "HypotheekCheck NL - jaarcijfers"

/** Excel-sjabloon: één tabblad per entiteit plus een tabblad DGA. */
export function buildTemplate(years: number[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  const intro = [
    [TEMPLATE_MARKER],
    [],
    ["Vul per entiteit (werkmaatschappij, holding en eventueel geconsolideerd) een tabblad in."],
    ["Kopieer een tabblad voor extra entiteiten. Bedragen in hele euro's, zonder punten of €-teken."],
    ["Rol: werkmaatschappij, holding of geconsolideerd. Aandeelhouder: DGA of de naam van de holding."],
    ["Upload het bestand daarna op de pagina 'Inkomenstoets ondernemer' of bij Documenten."],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(intro), "Toelichting")
  const entity = (name: string, role: string, parent: string) => [
    [TEMPLATE_MARKER],
    ["Naam", name],
    ["Rol", role],
    ["Belang (%)", 100],
    ["Aandeelhouder", parent],
    [],
    ["Post", ...years],
    ...FIN_FIELDS.map((f) => [f.label, ...years.map(() => null)]),
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entity("Werk BV", "werkmaatschappij", "Holding BV")), "Werkmaatschappij")
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(entity("Holding BV", "holding", "DGA")), "Holding")
  const dga = [[TEMPLATE_MARKER], ["Aandelenbelang DGA (%)", 100], [], ["Jaar", "Salaris DGA (bruto)"], ...years.map((y) => [y, null])]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dga), "DGA")
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const s = v.replace(/[€\s]/g, "")
    if (!s) return null
    const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}\b)/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
}

const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()

/** Lees een ingevuld sjabloon exact in (zonder AI). Geeft null als het geen sjabloon is. */
export function parseTemplate(data: ArrayBuffer | Buffer, now: string): FinancialsExtraction | null {
  const wb = XLSX.read(data, { type: "array" })
  const entities: FinEntity[] = []
  const dgaSalaries: FinancialsExtraction["dgaSalaries"] = []
  let shareholdingPct: number | null = null
  let isTemplate = false
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, { header: 1, blankrows: false, defval: null })
    if (norm(rows[0]?.[0]) !== norm(TEMPLATE_MARKER)) continue
    isTemplate = true
    const cell = (label: string) => rows.find((r) => norm(r[0]) === norm(label))?.[1]
    if (rows.some((r) => norm(r[0]) === "jaar")) {
      shareholdingPct = num(cell("Aandelenbelang DGA (%)"))
      const start = rows.findIndex((r) => norm(r[0]) === "jaar")
      for (const r of rows.slice(start + 1)) {
        const year = num(r[0])
        const amount = num(r[1])
        if (year && validYear(year) && amount !== null) dgaSalaries.push({ year, amount: Math.round(amount), confidence: 1 })
      }
      continue
    }
    const headerIdx = rows.findIndex((r) => norm(r[0]) === "post")
    if (headerIdx < 0) continue
    const yearCols = (rows[headerIdx] ?? []).map((v, i) => ({ i, year: num(v) })).filter((c) => c.i > 0 && c.year && validYear(c.year)) as { i: number; year: number }[]
    const roleRaw = norm(cell("Rol"))
    const role: FinEntity["role"] = roleRaw.startsWith("hold") ? "holding" : roleRaw.startsWith("gecon") ? "geconsolideerd" : roleRaw.startsWith("werk") ? "werkmaatschappij" : "onbekend"
    const parent = String(cell("Aandeelhouder") ?? "").trim()
    const years: FinEntityYear[] = yearCols
      .map(({ i, year }) => {
        const values: YearValues = {}
        for (const f of FIN_FIELDS) {
          const row = rows.find((r) => norm(r[0]) === norm(f.label))
          const v = row ? num(row[i]) : null
          if (v !== null) values[f.key] = Math.round(v)
        }
        return { year, isForecast: false, confidence: 1, values }
      })
      .filter((y) => Object.keys(y.values).length > 0)
    if (years.length === 0) continue
    entities.push({
      name: String(cell("Naam") ?? name).trim() || name,
      role,
      ownershipPct: num(cell("Belang (%)")),
      parentName: parent && norm(parent) !== "dga" ? parent : null,
      years,
    })
  }
  if (!isTemplate) return null
  return { kind: "financials", documentKind: "spreadsheet", source: "template", entities, dgaSalaries, shareholdingPct, warnings: [], model: "sjabloon", extractedAt: now }
}

/** Spreadsheet (xlsx/xls/csv) als tekst voor het model: per tabblad CSV, begrensd in omvang. */
export function spreadsheetToText(data: ArrayBuffer | Buffer, maxChars = 60_000): string {
  const wb = XLSX.read(data, { type: "array" })
  let out = ""
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]!, { blankrows: false, FS: ";" })
    out += `### Tabblad: ${name}\n${csv}\n\n`
    if (out.length > maxChars) return out.slice(0, maxChars) + "\n[… afgekapt]"
  }
  return out
}

