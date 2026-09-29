import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Versleuteling op applicatieniveau met AES-256-GCM.
 *
 * Formaat: `v1.<iv>.<authTag>.<ciphertext>` (alle delen base64url). Een random IV van 12 bytes
 * per waarde; de auth-tag garandeert integriteit. De sleutel komt uit ENCRYPTION_KEY.
 */

const VERSION = "v1"
let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error("ENCRYPTION_KEY ontbreekt")
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY moet 32 bytes (base64) zijn")
  cachedKey = key
  return key
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(
    "."
  )
}

export function decryptString(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split(".")
  if (version !== VERSION || !ivB64 || !tagB64 || ctB64 === undefined) {
    throw new Error("Ongeldig versleuteld formaat")
  }
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()])
  return pt.toString("utf8")
}

export function encryptJson(value: unknown): string {
  return encryptString(JSON.stringify(value))
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decryptString(payload)) as T
}

/** Deterministische hash (bijv. voor input-hashes). Niet voor wachtwoorden. */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

/** Alleen voor tests. */
export function __resetKeyCache() {
  cachedKey = null
}
