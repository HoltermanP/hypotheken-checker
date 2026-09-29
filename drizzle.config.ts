import { config } from "dotenv"

config({ path: ".env.local" })
config()
import { defineConfig } from "drizzle-kit"

const url = process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder"
const local = url.startsWith("pglite:")

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  ...(local ? { driver: "pglite" as const } : {}),
  dbCredentials: { url: local ? url.slice("pglite:".length) : url },
  strict: true,
  verbose: true,
})
