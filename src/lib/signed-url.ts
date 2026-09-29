import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Kortlevende ondertekende tokens voor document-downloads (HMAC-SHA256 met een van
 * ENCRYPTION_KEY afgeleide sleutel). Het token bindt document-id, gebruiker en vervaltijd.
 */

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error("ENCRYPTION_KEY ontbreekt")
  return createHmac("sha256", Buffer.from(raw, "base64")).update("download-signing-v1").digest()
}

export function signDownload(documentId: string, userId: string, ttlSeconds = 300, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds
  const payload = `${documentId}.${userId}.${exp}`
  const sig = createHmac("sha256", key()).update(payload).digest("base64url")
  return `${exp}.${sig}`
}

export function verifyDownload(token: string, documentId: string, userId: string, now = Date.now()): boolean {
  const [expStr, sig] = token.split(".")
  const exp = Number(expStr)
  if (!sig || !Number.isFinite(exp) || exp < Math.floor(now / 1000)) return false
  const expected = createHmac("sha256", key()).update(`${documentId}.${userId}.${exp}`).digest()
  const given = Buffer.from(sig, "base64url")
  return given.length === expected.length && timingSafeEqual(given, expected)
}
