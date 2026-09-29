import { ageInYears } from "../age"
import { NORM_KEYS, type NormValues } from "../norms"
import type { Applicant, TargetProperty } from "../types"

/**
 * Kosten koper en overdrachtsbelasting.
 *
 * Overdrachtsbelasting (OVB):
 * - Nieuwbouw vrij-op-naam: geen OVB (btw zit in de koopsom).
 * - Startersvrijstelling (0%): koper jonger dan de leeftijdsgrens, gaat er zelf wonen, woningwaarde
 *   ≤ woningwaardegrens en vrijstelling niet eerder gebruikt. Bij twee kopers per koper (ieder
 *   voor zijn aandeel, hier 50/50).
 * - Anders 2% bij eigen bewoning, overig tarief als de koper er niet zelf gaat wonen.
 *
 * Financieringskosten (advies, hypotheekakte, taxatie, NHG-provisie, bankgarantie) zijn in box 1
 * aftrekbaar in het jaar van betalen; de akte van levering, OVB, keuring en makelaar niet.
 */

export interface CostLine {
  key: string
  label: string
  amount: number
  deductible: boolean
  normKey?: string
  note?: string
}

export interface TransferTaxResult {
  amount: number
  ratePct: number
  starterExemptShare: number
  reason: string
}

export function transferTax(
  norms: NormValues,
  property: Pick<TargetProperty, "purchasePrice" | "kind" | "ownOccupation">,
  buyers: Pick<Applicant, "dateOfBirth" | "usedStartersExemption">[],
  transferDate: string
): TransferTaxResult {
  if (property.kind === "new_build") {
    return { amount: 0, ratePct: 0, starterExemptShare: 0, reason: "Nieuwbouw vrij-op-naam: geen overdrachtsbelasting." }
  }
  if (!property.ownOccupation) {
    return {
      amount: (property.purchasePrice * norms.ovb.overigPct) / 100,
      ratePct: norms.ovb.overigPct,
      starterExemptShare: 0,
      reason: "Geen eigen bewoning: tarief voor overige woningen.",
    }
  }
  const share = 1 / Math.max(1, buyers.length)
  const withinValue = property.purchasePrice <= norms.ovb.startersWoningwaardegrens
  let exemptShare = 0
  const reasons: string[] = []
  for (const b of buyers) {
    const age = ageInYears(b.dateOfBirth, transferDate)
    const eligible = withinValue && age < norms.ovb.startersMaxLeeftijd && !b.usedStartersExemption
    if (eligible) exemptShare += share
    reasons.push(
      eligible
        ? `koper van ${age} jaar: startersvrijstelling`
        : !withinValue
          ? "woningwaarde boven de grens voor de startersvrijstelling"
          : b.usedStartersExemption
            ? "startersvrijstelling al eerder gebruikt"
            : `koper van ${age} jaar is niet jonger dan ${norms.ovb.startersMaxLeeftijd}`
    )
  }
  const amount = (property.purchasePrice * (1 - exemptShare) * norms.ovb.eigenWoningPct) / 100
  return {
    amount,
    ratePct: norms.ovb.eigenWoningPct,
    starterExemptShare: exemptShare,
    reason: reasons.join("; "),
  }
}

export interface PurchaseCostsResult {
  lines: CostLine[]
  total: number
  deductibleTotal: number
  transferTax: TransferTaxResult
}

