import type { LenderEntrepreneurPolicy, LenderProfile } from "@/lib/engine/lenders/types"

/**
 * Een LenderProfile wordt in de database opgeslagen als losse rijen (sleutel → waarde + bron +
 * status) in `lender_criteria` en `lender_entrepreneur_policies`. Zo heeft elk criterium een
 * eigen bron en verificatiestatus en kan de beheerder het afzonderlijk aanpassen.
 */

export interface KvRow {
  key: string
  value: unknown
  sourceUrl: string | null
  status: "verified" | "needs_verification" | "unknown"
  note?: string | null
}

/** Profielveld → veldnaam in het onderzoek (voor de bronverwijzing). */
const CRITERIA_SOURCE_FIELD: Record<string, string> = {
  maxLtvPct: "maxLtvPct",
  maxInterestOnlyPctOfValue: "maxInterestOnlyPctOfValue",
  meeneemregeling: "meeneemregeling",
  verhuisregeling: "verhuisregeling",
  "accepts.permanentContract": "acceptsPermanentContract",
  "accepts.intentieverklaring": "acceptsIntentieverklaring",
  "accepts.flexIBL": "acceptsFlexIBL",
  "accepts.perspectiefverklaring": "acceptsPerspectiefverklaring",
  "accepts.benefits": "acceptsBenefits",
  "accepts.pension": "acceptsPension",
  bridgeLoanMaxMonths: "bridgeLoanMaxMonths",
  restschuldFinancing: "restschuldFinancing",
  penaltyFreeRepaymentPct: "penaltyFreeRepaymentPct",
  rentemiddeling: "rentemiddeling",
  energyLabelDiscounts: "energyLabelDiscount",
  energyLabelDiscountsAbove10y: "energyLabelDiscount",
  closingCostsEur: "closingCostsEur",
  bouwdepot: "bouwdepot",
  allowsConsumptiveRelease: "oversluitenVerhogenConditions",
  allowsBusinessRelease: "oversluitenVerhogenConditions",
}

const ENT_KEYS: (keyof LenderEntrepreneurPolicy)[] = [
  "minYearsFigures",
  "acceptsForecastForStarters",
  "ivoPolicy",
  "calcMethod",
  "acceptedLegalForms",
  "dgaTreatment",
  "minSolvencyPct",
  "minCurrentRatio",
  "countsManagementFee",
  "dgaThresholdPct",
  "allowsLoanNextToOwnBv",
  "guaranteesTreatment",
  "maxLtvPct",
  "maxInterestOnlyPct",
]

const entSourceField = (k: string) => `ent${k.charAt(0).toUpperCase()}${k.slice(1)}`

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, p) => (o && typeof o === "object" ? (o as Record<string, unknown>)[p] : undefined), obj)
}

function statusFor(profile: LenderProfile, sourceField: string, value: unknown): KvRow["status"] {
  if (value === null || value === undefined) return "unknown"
  return profile.sources[sourceField]?.status === "verified" ? "verified" : "needs_verification"
}

export function profileToRows(profile: LenderProfile): { criteria: KvRow[]; entrepreneur: KvRow[] } {
  const criteria = Object.entries(CRITERIA_SOURCE_FIELD).map(([key, sourceField]) => {
    const value = getPath(profile, key) ?? null
    return { key, value, sourceUrl: profile.sources[sourceField]?.sourceUrl ?? null, status: statusFor(profile, sourceField, value) }
  })
  const entrepreneur = ENT_KEYS.map((key) => {
    const value = profile.entrepreneur[key] ?? null
    const sf = entSourceField(key)
    return { key, value, sourceUrl: profile.sources[sf]?.sourceUrl ?? null, status: statusFor(profile, sf, value) }
  })
  return { criteria, entrepreneur }
}

