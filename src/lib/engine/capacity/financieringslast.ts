import type { FinancieringslastTable, NormValues } from "../norms"

/**
 * Opzoeken van het financieringslastpercentage (Trhk Bijlage 1).
 *
 * - Het toetsinkomen wordt naar beneden afgerond op hele euro's en valt in de rij waarvoor
 *   vanaf ≤ inkomen ≤ tot. Inkomens onder de laagste drempel vallen in de eerste rij ('–'),
 *   inkomens boven de hoogste rij in de laatste rij.
 * - De toetsrente wordt afgerond op 3 decimalen en valt in de kolom vanaf ≤ rente ≤ tot.
 */

export type TableKind = "regular" | "aow" | "box3Regular" | "box3Aow"

export function findIncomeRow(table: FinancieringslastTable, income: number): number {
  const value = Math.floor(Math.max(0, income))
  const rows = table.incomeBrackets
  for (let i = 0; i < rows.length; i++) {
    const [from, to] = rows[i]!
    // Brackets zijn aaneengesloten per hele euro; 'to' is inclusief.
    if (value >= from && (to === null || value <= to)) return i
  }
  return value < rows[0]![0] ? 0 : rows.length - 1
}

export function findRateColumn(table: FinancieringslastTable, ratePct: number): number {
  const rate = Math.round(ratePct * 1000) / 1000
  const cols = table.rateBrackets
  for (let i = 0; i < cols.length; i++) {
    const [from, to] = cols[i]!
    if (rate >= from && (to === null || rate <= to)) return i
  }
  // Rentes tussen twee kolommen (bijv. 2,0005 → afgerond 2,001) komen hier niet; alles daaronder:
  return rate < cols[0]![0] ? 0 : cols.length - 1
}

export function financieringslastPct(
  norms: NormValues,
  kind: TableKind,
  toetsinkomen: number,
  toetsrentePct: number
): number {
  const table = norms.trhk.tables[kind]
  const row = findIncomeRow(table, toetsinkomen)
  const col = findRateColumn(table, toetsrentePct)
  return table.values[row]![col]!
}

/**
 * Toetsrente (Trhk art. 3): bij een rentevaste periode korter dan 10 jaar de AFM-toetsrente (of de
 * werkelijke rente als die hoger is); bij 10 jaar of langer de werkelijke rente.
 */
export function toetsrente(norms: NormValues, actualRatePct: number, fixedYears: number): number {
  if (fixedYears < norms.trhk.toetsrenteMinFixedYears) {
    return Math.max(norms.trhk.toetsrenteAfmPct, actualRatePct)
  }
  return actualRatePct
}
