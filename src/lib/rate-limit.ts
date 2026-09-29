import "server-only"
import { sql } from "drizzle-orm"
import { getDb, schema } from "@/lib/db/client"

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Te veel verzoeken. Probeer het later opnieuw.")
  }
}

/**
 * Rate limiting met een vast venster per uur, opgeslagen in de database (werkt ook serverless).
 */
export async function enforceRateLimit(bucket: string, userId: string, limit: number, windowSeconds = 3600): Promise<void> {
  const now = Date.now()
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000)
  const key = `${bucket}:${userId}`
  const [row] = await getDb()
    .insert(schema.rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [schema.rateLimits.key, schema.rateLimits.windowStart], set: { count: sql`${schema.rateLimits.count} + 1` } })
    .returning({ count: schema.rateLimits.count })
  if ((row?.count ?? 0) > limit) {
    throw new RateLimitError(Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000))
  }
}

export function aiRateLimit(): number {
  return Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 30) || 30
}
