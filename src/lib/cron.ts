import "server-only"
import { timingSafeEqual } from "node:crypto"
import { lt } from "drizzle-orm"
import { getDb, schema } from "@/lib/db/client"

/** Vercel Cron stuurt `Authorization: Bearer <CRON_SECRET>` mee. */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const header = request.headers.get("authorization") ?? ""
  const expected = Buffer.from(`Bearer ${secret}`)
  const given = Buffer.from(header)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function recordCronRun(job: string, status: "ok" | "partial" | "error", summary: Record<string, unknown>) {
  try {
    await getDb().insert(schema.cronRuns).values({ job, status, summary })
  } catch (err) {
    console.error("cron_runs schrijven mislukt:", (err as Error).message)
  }
}

/** Opschonen van operationele data: rate-limit-vensters (> 2 dagen) en audit-log (> 2 jaar). */
export async function purgeOperationalData(now = new Date()) {
  const db = getDb()
  const rl = await db.delete(schema.rateLimits).where(lt(schema.rateLimits.windowStart, new Date(now.getTime() - 2 * 86_400_000))).returning({ key: schema.rateLimits.key })
  const al = await db.delete(schema.auditLog).where(lt(schema.auditLog.at, new Date(now.getTime() - 730 * 86_400_000))).returning({ id: schema.auditLog.id })
  return { rateLimits: rl.length, auditLog: al.length }
}
