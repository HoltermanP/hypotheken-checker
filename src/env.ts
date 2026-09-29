import { z } from "zod"

/**
 * Centrale, Zod-gevalideerde omgevingsvariabelen.
 *
 * Validatie gebeurt lui (bij de eerste keer dat een variabele wordt gelezen), zodat
 * `next build` en unit tests niet afhankelijk zijn van productiesecrets. Een ontbrekende of
 * ongeldige variabele geeft een duidelijke foutmelding op het moment dat hij nodig is.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  ANTHROPIC_MODEL_REPORT: z.string().min(1).default("claude-sonnet-5"),
  /** 32 bytes, base64-gecodeerd. Genereer met: openssl rand -base64 32 */
  ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine((v) => Buffer.from(v, "base64").length === 32, {
      message: "ENCRYPTION_KEY moet 32 bytes zijn (base64). Genereer met: openssl rand -base64 32",
    }),
  CRON_SECRET: z.string().min(16),
  DOCUMENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).default(30),
  /** Alleen voor lokale e2e-tests. Wordt genegeerd in productie. */
  E2E_TEST_MODE: z.enum(["0", "1"]).optional(),
})

const clientSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
})

export type ServerEnv = z.infer<typeof serverSchema>
export type ClientEnv = z.infer<typeof clientSchema>

const cache = new Map<string, unknown>()

function readServerVar<K extends keyof ServerEnv>(key: K): ServerEnv[K] {
  if (cache.has(key)) return cache.get(key) as ServerEnv[K]
  const shape = serverSchema.shape[key]
  const parsed = shape.safeParse(process.env[key])
  if (!parsed.success) {
    throw new Error(
      `Omgevingsvariabele ${String(key)} ontbreekt of is ongeldig: ${parsed.error.issues
        .map((i) => i.message)
        .join(", ")}`
    )
  }
  cache.set(key, parsed.data)
  return parsed.data as ServerEnv[K]
}

/** Server-only env. Gebruik nooit in client components. */
export const env = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    if (!(prop in serverSchema.shape)) {
      throw new Error(`Onbekende omgevingsvariabele: ${prop}`)
    }
    return readServerVar(prop as keyof ServerEnv)
  },
})

/** Client-veilige env (NEXT_PUBLIC_*). Next.js inlinet deze bij de build. */
export const clientEnv = {
  get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY() {
    return clientSchema.shape.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.parse(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    )
  },
  get NEXT_PUBLIC_APP_URL() {
    return clientSchema.shape.NEXT_PUBLIC_APP_URL.parse(process.env.NEXT_PUBLIC_APP_URL)
  },
}

/** Valideer alle server-variabelen tegelijk (gebruikt door scripts en health checks). */
export function validateServerEnv(): ServerEnv {
  return serverSchema.parse(process.env)
}

/** E2E-testmodus: nooit actief in productie of op Vercel-productie. */
export function isE2ETestMode(): boolean {
  return (
    process.env.E2E_TEST_MODE === "1" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.VERCEL !== "1"
  )
}
