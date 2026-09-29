import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { head } from "@vercel/blob"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authErrorResponse, requireUserId } from "@/lib/auth"
import { ALLOWED_CONTENT_TYPES, docType, MAX_UPLOAD_BYTES } from "@/lib/documents/types"
import { audit } from "@/lib/services/audit"
import { getOwnedDossier } from "@/lib/services/dossiers"
import { documentPathPrefix, registerDocument } from "@/lib/services/documents"

/**
 * Client-upload naar Vercel Blob (private). De browser vraagt hier een kortlevend token; we
 * controleren sessie, eigendom van het dossier, documenttype, bestandstype en grootte.
 */

const payloadSchema = z.object({
  dossierId: z.string().uuid(),
  type: z.string().refine((t) => !!docType(t), "Onbekend documenttype"),
  applicantPosition: z.number().int().min(1).max(2).nullable(),
  fileName: z.string().max(200),
})

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const userId = await requireUserId()
        const payload = payloadSchema.parse(JSON.parse(clientPayload ?? "{}"))
        await getOwnedDossier(userId, payload.dossierId)
        if (!pathname.startsWith(documentPathPrefix(payload.dossierId))) throw new Error("Ongeldig pad")
        return {
          allowedContentTypes: [...ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 10 * 60_000,
          tokenPayload: JSON.stringify({ userId, ...payload }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Vercel roept dit aan na de upload (idempotent: de client registreert ook zelf).
        const p = JSON.parse(tokenPayload ?? "{}") as { userId: string } & z.infer<typeof payloadSchema>
        const meta = await head(blob.url)
        await registerDocument(p.userId, {
          dossierId: p.dossierId,
          type: p.type,
          applicantPosition: p.applicantPosition,
          pathname: blob.pathname,
          url: blob.url,
          contentType: blob.contentType,
          size: meta.size,
          fileName: p.fileName,
        })
        await audit({ userId: p.userId, action: "upload", entityType: "document", dossierId: p.dossierId, meta: { type: p.type } })
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    const auth = authErrorResponse(error)
    if (auth) return auth as NextResponse
    return NextResponse.json({ error: "Upload niet toegestaan." }, { status: 400 })
  }
}
