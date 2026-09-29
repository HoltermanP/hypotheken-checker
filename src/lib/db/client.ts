import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"
import * as schema from "./schema"

export type Database = NeonHttpDatabase<typeof schema>

let instance: Database | null = null

/** Lazy Neon-verbinding (HTTP-driver, geschikt voor serverless/Vercel). */
export function getDb(): Database {
  if (instance) return instance
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL ontbreekt")
  instance = drizzle(neon(url), { schema })
  return instance
}

export { schema }
