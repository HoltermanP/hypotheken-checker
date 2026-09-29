import { formatEuro, formatMonths, formatNumber, formatPct } from "@/lib/format"

/** Formatteer een metriek uit de engine op basis van de eenheid. */
export function formatMetric(value: number, unit: string): string {
  switch (unit) {
    case "EUR":
    case "EUR/jaar":
      return formatEuro(value)
    case "EUR/maand":
      return `${formatEuro(value)} per maand`
    case "%":
      return formatPct(value, 1)
    case "maanden":
      return value >= 999 ? "onbeperkt" : formatMonths(value)
    case "factor":
      return formatNumber(value, 2)
    default:
      return formatNumber(value, 0)
  }
}