export function rowsToProfile(
  lender: { slug: string; name: string; active: boolean; activeNote: string | null },
  criteria: KvRow[],
  entrepreneur: KvRow[]
): LenderProfile {
  const c = new Map(criteria.map((r) => [r.key, r.value]))
  const e = new Map(entrepreneur.map((r) => [r.key, r.value]))
  const v = <T>(key: string): T | null => (c.has(key) ? ((c.get(key) as T) ?? null) : null)
  const sources: LenderProfile["sources"] = {}
  for (const r of criteria) sources[CRITERIA_SOURCE_FIELD[r.key] ?? r.key] = { sourceUrl: r.sourceUrl, status: r.status }
  for (const r of entrepreneur) sources[entSourceField(r.key)] = { sourceUrl: r.sourceUrl, status: r.status }
  const ent = Object.fromEntries(ENT_KEYS.map((k) => [k, e.get(k) ?? null])) as unknown as LenderEntrepreneurPolicy
  return {
    slug: lender.slug,
    name: lender.name,
    active: lender.active,
    activeNote: lender.activeNote,
    maxLtvPct: v("maxLtvPct"),
    maxInterestOnlyPctOfValue: v("maxInterestOnlyPctOfValue"),
    meeneemregeling: v("meeneemregeling"),
    verhuisregeling: v("verhuisregeling"),
    accepts: {
      permanentContract: v("accepts.permanentContract"),
      intentieverklaring: v("accepts.intentieverklaring"),
      flexIBL: v("accepts.flexIBL"),
      perspectiefverklaring: v("accepts.perspectiefverklaring"),
      benefits: v("accepts.benefits"),
      pension: v("accepts.pension"),
    },
    entrepreneur: ent,
    bridgeLoanMaxMonths: v("bridgeLoanMaxMonths"),
    restschuldFinancing: v("restschuldFinancing"),
    penaltyFreeRepaymentPct: v("penaltyFreeRepaymentPct"),
    rentemiddeling: v("rentemiddeling"),
    energyLabelDiscounts: v("energyLabelDiscounts") ?? {},
    energyLabelDiscountsAbove10y: v("energyLabelDiscountsAbove10y") ?? undefined,
    closingCostsEur: v("closingCostsEur"),
    bouwdepot: v("bouwdepot"),
    allowsConsumptiveRelease: v("allowsConsumptiveRelease"),
    allowsBusinessRelease: v("allowsBusinessRelease"),
    sources,
  }
}

export const CRITERIA_LABELS: Record<string, string> = {
  maxLtvPct: "Maximale LTV (%)",
  maxInterestOnlyPctOfValue: "Maximaal aflossingsvrij (% marktwaarde)",
  meeneemregeling: "Meeneemregeling",
  verhuisregeling: "Verhuisregeling",
  "accepts.permanentContract": "Vast contract",
  "accepts.intentieverklaring": "Intentieverklaring",
  "accepts.flexIBL": "Flexibel inkomen (IBL)",
  "accepts.perspectiefverklaring": "Perspectiefverklaring",
  "accepts.benefits": "Uitkering",
  "accepts.pension": "Pensioen",
  bridgeLoanMaxMonths: "Overbrugging max. maanden",
  restschuldFinancing: "Restschuld meefinancieren",
  penaltyFreeRepaymentPct: "Boetevrij aflossen (% per jaar)",
  rentemiddeling: "Rentemiddeling",
  energyLabelDiscounts: "Rentekorting per energielabel",
  energyLabelDiscountsAbove10y: "Rentekorting per label (> 10 jaar vast)",
  closingCostsEur: "Afsluitkosten (€)",
  bouwdepot: "Bouwdepot",
  allowsConsumptiveRelease: "Overwaarde vrij opnemen",
  allowsBusinessRelease: "Verhogen voor zakelijk doel",
  minYearsFigures: "Min. jaren cijfers",
  acceptsForecastForStarters: "Prognose voor starters",
  ivoPolicy: "IVO-beleid",
  calcMethod: "Rekenmethode",
  acceptedLegalForms: "Geaccepteerde rechtsvormen",
  dgaTreatment: "Behandeling DGA",
  minSolvencyPct: "Min. solvabiliteit (%)",
  minCurrentRatio: "Min. current ratio",
  countsManagementFee: "Management fee telt mee",
  dgaThresholdPct: "DGA vanaf aandelenbelang (%)",
  allowsLoanNextToOwnBv: "Hypotheek naast lening eigen BV",
  guaranteesTreatment: "Behandeling borgstellingen",
  maxInterestOnlyPct: "Max. aflossingsvrij ondernemer (%)",
}
