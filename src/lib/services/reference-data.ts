import "server-only"
import { desc, eq } from "drizzle-orm"
import type { LenderProfile, RateRow } from "@/lib/engine/lenders/types"
import type { NormSet } from "@/lib/engine/norms"
import { getDb, schema } from "@/lib/db/client"
import { SEED_LENDERS, SEED_RATES } from "@/lib/lenders"
import { rowsToProfile, type KvRow } from "@/lib/lenders/profile-kv"
import { buildNormSet, seedNormSet, type NormEntry } from "@/lib/norms"

/**
 * Referentiedata (normen, geldverstrekkers, rentes) uit de database, met de seed als
 * terugvaloptie als de database (nog) niet bereikbaar is. Korte cache per serverinstantie.
 */

const TTL_MS = 60_000
type Cached<T> = { at: number; value: T }
const cache: { norms?: Cached<NormSet>; lenders?: Cached<LenderProfile[]>; rates?: Cached<RateRow[]> } = {}

export function invalidateReferenceCache() {
  delete cache.norms
  delete cache.lenders
  delete cache.rates
}

function fresh<T>(c: Cached<T> | undefined): c is Cached<T> {
  return !!c && Date.now() - c.at < TTL_MS
}

export async function loadNormSetEntries(normSetId: string): Promise<NormEntry[]> {
  const db = getDb()
  const [set] = await db.select().from(schema.normSets).where(eq(schema.normSets.id, normSetId))
  if (!set) throw new Error("Normenset niet gevonden")
  const rows = await db.select().from(schema.normValues).where(eq(schema.normValues.normSetId, normSetId))
  return rows.map((r) => ({
    key: r.key,
    year: set.year,
    value: r.value,
    unit: r.unit,
    label: r.label,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    checkedAt: r.checkedAt,
    status: r.status === "verified" ? "verified" : "needs_verification",
    note: r.note,
  }))
}

export async function getActiveNormSet(): Promise<NormSet> {
  if (fresh(cache.norms)) return cache.norms.value
  try {
    const db = getDb()
    const [active] = await db
      .select()
      .from(schema.normSets)
      .where(eq(schema.normSets.status, "active"))
      .orderBy(desc(schema.normSets.year), desc(schema.normSets.version))
      .limit(1)
    if (!active) throw new Error("Geen actieve normenset")
    const entries = await loadNormSetEntries(active.id)
    const [prev] = await db
      .select()
      .from(schema.normSets)
      .where(eq(schema.normSets.year, active.year - 1))
      .orderBy(desc(schema.normSets.version))
      .limit(1)
    const prevHillen = prev
      ? (await loadNormSetEntries(prev.id)).find((e) => e.key === "hillen.aftrek_pct")?.value
      : undefined
    const set = buildNormSet(entries, {
      year: active.year,
      version: `${active.year}.${active.version}`,
      previousHillenPct: typeof prevHillen === "number" ? prevHillen : null,
    })
    cache.norms = { at: Date.now(), value: set }
    return set
  } catch (err) {
    console.warn("Normen uit database niet beschikbaar, seed gebruikt:", (err as Error).message)
    return seedNormSet()
  }
}

export async function getLenders(): Promise<LenderProfile[]> {
  if (fresh(cache.lenders)) return cache.lenders.value
  try {
    const db = getDb()
    const [lenders, criteria, ent] = await Promise.all([
      db.select().from(schema.lenders),
      db.select().from(schema.lenderCriteria),
      db.select().from(schema.lenderEntrepreneurPolicies),
    ])
    if (lenders.length === 0) throw new Error("Geen geldverstrekkers in de database")
    const toKv = (r: typeof criteria[number]): KvRow => ({
      key: r.key,
      value: r.value,
      sourceUrl: r.sourceUrl,
      status: (r.status as KvRow["status"]) ?? "needs_verification",
      note: r.note,
    })
    const profiles = lenders
      .map((l) =>
        rowsToProfile(
          l,
          criteria.filter((c) => c.lenderSlug === l.slug).map(toKv),
          ent.filter((c) => c.lenderSlug === l.slug).map(toKv)
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name))
    cache.lenders = { at: Date.now(), value: profiles }
    return profiles
  } catch (err) {
    console.warn("Geldverstrekkers uit database niet beschikbaar, seed gebruikt:", (err as Error).message)
    return SEED_LENDERS
  }
}

/** Per bank × periode × klasse × aflossingsvorm de meest recente rente. */
export function latestRates(rows: RateRow[]): RateRow[] {
  const best = new Map<string, RateRow>()
  for (const r of rows) {
    const k = `${r.lenderSlug}|${r.fixedYears}|${r.ltvClass}|${r.repaymentType}`
    const cur = best.get(k)
    if (!cur || r.rateDate > cur.rateDate) best.set(k, r)
  }
  return [...best.values()]
}

export async function getRates(): Promise<RateRow[]> {
  if (fresh(cache.rates)) return cache.rates.value
  try {
    const db = getDb()
    const rows = await db.select().from(schema.rateSheets)
    if (rows.length === 0) throw new Error("Geen rentes in de database")
    const mapped: RateRow[] = rows.map((r) => ({
      lenderSlug: r.lenderSlug,
      fixedYears: r.fixedYears,
      ltvClass: r.ltvClass as RateRow["ltvClass"],
      repaymentType: r.repaymentType as RateRow["repaymentType"],
      ratePct: r.ratePct,
      rateDate: r.rateDate,
      status: r.status as RateRow["status"],
      sourceUrl: r.sourceUrl,
    }))
    const latest = latestRates(mapped)
    cache.rates = { at: Date.now(), value: latest }
    return latest
  } catch (err) {
    console.warn("Rentes uit database niet beschikbaar, seed gebruikt:", (err as Error).message)
    return SEED_RATES
  }
}

export async function getEngineContext() {
  const [norms, lenders, rates] = await Promise.all([getActiveNormSet(), getLenders(), getRates()])
  return { norms, lenders, rates }
}
