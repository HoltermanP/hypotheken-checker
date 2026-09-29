/**
 * Bouwt de seed voor geldverstrekkers en rentetabellen uit /research/lenders-*.json.
 * Draai opnieuw na het bijwerken van de research: pnpm tsx scripts/build-lender-seed.ts
 *
 * Handmatige structurering (uit de brontekst in de research) staat in OVERRIDES hieronder:
 * energielabelkortingen per label en of een bank vrij opnemen van overwaarde toestaat.
 */
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { EnergyLabel } from "../src/lib/engine/norms"
import type { LenderProfile, LtvClass, RateRow } from "../src/lib/engine/lenders/types"

const root = path.resolve(__dirname, "..")
type Field = { value: unknown; sourceUrl?: string | null; note?: string }
type RawLender = {
  slug: string
  name: string
  brands?: string[]
  website?: string
  active: boolean
  activeNote?: string
  fields: Record<string, Field>
  rates?: {
    date?: string
    sourceUrl?: string
    status?: string
    annuity?: Record<string, number | null>[]
    interestOnly?: Record<string, number | null>[]
    note?: string
  }
}

const raw: RawLender[] = ["a", "b", "c"].flatMap(
  (f) => JSON.parse(readFileSync(path.join(root, "research", `lenders-${f}.json`), "utf8")).lenders
)

const A_PLUS: EnergyLabel[] = ["A", "A+", "A++", "A+++", "A++++", "A++++EPG"]
const all = (labels: EnergyLabel[], v: number) => Object.fromEntries(labels.map((l) => [l, v]))

/** Energielabelkorting in procentpunt (positief = korting t.o.v. de gepubliceerde tabel). */
const OVERRIDES: Record<
  string,
  {
    energy?: Partial<Record<EnergyLabel, number>>
    energyAbove10y?: Partial<Record<EnergyLabel, number>>
    consumptive?: boolean | null
    business?: boolean | null
  }
> = {
  // Tabel = label A. Andere labels t.o.v. A (bron: rentetool 21-09-2026).
  "abn-amro": {
    energy: { "A++++": 0.04, "A++++EPG": 0.04, ...all(["A", "A+", "A++", "A+++"], 0), B: -0.07, C: -0.12, D: -0.13, ...all(["E", "F", "G", "geen"], -0.16) },
  },
  ing: { energy: { ...all(["A+++", "A++++", "A++++EPG"], 0.2), ...all(["A", "A+", "A++"], 0.18), B: 0.1, C: 0.07, D: 0.03 } },
  rabobank: { energy: all(A_PLUS, 0.15) },
  obvion: { energy: { "A++++": 0.2, "A++++EPG": 0.2, ...all(["A", "A+", "A++", "A+++"], 0.15), B: 0.08 } },
  florius: { energy: { ...all(A_PLUS, 0.15), B: 0.07, C: 0.04, D: 0.03 } },
  "centraal-beheer": { energy: all(["A+", "A++", "A+++", "A++++", "A++++EPG"], 0.05) },
  argenta: { energy: { ...all(A_PLUS, 0.1), B: 0.05 }, consumptive: true },
  lot: { energy: all(A_PLUS, 0.1), energyAbove10y: all(A_PLUS, 0.03) },
  "lloyds-bank": { energy: all(A_PLUS, 0.05) },
  allianz: { consumptive: true },
  tulp: { consumptive: true },
  hypotrust: { consumptive: true },
  bijbouwe: { consumptive: true },
}

// NN: officiële tabel dateert van 11-07-2026; actuele NHG-tarieven (secundaire bron, 29-09-2026).
const NN_CURRENT_NHG: Record<number, number> = { 1: 4.15, 2: 4.17, 5: 4.23, 6: 4.26, 7: 4.31, 10: 4.39, 12: 4.51, 15: 4.68, 20: 4.86, 30: 4.69 }
const NN_CURRENT_SOURCE = "https://www.actuelerentestanden.nl/hypotheek/rente/nationale-nederlanden"

const unknown = (v: unknown) => v === "unknown" || v === undefined || v === null || v === ""
const bool = (f?: Field): boolean | null => {
  if (!f || unknown(f.value)) return null
  if (typeof f.value === "boolean") return f.value
  const s = String(f.value).toLowerCase()
  if (/^(ja|yes|true)/.test(s)) return true
  if (/^(nee|no|false|beperkt|limited)/.test(s)) return s.startsWith("beperkt") || s.startsWith("limited") ? null : false
  return null
}
const numOrNull = (f?: Field): number | null => {
  if (!f || unknown(f.value)) return null
  if (typeof f.value === "number") return f.value
  const n = Number(String(f.value).replace(",", "."))
  return Number.isFinite(n) ? n : null
}
const text = (f?: Field): string | null => (!f || unknown(f.value) ? null : String(f.value))
const oneOf = <T extends string>(f: Field | undefined, options: readonly T[]): T | null =>
  f && typeof f.value === "string" && (options as readonly string[]).includes(f.value) ? (f.value as T) : null

const lenders: LenderProfile[] = []
const rates: RateRow[] = []
const LTV: LtvClass[] = ["nhg", "ltv60", "ltv70", "ltv80", "ltv90", "ltv100"]

