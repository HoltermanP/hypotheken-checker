import { NextResponse } from "next/server"
import { authErrorResponse, requireUserId } from "@/lib/auth"
import { audit } from "@/lib/services/audit"
import { getOwnedDocument, NotFoundError } from "@/lib/services/documents-access"
import { verifyDownload } from "@/lib/signed-url"
import { readObject } from "@/lib/storage"

/**
 * Kortlevende, ondertekende download-proxy. Vereist een geldige sessie van de eigenaar én een
 * token (5 minuten geldig) dat aan document en gebruiker is gebonden. Private blobs worden nooit
 * direct aan de browser gegeven.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/documents/[id]/download">) {
  try {
    const { id } = await ctx.params
    const userId = await requireUserId()
    const token = new URL(request.url).searchParams.get("token") ?? ""
    if (!verifyDownload(token, id, userId)) return NextResponse.json({ error: "Link verlopen of ongeldig." }, { status: 403 })
    const doc = await getOwnedDocument(userId, id)
    const data = await readObject(doc.blobUrl)
    await audit({ userId, action: "download", entityType: "document", entityId: doc.id, dossierId: doc.dossierId })
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": doc.contentType,
        "Content-Disposition": `inline; filename="document-${doc.type}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    const auth = authErrorResponse(error)
    if (auth) return auth
    if (error instanceof NotFoundError) return NextResponse.json({ error: "Niet gevonden." }, { status: 404 })
    return NextResponse.json({ error: "Download mislukt." }, { status: 500 })
  }
}
