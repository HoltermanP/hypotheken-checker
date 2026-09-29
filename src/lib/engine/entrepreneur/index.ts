import type { LenderEntrepreneurPolicy } from "../lenders/types"
import type { NormValues } from "../norms"
import { dgaIncome, type DgaIncomeResult } from "./dga"
import { DEFAULT_POLICY, solePropIncome, type EntrepreneurIncomeResult } from "./sole-prop"
import type { BusinessInput } from "./types"

export * from "./types"
export { consolidate, distributableProfit, dgaIncome, groupFigures, effectiveOwnership } from "./dga"
export { solePropIncome, applyMethod, correctedProfit, DEFAULT_POLICY } from "./sole-prop"
export { continuityRisk } from "./risk"
export * from "./scenarios"

export interface BusinessIncome {
  businessId: string
  legalForm: BusinessInput["legalForm"]
  accepted: boolean | null
  income: number
  method: string
  explanation: string[]
  warnings: string[]
  sole?: EntrepreneurIncomeResult
  dga?: DgaIncomeResult
}

/** Vul ontbrekende (onbekende) bankbeleidsvelden aan met het standaardbeleid. */
export function withDefaults(policy: Partial<LenderEntrepreneurPolicy> | null | undefined): LenderEntrepreneurPolicy {
  const out = { ...DEFAULT_POLICY }
  if (!policy) return out
  for (const [k, v] of Object.entries(policy)) {
    if (v !== null && v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

export function businessIncome(
  business: BusinessInput,
  policy: LenderEntrepreneurPolicy,
  norms: NormValues
): BusinessIncome {
  if (business.legalForm === "bv" || business.legalForm === "bv_holding") {
    const r = dgaIncome(business, policy, { gebruikelijkLoon: norms.ondernemer.gebruikelijkLoon })
    return {
      businessId: business.id,
      legalForm: business.legalForm,
      accepted: r.accepted,
      income: r.income,
      method: r.treatedAsEmployee ? "salaris" : (policy.dgaTreatment ?? "salary_plus_distributable_profit"),
      explanation: r.explanation,
      warnings: r.warnings,
      dga: r,
    }
  }
  const r = solePropIncome(business, policy)
  return {
    businessId: business.id,
    legalForm: business.legalForm,
    accepted: r.accepted,
    income: r.income,
    method: r.method,
    explanation: r.explanation,
    warnings: [],
    sole: r,
  }
}

export function applicantBusinessIncome(
  businesses: BusinessInput[],
  policy: LenderEntrepreneurPolicy,
  norms: NormValues
): { total: number; accepted: boolean | null; items: BusinessIncome[] } {
  const items = businesses.map((b) => businessIncome(b, policy, norms))
  const accepted = items.some((i) => i.accepted === false)
    ? false
    : items.some((i) => i.accepted === null)
      ? null
      : true
  return { total: items.reduce((a, i) => a + i.income, 0), accepted, items }
}
