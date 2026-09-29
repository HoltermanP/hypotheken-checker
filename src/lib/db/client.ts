import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import type { BatchItem } from "drizzle-orm/batch"
import * as schema from "./schema"

export type Database = NeonHttpDatabase<typeof schema>

let instance: Database | null = null
let local = false

/**
 * Databaseverbinding.
 * - Productie/preview: Neon via de HTTP-driver (serverless).
 * - Lokaal/e2e: `DATABASE_URL=pglite:./.pglite` gebruikt een ingebedde Postgres (PGlite, alleen
 *   devDependency). Nooit op Vercel.
 */
export function getDb(): Database {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL ontbreekt")
  if (url.startsWith("pglite:")) {
    if (process.env.VERCEL === "1") throw new Error("PGlite is alleen voor lokaal gebruik")
    // Runtime-require zodat PGlite niet in de productiebundel belandt.
    const nodeModule = process.getBuiltinModule("node:module") as typeof import("node:module")
    const req = nodeModule.createRequire(`${process.cwd()}/package.json`)
    const pgliteModule = ["@electric-sql", "pglite"].join("/")
    const drizzleModule = ["drizzle-orm", "pglite"].join("/")
    const { PGlite } = req(pgliteModule) as typeof import("@electric-sql/pglite")
    const { drizzle: drizzlePglite } = req(drizzleModule) as typeof import("drizzle-orm/pglite")
    const g = globalThis as unknown as { __pglite?: InstanceType<typeof PGlite> }
    g.__pglite ??= new PGlite(url.slice("pglite:".length) || undefined)
    instance = drizzlePglite(g.__pglite, { schema }) as unknown as Database
    local = true
    return instance
  }
  instance = drizzle(neon(url), { schema })
  return instance
}

/** Voer schrijfacties atomair uit: Neon-batch, of sequentieel in een transactie op PGlite. */
export async function runBatch(queries: BatchItem<"pg">[]): Promise<void> {
  if (queries.length === 0) return
  const db = getDb()
  if (!local) {
    await db.batch(queries as [BatchItem<"pg">, ...BatchItem<"pg">[]])
    return
  }
  const client = (globalThis as unknown as { __pglite: { exec: (sql: string) => Promise<unknown> } }).__pglite
  await client.exec("BEGIN")
  try {
    for (const q of queries) await q
    await client.exec("COMMIT")
  } catch (err) {
    await client.exec("ROLLBACK")
    throw err
  }
}

export { schema }
