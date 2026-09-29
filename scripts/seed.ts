/**
 * Vult de database met de normen (2025 en 2026), geldverstrekkers, acceptatiecriteria en
 * rentetabellen uit de seed. Idempotent: bestaande seedwaarden worden bijgewerkt, handmatige
 * wijzigingen via /admin (origin 'admin') blijven staan.
 *
 *   pnpm db:seed            normen + banken + rentes
 *   pnpm db:seed --force    ook bestaande normwaarden overschrijven met de seed
 */
import { config } from "dotenv"
import { and, eq } from "drizzle-orm"
import { SEED_ENTRIES, SEED_VERSION } from "../src/lib/norms"
import { SEED_LENDERS, SEED_RATES } from "../src/lib/lenders"
import { profileToRows } from "../src/lib/lenders/profile-kv"

config({ path: ".env.local" })
config()

async function main() {
  const force = process.argv.includes("--force")
  // Dynamische import zodat DATABASE_URL uit .env.local geladen is vóór de client wordt gemaakt.
  const { getDb, schema } = await import("../src/lib/db/client")
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  // ------------------------------------------------------------------ normen
  for (const [yearStr, entries] of Object.entries(SEED_ENTRIES)) {
    const year = Number(yearStr)
    const existing = await db
      .select()
      .from(schema.normSets)
      .where(and(eq(schema.normSets.year, year), eq(schema.normSets.version, SEED_VERSION)))
    let setId = existing[0]?.id
    if (!setId) {
      const [created] = await db
        .insert(schema.normSets)
        .values({ year, version: SEED_VERSION, name: `Normen ${year}`, status: year === 2026 ? "active" : "archived" })
        .returning()
      setId = created!.id
    }
    for (const e of entries) {
      const values = {
        normSetId: setId,
        key: e.key,
        value: e.value,
        unit: e.unit ?? null,
        label: e.label,
        sourceName: e.sourceName ?? null,
        sourceUrl: e.sourceUrl ?? null,
        checkedAt: e.checkedAt ?? today,
        status: e.status,
        note: e.note ?? null,
      }
      if (force) {
        await db
          .insert(schema.normValues)
          .values(values)
          .onConflictDoUpdate({ target: [schema.normValues.normSetId, schema.normValues.key], set: values })
      } else {
        await db.insert(schema.normValues).values(values).onConflictDoNothing()
      }
    }
    console.info(`Normen ${year}: ${entries.length} waarden`)
  }

  // ------------------------------------------------------------------ geldverstrekkers
  for (const l of SEED_LENDERS) {
    await db
      .insert(schema.lenders)
      .values({ slug: l.slug, name: l.name, active: l.active, activeNote: l.activeNote ?? null })
      .onConflictDoUpdate({ target: schema.lenders.slug, set: { name: l.name, active: l.active, activeNote: l.activeNote ?? null } })
    const { criteria, entrepreneur } = profileToRows(l)
    for (const [table, rows] of [
      [schema.lenderCriteria, criteria],
      [schema.lenderEntrepreneurPolicies, entrepreneur],
    ] as const) {
      for (const r of rows) {
        const values = { lenderSlug: l.slug, key: r.key, value: r.value, sourceUrl: r.sourceUrl, status: r.status, checkedAt: "2026-09-29" }
        await db
          .insert(table)
          .values(values)
          .onConflictDoUpdate({ target: [table.lenderSlug, table.key], set: force ? values : { lenderSlug: l.slug } })
      }
    }
  }
  console.info(`Geldverstrekkers: ${SEED_LENDERS.length}`)

  // ------------------------------------------------------------------ rentes
  await db.delete(schema.rateSheets).where(eq(schema.rateSheets.origin, "seed"))
  const rows = SEED_RATES.map((r) => ({
    lenderSlug: r.lenderSlug,
    fixedYears: r.fixedYears,
    ltvClass: r.ltvClass,
    nhg: r.ltvClass === "nhg",
    repaymentType: r.repaymentType,
    energyLabelDiscount: 0,
    ratePct: r.ratePct,
    rateDate: r.rateDate,
    sourceUrl: r.sourceUrl ?? null,
    status: r.status,
    origin: "seed",
  }))
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(schema.rateSheets).values(rows.slice(i, i + 500))
  }
  console.info(`Rentes: ${rows.length}`)
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
