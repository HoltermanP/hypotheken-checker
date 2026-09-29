import "server-only"
import { del, get, put } from "@vercel/blob"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

/**
 * Opslag van documenten.
 * - Productie: Vercel Blob met `access: "private"`; lezen alleen server-side.
 * - Lokaal zonder BLOB_READ_WRITE_TOKEN (en niet op Vercel): bestanden in `.uploads/`.
 */

export function isLocalStorage(): boolean {
  return !process.env.BLOB_READ_WRITE_TOKEN && process.env.VERCEL !== "1"
}

const LOCAL_DIR = path.join(process.cwd(), ".uploads")

function localPath(pathname: string): string {
  const safe = pathname.replace(/\.\.+/g, "").replace(/^\/+/, "")
  return path.join(LOCAL_DIR, safe)
}

export async function putLocal(pathname: string, data: Buffer): Promise<{ url: string; pathname: string }> {
  const file = localPath(pathname)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, data)
  return { url: `local://${pathname}`, pathname }
}

/** Server-side upload (alleen gebruikt als fallback). */
export async function putServer(pathname: string, data: Buffer, contentType: string) {
  if (isLocalStorage()) return putLocal(pathname, data)
  const r = await put(pathname, data, { access: "private", contentType, addRandomSuffix: false })
  return { url: r.url, pathname: r.pathname }
}

export async function readObject(urlOrPathname: string): Promise<Buffer> {
  if (urlOrPathname.startsWith("local://")) return readFile(localPath(urlOrPathname.slice("local://".length)))
  const r = await get(urlOrPathname, { access: "private", useCache: false })
  if (!r || r.statusCode !== 200) throw new Error("Document niet gevonden in opslag")
  return Buffer.from(await new Response(r.stream).arrayBuffer())
}

export async function deleteObject(urlOrPathname: string): Promise<void> {
  if (urlOrPathname.startsWith("local://")) {
    await rm(localPath(urlOrPathname.slice("local://".length)), { force: true })
    return
  }
  await del(urlOrPathname)
}
