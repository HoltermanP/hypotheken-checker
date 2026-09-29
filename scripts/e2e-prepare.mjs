/**
 * Maakt een verse lokale PGlite-database voor e2e-tests en voert de migraties uit.
 * Gebruikt door playwright.config.ts (webServer).
 */
import { rmSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"

const dir = process.env.E2E_DB_DIR ?? "./.pglite-e2e"
rmSync(dir, { recursive: true, force: true })
rmSync("./.uploads", { recursive: true, force: true })
const client = new PGlite(dir)
await migrate(drizzle(client), { migrationsFolder: "drizzle" })
await client.close()
console.info(`E2E-database klaar in ${dir}`)
