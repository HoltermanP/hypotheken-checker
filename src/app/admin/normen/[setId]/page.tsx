import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { ActionForm } from "@/components/admin/action-form"
import { StatusBadge } from "@/components/status-badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getDb, schema } from "@/lib/db/client"
import { formatDate } from "@/lib/format"
import { updateNormValue } from "../../actions"

export const dynamic = "force-dynamic"

function preview(value: unknown): string {
  const s = JSON.stringify(value)
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

export default async function NormSetPage({ params, searchParams }: PageProps<"/admin/normen/[setId]">) {
  const { setId } = await params
  const { filter } = await searchParams
  const db = getDb()
  const [set] = await db.select().from(schema.normSets).where(eq(schema.normSets.id, setId))
  if (!set) notFound()
  let values = await db.select().from(schema.normValues).where(eq(schema.normValues.normSetId, setId))
  values = values.sort((a, b) => a.key.localeCompare(b.key))
  if (filter === "te-verifieren") values = values.filter((v) => v.status !== "verified")
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Normen {set.year} (versie {set.version})</h1>
      <p className="text-sm text-muted-foreground">
        {values.length} parameters. <a className="underline" href="?filter=te-verifieren">Toon alleen te verifiëren</a> ·{" "}
        <a className="underline" href="?">Toon alles</a>
      </p>
      <ul className="divide-y rounded-lg border">
        {values.map((v) => (
          <li key={v.id} className="p-3">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{v.key}</span>
                <span className="font-medium">{v.label}</span>
                <StatusBadge status={v.status} />
                <span className="text-xs text-muted-foreground">
                  {v.checkedAt ? `gecontroleerd ${formatDate(v.checkedAt)}` : "nooit gecontroleerd"} · {preview(v.value)}
                </span>
              </summary>
              <ActionForm action={updateNormValue} className="mt-3">
                <input type="hidden" name="id" value={v.id} />
                <div className="space-y-1">
                  <Label htmlFor={`val-${v.id}`}>Waarde (JSON)</Label>
                  <Textarea id={`val-${v.id}`} name="value" defaultValue={JSON.stringify(v.value, null, 1)} rows={6} className="font-mono text-xs" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor={`st-${v.id}`}>Status</Label>
                    <select id={`st-${v.id}`} name="status" defaultValue={v.status} className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm">
                      <option value="verified">geverifieerd</option>
                      <option value="needs_verification">te verifiëren</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`ch-${v.id}`}>Datum van controle</Label>
                    <Input id={`ch-${v.id}`} name="checkedAt" type="date" defaultValue={v.checkedAt ?? ""} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`sn-${v.id}`}>Bron</Label>
                    <Input id={`sn-${v.id}`} name="sourceName" defaultValue={v.sourceName ?? ""} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`su-${v.id}`}>Bron-URL</Label>
                    <Input id={`su-${v.id}`} name="sourceUrl" type="url" defaultValue={v.sourceUrl ?? ""} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`no-${v.id}`}>Toelichting</Label>
                  <Textarea id={`no-${v.id}`} name="note" defaultValue={v.note ?? ""} rows={2} />
                </div>
              </ActionForm>
            </details>
          </li>
        ))}
      </ul>
    </div>
  )
}
