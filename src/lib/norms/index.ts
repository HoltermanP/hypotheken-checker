import type { NormSet } from "@/lib/engine/norms"
import { buildNormSet, type NormEntry } from "./build"
import seed2025 from "./seed/norms-2025.json"
import seed2026 from "./seed/norms-2026.json"

export { buildNormSet, dutchNumber, NormBuildError, parseAkFormula, type NormEntry } from "./build"

export const SEED_ENTRIES: Record<number, NormEntry[]> = {
  2025: seed2025 as NormEntry[],
  2026: seed2026 as NormEntry[],
}

export const SEED_VERSION = 1
export const DEFAULT_NORM_YEAR = 2026

const cache = new Map<number, NormSet>()

/** Normenset uit de seed (fallback als de database niet bereikbaar is, en voor tests). */
export function seedNormSet(year: number = DEFAULT_NORM_YEAR): NormSet {
  const hit = cache.get(year)
  if (hit) return hit
  const entries = SEED_ENTRIES[year]
  if (!entries) throw new Error(`Geen seed-normen voor ${year}`)
  const prevHillen = SEED_ENTRIES[year - 1]?.find((e) => e.key === "hillen.aftrek_pct")?.value
  const set = buildNormSet(entries, {
    year,
    version: `${year}.${SEED_VERSION}`,
    previousHillenPct: typeof prevHillen === "number" ? prevHillen : null,
  })
  cache.set(year, set)
  return set
}