export function purchaseCosts(
  norms: NormValues,
  property: TargetProperty,
  buyers: Applicant[],
  loanAmount: number,
  opts: { nhg: boolean; transferDate: string; constructionInterest?: number }
): PurchaseCostsResult {
  const c = norms.costs
  const ovb = transferTax(norms, property, buyers, opts.transferDate)
  const lines: CostLine[] = []
  if (ovb.amount > 0 || property.kind === "existing") {
    lines.push({
      key: "ovb",
      label: "Overdrachtsbelasting",
      amount: ovb.amount,
      deductible: false,
      normKey: ovb.starterExemptShare > 0 ? NORM_KEYS.ovbStartersGrens : NORM_KEYS.ovbEigen,
      note: ovb.reason,
    })
  }
  if (property.kind === "existing") {
    lines.push({ key: "notaris_levering", label: "Notaris: akte van levering", amount: c.notarisLevering, deductible: false, normKey: NORM_KEYS.kkNotarisLevering })
  }
  lines.push({ key: "notaris_hypotheek", label: "Notaris: hypotheekakte", amount: c.notarisHypotheekakte, deductible: true, normKey: NORM_KEYS.kkNotarisHypotheek })
  lines.push({ key: "kadaster", label: "Kadaster (inschrijving)", amount: c.kadaster, deductible: false, normKey: NORM_KEYS.kkKadaster })
  if (property.kind === "existing") {
    lines.push({ key: "taxatie", label: "Taxatie", amount: c.taxatie, deductible: true, normKey: NORM_KEYS.kkTaxatie })
    const guarantee = (property.purchasePrice * c.bankgarantieGuaranteePctOfPrice) / 100
    lines.push({
      key: "bankgarantie",
      label: "Bankgarantie",
      amount: (guarantee * c.bankgarantiePctOfGuarantee) / 100,
      deductible: true,
      normKey: NORM_KEYS.kkBankgarantie,
    })
  }
  lines.push({ key: "advies", label: "Hypotheekadvies en bemiddeling", amount: c.adviesBemiddeling, deductible: true, normKey: NORM_KEYS.kkAdvies })
  if (opts.nhg) {
    lines.push({
      key: "nhg",
      label: "NHG-borgtochtprovisie",
      amount: (loanAmount * norms.nhg.provisiePct) / 100,
      deductible: true,
      normKey: NORM_KEYS.nhgProvisie,
    })
  }
  if (property.useBuildingInspection && property.kind === "existing") {
    lines.push({ key: "keuring", label: "Bouwkundige keuring", amount: c.bouwkundigeKeuring, deductible: false, normKey: NORM_KEYS.kkKeuring })
  }
  if (property.useBuyersAgent) {
    lines.push({ key: "makelaar", label: "Aankoopmakelaar", amount: c.aankoopmakelaar, deductible: false, normKey: NORM_KEYS.kkMakelaar })
  }
  if (property.kind === "new_build" && (opts.constructionInterest ?? 0) > 0) {
    lines.push({
      key: "bouwrente",
      label: "Bouwrente (rente tijdens de bouw)",
      amount: opts.constructionInterest ?? 0,
      deductible: true,
      note: "Rente over de reeds betaalde bouwtermijnen tot de oplevering.",
    })
  }
  const total = lines.reduce((a, l) => a + l.amount, 0)
  const deductibleTotal = lines.filter((l) => l.deductible).reduce((a, l) => a + l.amount, 0)
  return { lines, total, deductibleTotal, transferTax: ovb }
}

/**
 * Bouwrente bij nieuwbouw: rente over de gemiddeld opgenomen bouwdepot-termijnen tijdens de
 * bouwperiode (aanname: lineaire opname, gemiddeld 50% van het bouwbedrag opgenomen).
 */
export function estimateConstructionInterest(
  buildAmount: number,
  ratePct: number,
  months: number
): number {
  return buildAmount * 0.5 * (ratePct / 100) * (months / 12)
}

export interface SaleCostsResult {
  lines: CostLine[]
  total: number
}

export function saleCosts(
  norms: NormValues,
  salePrice: number,
  opts: { brokerFeePct?: number | null; penalty?: number }
): SaleCostsResult {
  const pct = opts.brokerFeePct ?? norms.costs.makelaarCourtagePct
  const lines: CostLine[] = [
    {
      key: "courtage",
      label: "Makelaarscourtage",
      amount: (salePrice * pct) / 100,
      deductible: false,
      normKey: NORM_KEYS.vkCourtage,
    },
    { key: "royement", label: "Royementskosten (doorhalen hypotheek)", amount: norms.costs.royementKosten, deductible: false, normKey: NORM_KEYS.vkRoyement },
    { key: "overig", label: "Overige verkoopkosten", amount: norms.costs.overigeVerkoopkosten, deductible: false, normKey: NORM_KEYS.vkOverig },
  ]
  if ((opts.penalty ?? 0) > 0) {
    lines.push({ key: "boete", label: "Boeterente bij aflossen", amount: opts.penalty ?? 0, deductible: false, normKey: NORM_KEYS.boeterente })
  }
  return { lines, total: lines.reduce((a, l) => a + l.amount, 0) }
}