for (const l of raw) {
  const f = l.fields ?? {}
  const o = OVERRIDES[l.slug] ?? {}
  const sources: LenderProfile["sources"] = {}
  for (const [k, v] of Object.entries(f)) {
    sources[k] = { sourceUrl: v.sourceUrl ?? null, status: unknown(v.value) ? "unknown" : v.sourceUrl ? "verified" : "needs_verification" }
  }
  const forms = f.entAcceptedLegalForms?.value
  lenders.push({
    slug: l.slug,
    name: l.name,
    active: l.active,
    activeNote: l.activeNote || null,
    maxLtvPct: numOrNull(f.maxLtvPct),
    maxInterestOnlyPctOfValue: numOrNull(f.maxInterestOnlyPctOfValue),
    meeneemregeling: bool(f.meeneemregeling),
    verhuisregeling: bool(f.verhuisregeling),
    accepts: {
      permanentContract: bool(f.acceptsPermanentContract),
      intentieverklaring: bool(f.acceptsIntentieverklaring),
      flexIBL: bool(f.acceptsFlexIBL),
      perspectiefverklaring: bool(f.acceptsPerspectiefverklaring),
      benefits: bool(f.acceptsBenefits),
      pension: bool(f.acceptsPension),
    },
    entrepreneur: {
      minYearsFigures: numOrNull(f.entMinYearsFigures),
      acceptsForecastForStarters: bool(f.entAcceptsForecastForStarters),
      ivoPolicy: oneOf(f.entIvoPolicy, ["required", "accepted", "not_accepted"] as const),
      calcMethod: oneOf(f.entCalcMethod, ["avg3_capped_by_last", "avg3", "last_year", "weighted", "ivo"] as const),
      acceptedLegalForms: Array.isArray(forms) ? (forms as LenderProfile["entrepreneur"]["acceptedLegalForms"]) : null,
      dgaTreatment: oneOf(f.entDgaTreatment, ["salary_only", "salary_plus_distributable_profit", "ivo"] as const),
      minSolvencyPct: numOrNull(f.entMinSolvencyPct),
      minCurrentRatio: numOrNull(f.entMinCurrentRatio),
      countsManagementFee: bool(f.entCountsManagementFee),
      dgaThresholdPct: numOrNull(f.entDgaThresholdPct),
      allowsLoanNextToOwnBv: bool(f.entAllowsLoanNextToOwnBv),
      guaranteesTreatment: text(f.entGuaranteesTreatment),
      maxLtvPct: numOrNull(f.entMaxLtvPct),
      maxInterestOnlyPct: numOrNull(f.entMaxInterestOnlyPct),
    },
    bridgeLoanMaxMonths: numOrNull(f.bridgeLoanMaxMonths),
    restschuldFinancing: bool(f.restschuldFinancing),
    penaltyFreeRepaymentPct: numOrNull(f.penaltyFreeRepaymentPct),
    rentemiddeling: bool(f.rentemiddeling),
    energyLabelDiscounts: o.energy ?? {},
    energyLabelDiscountsAbove10y: o.energyAbove10y,
    closingCostsEur: numOrNull(f.closingCostsEur),
    bouwdepot: bool(f.bouwdepot),
    allowsConsumptiveRelease: o.consumptive ?? null,
    allowsBusinessRelease: o.business ?? null,
    sources,
  })

  const r = l.rates
  if (!r?.date) continue
  const status = r.status === "verified" ? "verified" : "needs_verification"
  for (const [kind, rows] of [
    ["annuity", r.annuity ?? []],
    ["interest_only", r.interestOnly ?? []],
  ] as const) {
    for (const row of rows) {
      const years = Number(row.fixedYears)
      if (!Number.isFinite(years) || years <= 0) continue // variabel (0) niet opnemen
      for (const cls of LTV) {
        const v = row[cls]
        if (typeof v !== "number") continue
        let ratePct = v
        let rowStatus: RateRow["status"] = status
        let sourceUrl = r.sourceUrl ?? null
        let rateDate = r.date
        if (l.slug === "nationale-nederlanden" && NN_CURRENT_NHG[years] !== undefined) {
          const julyNhg = rows.find((x) => Number(x.fixedYears) === years)?.nhg
          if (typeof julyNhg === "number") {
            ratePct = Math.round((v + (NN_CURRENT_NHG[years]! - julyNhg)) * 1000) / 1000
            rowStatus = cls === "nhg" ? "needs_verification" : "derived"
            sourceUrl = NN_CURRENT_SOURCE
            rateDate = "2026-09-29"
          }
        }
        rates.push({ lenderSlug: l.slug, fixedYears: years, ltvClass: cls, repaymentType: kind, ratePct, rateDate, status: rowStatus, sourceUrl })
      }
    }
  }
}

writeFileSync(path.join(root, "src/lib/lenders/seed/lenders.json"), JSON.stringify(lenders, null, 1) + "\n")
writeFileSync(path.join(root, "src/lib/lenders/seed/rates.json"), JSON.stringify(rates) + "\n")
console.info(`${lenders.length} geldverstrekkers (${lenders.filter((l) => l.active).length} actief), ${rates.length} rentes`)
