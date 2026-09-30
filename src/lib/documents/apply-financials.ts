import type { BusinessForm } from "@/lib/intake/schema"
import { emptyBvYear, newId } from "@/lib/intake/defaults"
import { entityKey, FIN_FIELDS, type MergedFinancials } from "./financials"

/**
 * Samengevoegde jaarcijfers overnemen in een BV-onderneming uit de intake. Puur.
 * - Entiteiten worden op naam gekoppeld; is er maar één entiteit aan beide kanten, dan die.
 * - Nieuwe entiteiten worden toegevoegd; aandeelhouders worden op naam gekoppeld.
 * - Geconsolideerde cijfers gaan naar `bv.consolidated`.
 * - Maximaal de laatste 4 jaren blijven bewaard.
 */

type BvYearForm = ReturnType<typeof emptyBvYear>
type BvForm = NonNullable<BusinessForm["bv"]>

function mergeYears(existing: BvYearForm[], incoming: MergedFinancials["entities"][number]["years"]): { years: BvYearForm[]; accountDga: number | null } {
  const byYear = new Map(existing.map((y) => [y.year, { ...y }]))
  let accountDga: number | null = null
  for (const y of incoming) {
    if (y.isForecast) continue
    const target = byYear.get(y.year) ?? emptyBvYear(y.year)
    for (const f of FIN_FIELDS) {
      const v = y.values[f.key]
      if (!v) continue
      if (f.key === "currentAccountDga" || f.key === "issuedCapital") {
        if (f.key === "currentAccountDga") accountDga = v.value
        continue
      }
      ;(target as Record<string, number>)[f.key] = v.value
    }
    byYear.set(y.year, target)
  }
  const years = [...byYear.values()].sort((a, b) => a.year - b.year).slice(-4)
  return { years, accountDga }
}

export function applyFinancialsToBusiness(business: BusinessForm, merged: MergedFinancials): { business: BusinessForm; summary: string[] } {
  const b: BusinessForm = structuredClone(business)
  const summary: string[] = []
  if (!b.name) {
    const main = merged.entities.find((e) => e.role === "werkmaatschappij" || e.role === "eenmanszaak") ?? merged.entities.find((e) => e.role !== "geconsolideerd")
    if (main) b.name = main.name.slice(0, 80)
  }
  if (b.legalForm !== "bv" && b.legalForm !== "bv_holding") {
    // IB-ondernemer: winst per jaar uit de (enige) entiteit
    const source = merged.entities.find((e) => e.role !== "geconsolideerd")
    if (source && b.soleProp) {
      for (const y of source.years) {
        const profit = y.values.resultBeforeTax?.value ?? y.values.resultAfterTax?.value
        if (profit === undefined || y.isForecast) continue
        const target = b.soleProp.years.find((x) => x.year === y.year)
        if (target) {
          target.profit = profit
          if (y.values.revenue) target.revenue = y.values.revenue.value
        } else {
          b.soleProp.years.push({ year: y.year, revenue: y.values.revenue?.value ?? 0, profit, depreciation: 0, investments: 0, privateWithdrawals: 0, incidentalGains: Math.max(0, y.values.incidentalItems?.value ?? 0), incidentalLosses: Math.max(0, -(y.values.incidentalItems?.value ?? 0)), forDecrease: 0, hoursCriterionMet: true })
        }
      }
      b.soleProp.years = b.soleProp.years.sort((a, c) => a.year - c.year).slice(-4)
      summary.push(`Winst overgenomen voor ${source.years.map((y) => y.year).join(", ")}.`)
    }
    return { business: b, summary }
  }
  const bv: BvForm = b.bv ?? {
    shareholdingPct: 100,
    statutoryDirector: true,
    salaries: [],
    carBenefit: 0,
    pensionAccrual: 0,
    fiscalUnity: false,
    currentAccountDga: 0,
    issuedCapital: 0,
    managementFee: { annual: 0, contractual: false, structural: false, armsLength: false },
    entities: [],
    loansToDga: [],
  }
  const nonConsolidated = merged.entities.filter((e) => e.role !== "geconsolideerd")
  // Een lege standaard-entiteit (zonder cijfers) mag worden overschreven.
  const hasData = (e: BvForm["entities"][number]) => e.financials.some((f) => f.resultAfterTax !== 0 || f.balanceTotal !== 0 || f.revenue !== 0)
  if (bv.entities.length === 1 && !hasData(bv.entities[0]!) && nonConsolidated.length > 0) bv.entities = []
  for (const m of nonConsolidated) {
    let target =
      bv.entities.find((e) => entityKey(e.name) === m.key) ??
      (bv.entities.length === 1 && nonConsolidated.length === 1 ? bv.entities[0] : undefined)
    if (!target) {
      if (bv.entities.length >= 5) continue
      target = { key: newId(), name: m.name, role: m.role === "holding" ? "holding" : "werkmaatschappij", parentKey: null, ownershipPct: m.ownershipPct ?? 100, financials: [] }
      bv.entities.push(target)
      summary.push(`Entiteit ${m.name} toegevoegd.`)
    } else if (m.role === "holding" || m.role === "werkmaatschappij") {
      target.role = m.role
    }
    if (m.ownershipPct !== null) target.ownershipPct = m.ownershipPct
    const { years, accountDga } = mergeYears(target.financials, m.years)
    target.financials = years
    if (accountDga !== null) bv.currentAccountDga = accountDga
    const cap = m.years.map((y) => y.values.issuedCapital?.value).filter((v): v is number => typeof v === "number").at(-1)
    if (cap !== undefined && (target.role === "werkmaatschappij" || bv.issuedCapital === 0)) bv.issuedCapital = cap
    summary.push(`${target.name}: cijfers ${years.map((y) => y.year).join(", ")}.`)
  }
  // Aandeelhouders koppelen op naam
  for (const m of nonConsolidated) {
    if (!m.parentName) continue
    const child = bv.entities.find((e) => entityKey(e.name) === m.key)
    const parent = bv.entities.find((e) => entityKey(e.name) === entityKey(m.parentName!))
    if (child && parent && child !== parent) child.parentKey = parent.key
  }
  if (bv.entities.some((e) => e.role === "holding") && b.legalForm === "bv") {
    b.legalForm = "bv_holding"
    summary.push("Rechtsvorm aangepast naar BV met holding.")
  }
  const consolidated = merged.entities.find((e) => e.role === "geconsolideerd")
  if (consolidated) {
    bv.consolidated = mergeYears(bv.consolidated ?? [], consolidated.years).years
    summary.push(`Geconsolideerde cijfers: ${bv.consolidated.map((y) => y.year).join(", ")}.`)
  }
  for (const s of merged.salaries) {
    const cur = bv.salaries.find((x) => x.year === s.year)
    if (cur) cur.amount = s.amount
    else bv.salaries.push({ year: s.year, amount: s.amount })
  }
  bv.salaries = bv.salaries.sort((a, c) => a.year - c.year).slice(-4)
  if (merged.salaries.length > 0) summary.push(`DGA-salaris: ${merged.salaries.map((s) => s.year).join(", ")}.`)
  if (merged.shareholdingPct !== null) {
    bv.shareholdingPct = merged.shareholdingPct
    summary.push(`Aandelenbelang ${merged.shareholdingPct}%.`)
  }
  b.bv = bv
  return { business: b, summary }
}
