import { NextResponse } from "next/server"
import { getDb, schema } from "@/lib/db/client"
import { isAuthorizedCron, recordCronRun } from "@/lib/cron"
import { ADAPTERS, runAdapter } from "@/lib/lenders/adapters"
import { invalidateReferenceCache } from "@/lib/services/reference-data"

export const runtime = "nodejs"
export const maxDuration = 120

/**
 * Dagelijks rentes verversen. Per bank een adapter; mislukt een adapter, dan blijft de laatst
 * bekende tabel in gebruik (de app toont "rente van [datum]").
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 })
  const today = new Date().toISOString().slice(0, 10)
  const results = await Promise.all(ADAPTERS.map((a) => runAdapter(a, today)))
  const db = getDb()
  let inserted = 0
  for (const r of results.filter((x) => x.ok)) {
    await db.insert(schema.rateSheets).values(
      r.rows.map((row) => ({
        lenderSlug: row.lenderSlug,
        fixedYears: row.fixedYears,
        ltvClass: row.ltvClass,
        nhg: row.ltvClass === "nhg",
        repaymentType: row.repaymentType,
        energyLabelDiscount: 0,
        ratePct: row.ratePct,
        rateDate: row.rateDate,
        sourceUrl: row.sourceUrl ?? null,
        status: "verified",
        origin: "cron",
      }))
    )
    inserted += r.rows.length
  }
  invalidateReferenceCache()
  const summary = Object.fromEntries(results.map((r) => [r.slug, r.ok ? `ok (${r.rows.length})` : `mislukt: ${r.error}`]))
  const okCount = results.filter((r) => r.ok).length
  await recordCronRun("rates", okCount === results.length ? "ok" : okCount > 0 ? "partial" : "error", { ...summary, inserted })
  return NextResponse.json({ inserted, results: summary })
}
