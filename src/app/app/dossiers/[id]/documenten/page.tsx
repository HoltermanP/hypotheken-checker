import { ShieldCheck } from "lucide-react"
import { DocumentsManager, type DocView } from "@/components/documents/documents-manager"
import { StatusLight } from "@/components/status-light"
import { requireUserIdOrRedirect } from "@/lib/auth"
import type { ExtractedField, NormalizedExtraction } from "@/lib/documents/extraction"
import { docType } from "@/lib/documents/types"
import { documentChecksForDossier, checklistFor, listDocuments, retentionDays } from "@/lib/services/documents"
import { loadIntake } from "@/lib/services/dossiers"
import { isLocalStorage } from "@/lib/storage"

export const metadata = { title: "Documenten" }

export default async function DocumentsPage({ params }: PageProps<"/app/dossiers/[id]/documenten">) {
  const { id } = await params
  const userId = await requireUserIdOrRedirect()
  const [{ intake }, rows, checks] = await Promise.all([loadIntake(userId, id), listDocuments(userId, id), documentChecksForDossier(userId, id)])
  const today = new Date().toISOString().slice(0, 10)
  const items = checklistFor(intake, today)
  const docs: DocView[] = rows.map((d) => {
    const extraction = (d.extraction ?? null) as NormalizedExtraction | null
    const confirmed = (d.confirmedData ?? null) as { fields: ExtractedField[] } | null
    const def = docType(d.type)
    const fields = confirmed?.fields ?? extraction?.fields ?? def?.fields.map((f) => ({ key: f.key, label: f.label, kind: f.kind, value: null, confidence: 0, note: null })) ?? []
    return {
      id: d.id,
      type: d.type,
      typeLabel: def?.label ?? d.type,
      applicantPosition: d.applicantPosition,
      status: d.status,
      fileName: d.fileName,
      fields,
      warnings: extraction?.warnings ?? [],
      documentTypeMatches: extraction?.documentTypeMatches ?? true,
      financials: def?.extraction === "financials",
      error: d.errorMessage,
      expiresAt: d.expiresAt.toISOString(),
    }
  })
  return (
    <div className="space-y-8">
      <div className="flex gap-3 rounded-xl border p-4 text-sm">
        <ShieldCheck aria-hidden className="size-5 shrink-0 text-primary" />
        <p>
          Je documenten worden privé en versleuteld bewaard en na {retentionDays()} dagen automatisch verwijderd. We lezen ze uit met AI, maar nemen niets over zonder jouw bevestiging. Een BSN slaan we nooit op: maak het zo mogelijk vooraf onleesbaar.
        </p>
      </div>
      <DocumentsManager dossierId={id} items={items} docs={docs} local={isLocalStorage()} />
      <section aria-labelledby="consistentie" className="space-y-3">
        <h2 id="consistentie" className="text-lg font-semibold">Consistentiecontrole</h2>
        {checks.raw.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bevestig documenten om ze te laten controleren op onderlinge consistentie.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {checks.raw.map((c) => (
              <li key={c.id} className="flex gap-3 p-3 text-sm">
                <StatusLight status={c.status} />
                <div>
                  <p className="font-medium">{c.label}</p>
                  <p className="text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
