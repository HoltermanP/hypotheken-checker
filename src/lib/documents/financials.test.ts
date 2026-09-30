import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { defaultBusiness } from "@/lib/intake/defaults"
import { applyFinancialsToBusiness } from "./apply-financials"
import { entityKey, FIN_FIELDS, isSpreadsheet, mergeFinancials, normalizeFinancials, type FinancialsExtraction } from "./financials"
import { buildTemplate, parseTemplate, spreadsheetToText, TEMPLATE_MARKER } from "./financials-xlsx"

const NOW = "2026-09-30T10:00:00Z"

function filledTemplate(): ArrayBuffer {
  const wb = XLSX.read(buildTemplate([2023, 2024, 2025]), { type: "array" })
  const set = (sheet: string, label: string, values: (number | string)[]) => {
    const ws = wb.Sheets[sheet]!
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    const r = rows.findIndex((row) => row[0] === label)
    values.forEach((v, i) => (ws[XLSX.utils.encode_cell({ r, c: i + 1 })] = typeof v === "number" ? { t: "n", v } : { t: "s", v }))
  }
  set("Werkmaatschappij", "Resultaat na belasting", [80000, 90000, 100000])
  set("Werkmaatschappij", "Eigen vermogen", [300000, 380000, 480000])
  set("Werkmaatschappij", "Balanstotaal", [500000, 600000, 700000])
  set("Werkmaatschappij", "Incidentele posten (vóór belasting, + = bate)", [0, 0, 20000])
  set("Werkmaatschappij", "Geplaatst kapitaal", [18000, 18000, 18000])
  set("Holding", "Resultaat na belasting", [5000, 5000, "6.000"])
  set("DGA", "Aandelenbelang DGA (%)", [100])
  const ws = wb.Sheets.DGA!
  ws["B5"] = { t: "n", v: 60000 }
  ws["B6"] = { t: "n", v: 62000 }
  ws["B7"] = { t: "n", v: 64000 }
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

describe("jaarcijfers uit bestanden", () => {
  it("sjabloon: maken en exact inlezen zonder AI", () => {
    const ext = parseTemplate(filledTemplate(), NOW)!
    expect(ext.source).toBe("template")
    expect(ext.entities.map((e) => e.name)).toEqual(["Werk BV", "Holding BV"])
    const werk = ext.entities[0]!
    expect(werk.role).toBe("werkmaatschappij")
    expect(werk.parentName).toBe("Holding BV")
    expect(werk.years.map((y) => y.values.resultAfterTax)).toEqual([80000, 90000, 100000])
    expect(werk.years[2]!.values.incidentalItems).toBe(20000)
    expect(ext.entities[1]!.years[2]!.values.resultAfterTax).toBe(6000)
    expect(ext.entities[1]!.parentName).toBeNull()
    expect(ext.dgaSalaries.map((s) => s.amount)).toEqual([60000, 62000, 64000])
    expect(ext.shareholdingPct).toBe(100)
  })

  it("geen sjabloon → null; spreadsheet naar tekst", () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Winst", 2024, 2025], ["Resultaat", 1000, 2000]]), "Blad1")
    const data = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
    expect(parseTemplate(data, NOW)).toBeNull()
    const text = spreadsheetToText(data)
    expect(text).toContain("### Tabblad: Blad1")
    expect(text).toContain("Resultaat;1000;2000")
    expect(spreadsheetToText(data, 10)).toContain("afgekapt")
    expect(isSpreadsheet("text/csv")).toBe(true)
    expect(isSpreadsheet("application/pdf")).toBe(false)
    expect(parseTemplate(new TextEncoder().encode(`${TEMPLATE_MARKER}\nx`).buffer as ArrayBuffer, NOW)).toEqual(expect.objectContaining({ entities: [] }))
  })

  it("normaliseert modeluitvoer (jaren, afronding, BSN)", () => {
    const years = Object.fromEntries(FIN_FIELDS.map((f) => [f.key, null])) as Record<(typeof FIN_FIELDS)[number]["key"], null>
    const n = normalizeFinancials(
      {
        documentKind: "jaarrekening",
        entities: [
          { name: "  Jansen Holding B.V. ", role: "holding", ownershipPct: 140, parentName: " ", years: [{ year: 2025, isForecast: false, confidence: 1.5, ...years, resultAfterTax: 10000.4 }, { year: 1800, isForecast: false, confidence: 1, ...years, revenue: 1 }] },
          { name: "Leeg", role: "onbekend", ownershipPct: null, parentName: null, years: [{ year: 2025, isForecast: false, confidence: 1, ...years }] },
        ],
        dgaSalaries: [{ year: 2025, amount: 60000.2, confidence: 0.9 }, { year: 2025, amount: -1, confidence: 1 }],
        shareholdingPct: 0,
        warnings: ["BSN 111222333"],
      },
      "ai",
      "claude-sonnet-5",
      NOW
    )
    expect(n.entities).toHaveLength(1)
    expect(n.entities[0]!.ownershipPct).toBeNull()
    expect(n.entities[0]!.parentName).toBeNull()
    expect(n.entities[0]!.years).toHaveLength(1)
    expect(n.entities[0]!.years[0]!.values.resultAfterTax).toBe(10000)
    expect(n.entities[0]!.years[0]!.confidence).toBe(1)
    expect(n.dgaSalaries).toEqual([{ year: 2025, amount: 60000, confidence: 0.9 }])
    expect(n.shareholdingPct).toBeNull()
    expect(n.warnings[0]).toContain("[BSN verwijderd]")
  })

  it("voegt meerdere bestanden samen en meldt conflicten", () => {
    const a = parseTemplate(filledTemplate(), NOW)!
    const b: FinancialsExtraction = {
      ...a,
      source: "ai",
      entities: [
        { name: "Werk B.V.", role: "werkmaatschappij", ownershipPct: null, parentName: null, years: [{ year: 2025, isForecast: false, confidence: 0.5, values: { resultAfterTax: 95000, revenue: 1200000 } }, { year: 2026, isForecast: true, confidence: 0.8, values: { resultAfterTax: 110000 } }] },
        { name: "Groep", role: "geconsolideerd", ownershipPct: null, parentName: null, years: [{ year: 2025, isForecast: false, confidence: 0.9, values: { resultAfterTax: 105000 } }] },
      ],
      dgaSalaries: [{ year: 2025, amount: 70000, confidence: 0.5 }],
    }
    const m = mergeFinancials([{ id: "a", extraction: a }, { id: "b", extraction: b }])
    const werk = m.entities.find((e) => e.key === entityKey("Werk BV"))!
    expect(werk.years.find((y) => y.year === 2025)!.values.resultAfterTax!.value).toBe(100000) // hoogste betrouwbaarheid wint
    expect(werk.years.find((y) => y.year === 2025)!.values.revenue!.value).toBe(1200000)
    expect(werk.years.find((y) => y.year === 2026)!.isForecast).toBe(true)
    expect(m.entities.some((e) => e.role === "geconsolideerd")).toBe(true)
    expect(m.conflicts.join(" ")).toMatch(/Resultaat na belasting/)
    expect(m.conflicts.join(" ")).toMatch(/DGA-salaris 2025/)
    expect(m.salaries.find((s) => s.year === 2025)!.amount).toBe(64000)
    expect(entityKey("Jansen Holding B.V.")).toBe("jansen holding")
  })

  it("neemt cijfers over in een BV: entiteiten, holdingstructuur, salaris, consolidatie", () => {
    const merged = mergeFinancials([{ id: "a", extraction: parseTemplate(filledTemplate(), NOW)! }])
    merged.entities.push({ key: "__geconsolideerd", name: "Geconsolideerd", role: "geconsolideerd", ownershipPct: null, parentName: null, years: [{ year: 2025, isForecast: false, values: { resultAfterTax: { value: 106000, confidence: 1, sourceIds: ["a"] } } }] })
    const start = defaultBusiness(2026)
    start.legalForm = "bv"
    const { business, summary } = applyFinancialsToBusiness(start, merged)
    expect(business.legalForm).toBe("bv_holding")
    expect(business.name).toBe("Werk BV")
    const bv = business.bv!
    expect(bv.entities.map((e) => e.name)).toEqual(["Werk BV", "Holding BV"])
    const werk = bv.entities[0]!
    const holding = bv.entities[1]!
    expect(werk.parentKey).toBe(holding.key)
    expect(werk.financials.find((f) => f.year === 2025)!.incidentalItems).toBe(20000)
    expect(bv.issuedCapital).toBe(18000)
    expect(bv.salaries.find((s) => s.year === 2025)!.amount).toBe(64000)
    expect(bv.consolidated!.find((y) => y.year === 2025)!.resultAfterTax).toBe(106000)
    expect(summary.join(" ")).toMatch(/Geconsolideerde cijfers/)
  })

  it("IB-ondernemer: winst per jaar overnemen", () => {
    const b = defaultBusiness(2026)
    const merged = mergeFinancials([
      { id: "x", extraction: { kind: "financials", documentKind: "ib_aangifte", source: "ai", entities: [{ name: "Eenmanszaak", role: "eenmanszaak", ownershipPct: null, parentName: null, years: [{ year: 2025, isForecast: false, confidence: 1, values: { resultBeforeTax: 51000, revenue: 90000 } }, { year: 2021, isForecast: false, confidence: 1, values: { resultBeforeTax: 30000 } }] }], dgaSalaries: [], shareholdingPct: null, warnings: [], model: "m", extractedAt: NOW } },
    ])
    const { business } = applyFinancialsToBusiness(b, merged)
    expect(business.soleProp!.years.find((y) => y.year === 2025)!.profit).toBe(51000)
    expect(business.soleProp!.years.length).toBeLessThanOrEqual(4)
  })
})
