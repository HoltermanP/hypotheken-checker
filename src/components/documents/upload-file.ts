import { upload } from "@vercel/blob/client"
import { localUploadAction, registerUploadAction } from "@/app/app/dossiers/[id]/documenten/actions"
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, resolveContentType } from "@/lib/documents/types"

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "text/csv": "csv",
}

/** Controleer en upload één bestand (Vercel Blob of lokaal) en registreer het. Geeft het document-ID terug. */
export async function uploadDocumentFile(params: {
  file: File
  dossierId: string
  type: string
  applicantPosition: number | null
  local: boolean
}): Promise<string> {
  const { file, dossierId, type, applicantPosition } = params
  const contentType = resolveContentType(file.name, file.type)
  if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)) throw new Error(`${file.name}: alleen PDF, JPG, PNG, WebP, Excel of CSV.`)
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: bestand is te groot (max. 20 MB).`)
  if (params.local) {
    const form = new FormData()
    form.set("file", file)
    form.set("dossierId", dossierId)
    form.set("type", type)
    if (applicantPosition) form.set("applicantPosition", String(applicantPosition))
    const r = await localUploadAction(form)
    if (!r.ok) throw new Error(r.error)
    return r.data.id
  }
  const blob = await upload(`dossiers/${dossierId}/${type}.${EXT[contentType] ?? "bin"}`, file, {
    access: "private",
    handleUploadUrl: "/api/documents/upload",
    contentType,
    clientPayload: JSON.stringify({ dossierId, type, applicantPosition, fileName: file.name }),
  })
  const r = await registerUploadAction({ dossierId, type, applicantPosition, pathname: blob.pathname, url: blob.url, contentType, size: file.size, fileName: file.name })
  if (!r.ok) throw new Error(r.error)
  return r.data.id
}
