import { monthsBetween, parseDate } from "../age"
import { average, coefficientOfVariation, linearSlope } from "../math"
import { correctedProfit } from "./sole-prop"
import { groupFigures } from "./dga"
import type { BusinessInput, Sector } from "./types"

/**
 * Continuïteitsrisicoscore (0 = laag risico, 100 = hoog risico). Modelaanname, geen norm: de score
 * helpt de gebruiker het ondernemersrisico te duiden en bepaalt de hoogte van de adviezen.
 *
 * Onderdelen en maximale punten:
 * - trend van de winst (dalend)            25
 * - schommeling (variatiecoëfficiënt)      20
 * - afhankelijkheid grootste opdrachtgever 20
 * - branche                                15
 * - solvabiliteit (BV)                     10
 * - bestaansduur < 3 jaar                  10
 */

export const SECTOR_RISK: Record<Sector, number> = {
  horeca: 15,
  bouw: 12,
  detailhandel: 10,
  transport: 8,
  creatief: 8,
  agrarisch: 8,
  industrie: 6,
  groothandel: 6,
  overig: 6,
  zakelijke_dienstverlening: 4,
  ict: 4,
  zorg: 2,
}

export interface RiskScore {
  score: number
  level: "laag" | "gemiddeld" | "hoog"
  components: { label: string; points: number; max: number; detail: string }[]
  volatile: boolean
  warnings: string[]
}

export function profitSeries(business: BusinessInput): number[] {
  if (business.soleProp) {
    return [...business.soleProp.years]
      .filter((y) => !y.isForecast)
      .sort((a, b) => a.year - b.year)
      .map(correctedProfit)
  }
  return groupFigures(business).figures.map((f) => f.resultBeforeTax + (f.dgaSalaryPaid ?? 0))
}

export function continuityRisk(business: BusinessInput, calculationDate: string): RiskScore {
  const series = profitSeries(business)
  const components: RiskScore["components"] = []
  const warnings: string[] = []
  const mean = average(series)

  const slope = linearSlope(series)
  const relSlope = mean !== 0 ? slope / Math.abs(mean) : 0
  const trendPts = relSlope < 0 ? Math.min(25, Math.round(-relSlope * 100)) : 0
  components.push({
    label: "Trend winst",
    points: trendPts,
    max: 25,
    detail: relSlope < 0 ? `dalend (${(relSlope * 100).toFixed(0)}% per jaar)` : "stabiel of stijgend",
  })

  const cv = coefficientOfVariation(series)
  const volPts = Math.min(20, Math.round(cv * 40))
  components.push({ label: "Schommeling", points: volPts, max: 20, detail: `variatiecoëfficiënt ${cv.toFixed(2)}` })
  const volatile = cv > 0.25
  if (volatile) {
    warnings.push("Het inkomen schommelt sterk. Banken kijken dan kritischer; houd een grotere buffer aan.")
  }

  const client = business.largestClientPct
  const clientPts = client > 50 ? 20 : client > 30 ? 10 : 0
  components.push({ label: "Grootste opdrachtgever", points: clientPts, max: 20, detail: `${client}% van de omzet` })
  if (client > 50) warnings.push("Je bent sterk afhankelijk van één opdrachtgever.")

  const sectorPts = SECTOR_RISK[business.sector] ?? 6
  components.push({ label: "Branche", points: sectorPts, max: 15, detail: business.sector })

  let solvPts = 0
  const figures = groupFigures(business).figures
  const latest = figures[figures.length - 1]
  if (latest && latest.balanceTotal > 0) {
    const solv = (latest.equity / latest.balanceTotal) * 100
    solvPts = solv < 10 ? 10 : solv < 20 ? 5 : 0
    components.push({ label: "Solvabiliteit", points: solvPts, max: 10, detail: `${solv.toFixed(1)}%` })
  }

  const ageMonths = monthsBetween(parseDate(business.startDate), parseDate(calculationDate))
  const agePts = ageMonths < 36 ? 10 : 0
  components.push({ label: "Bestaansduur", points: agePts, max: 10, detail: `${Math.floor(ageMonths / 12)} jaar` })

  const score = components.reduce((a, c) => a + c.points, 0)
  return {
    score,
    level: score <= 25 ? "laag" : score <= 50 ? "gemiddeld" : "hoog",
    components,
    volatile,
    warnings,
  }
}
