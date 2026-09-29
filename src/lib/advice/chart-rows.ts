import type { ChartRow } from "@/components/advice/charts"
import type { AdviceOutput } from "@/lib/engine"

export function chartRows(out: AdviceOutput): ChartRow[] {
  return out.loan.years.map((y) => ({
    jaar: y.calendarYear,
    schuld: Math.round(y.balanceEnd),
    waarde: Math.round(y.propertyValue),
    overwaarde: Math.round(y.equity),
    bruto: Math.round(y.grossMonthly),
    netto: Math.round(y.netMonthly),
    renteaftrek: Math.round(y.taxBenefit),
    ltv: Math.round(y.ltvPct * 10) / 10,
  }))
}
