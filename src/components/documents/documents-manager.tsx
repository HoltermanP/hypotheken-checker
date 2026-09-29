"use client"

import { upload } from "@vercel/blob/client"
import { CheckCircle2, Eye, FileUp, Loader2, RefreshCw, Trash2, Wand2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MoneyInput } from "@/components/forms/fields"
import {
  confirmAction,
  deleteDocumentAction,
  downloadUrlAction,
  extractAction,
  localUploadAction,
  registerUploadAction,
} from "@/app/app/dossiers/[id]/documenten/actions"
import type { ExtractedField, FieldValue } from "@/lib/documents/extraction"
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES, type ChecklistItem } from "@/lib/documents/types"
import { formatDate } from "@/lib/format"

export interface DocView {
  id: string
  type: string
  typeLabel: string
  applicantPosition: number | null
  status: string
  fileName: string
  fields: ExtractedField[]
  warnings: string[]
  documentTypeMatches: boolean
  error: string | null
  expiresAt: string
}

const STATUS: Record<string, string> = {
  uploaded: "Geüpload",
  extracting: "Wordt uitgelezen",
  extracted: "Controleer en bevestig",
  confirmed: "Bevestigd",
  failed: "Handmatig invullen",
}

function confidenceBadge(c: number, hasValue: boolean) {
  if (!hasValue) return <Badge variant="outline">niet gevonden</Badge>
  if (c >= 0.85) return <Badge variant="secondary">zeker</Badge>
  if (c >= 0.6) return <Badge variant="outline" className="border-amber-500 text-amber-800 dark:text-amber-300">controleer</Badge>
  return <Badge variant="outline" className="border-destructive text-destructive">onzeker</Badge>
}

function UploadButton({ item, dossierId, local }: { item: ChecklistItem; dossierId: string; local: boolean }) {
  const inputId = useId()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function onFile(file: File) {
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) return toast.error("Alleen PDF, JPG, PNG of WebP.")
    if (file.size > MAX_UPLOAD_BYTES) return toast.error("Bestand is te groot (max. 20 MB).")
    setBusy(true)
    try {
      let docId: string | null = null
      if (local) {
        const form = new FormData()
        form.set("file", file)
        form.set("dossierId", dossierId)
        form.set("type", item.type)
        if (item.applicantPosition) form.set("applicantPosition", String(item.applicantPosition))
        const r = await localUploadAction(form)
        if (!r.ok) throw new Error(r.error)
        docId = r.data.id
      } else {
        const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1]
        const blob = await upload(`dossiers/${dossierId}/${item.type}.${ext}`, file, {
          access: "private",
          handleUploadUrl: "/api/documents/upload",
          contentType: file.type,
          clientPayload: JSON.stringify({ dossierId, type: item.type, applicantPosition: item.applicantPosition, fileName: file.name }),
        })
        const r = await registerUploadAction({
          dossierId,
          type: item.type,
          applicantPosition: item.applicantPosition,
          pathname: blob.pathname,
          url: blob.url,
          contentType: file.type,
          size: file.size,
          fileName: file.name,
        })
        if (!r.ok) throw new Error(r.error)
        docId = r.data.id
      }
      toast.success("Geüpload. We lezen het document nu uit…")
      router.refresh()
      const e = await extractAction(docId, dossierId)
      if (!e.ok) toast.error(e.error)
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message || "Uploaden mislukt.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <Label htmlFor={inputId} className="sr-only">
        {item.label} uploaden
      </Label>
      <input
        id={inputId}
        type="file"
        accept={ALLOWED_CONTENT_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ""
        }}
        disabled={busy}
      />
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => document.getElementById(inputId)?.click()}>
        {busy ? <Loader2 aria-hidden className="animate-spin" /> : <FileUp aria-hidden />}
        Uploaden
      </Button>
    </div>
  )
}

function FieldInput({ field, value, onChange }: { field: ExtractedField; value: FieldValue; onChange: (v: FieldValue) => void }) {
  const id = useId()
  return (
    <div className="grid gap-1 sm:grid-cols-[1fr_1.2fr_auto] sm:items-center sm:gap-3">
      <Label htmlFor={id} className="text-sm">
        {field.label}
      </Label>
      {field.kind === "money" ? (
        <MoneyInput id={id} value={typeof value === "number" ? value : null} onChange={onChange} allowNegative />
      ) : field.kind === "boolean" ? (
        <select id={id} className="h-8 rounded-lg border bg-transparent px-2 text-sm" value={value === null ? "" : value ? "ja" : "nee"} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "ja")}>
          <option value="">onbekend</option>
          <option value="ja">ja</option>
          <option value="nee">nee</option>
        </select>
      ) : (
        <Input
          id={id}
          type={field.kind === "date" ? "date" : field.kind === "text" ? "text" : "number"}
          value={value === null ? "" : String(value)}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === "" ? null : field.kind === "number" || field.kind === "percent" ? Number(raw.replace(",", ".")) : raw)
          }}
        />
      )}
      <div>{confidenceBadge(field.confidence, field.value !== null)}</div>
    </div>
  )
}

function Review({ doc, dossierId }: { doc: DocView; dossierId: string }) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, FieldValue>>(() => Object.fromEntries(doc.fields.map((f) => [f.key, f.value])))
  const [pending, start] = useTransition()
  const submit = (apply: boolean) =>
    start(async () => {
      const r = await confirmAction(doc.id, dossierId, values, apply)
      if (!r.ok) return void toast.error(r.error)
      r.data.summary.forEach((s) => toast.success(s))
      r.data.errors.forEach((e) => toast.error(e))
      router.refresh()
    })
  return (
    <div className="space-y-3 rounded-lg bg-muted/40 p-3">
      {!doc.documentTypeMatches ? (
        <p role="alert" className="text-sm text-destructive">Dit lijkt geen {doc.typeLabel.toLowerCase()} te zijn. Controleer of je het juiste bestand hebt geüpload.</p>
      ) : null}
      {doc.warnings.map((w) => (
        <p key={w} className="text-sm text-amber-800 dark:text-amber-300">{w}</p>
      ))}
      <p className="text-sm text-muted-foreground">Controleer de waarden. Pas aan waar nodig en bevestig. Pas daarna nemen we ze over.</p>
      <div className="space-y-2">
        {doc.fields.map((f) => (
          <FieldInput key={f.key} field={f} value={values[f.key] ?? null} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => submit(true)}>
          <CheckCircle2 aria-hidden /> Bevestigen en overnemen in intake
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => submit(false)}>
          Alleen bevestigen
        </Button>
      </div>
    </div>
  )
}

function DocumentRow({ doc, dossierId }: { doc: DocView; dossierId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [open, setOpen] = useState(doc.status === "extracted" || doc.status === "failed")
  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{doc.typeLabel}</span>
        <span className="text-xs text-muted-foreground">{doc.fileName}</span>
        <Badge variant={doc.status === "confirmed" ? "secondary" : "outline"}>{STATUS[doc.status] ?? doc.status}</Badge>
        <span className="text-xs text-muted-foreground">wordt verwijderd op {formatDate(doc.expiresAt)}</span>
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Sluiten" : "Controleren"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Bekijken"
            onClick={() =>
              start(async () => {
                const r = await downloadUrlAction(doc.id)
                if (r.ok) window.open(r.data.url, "_blank", "noopener")
                else toast.error(r.error)
              })
            }
          >
            <Eye aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Opnieuw uitlezen"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await extractAction(doc.id, dossierId)
                if (!r.ok) toast.error(r.error)
                router.refresh()
              })
            }
          >
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : doc.status === "uploaded" ? <Wand2 aria-hidden /> : <RefreshCw aria-hidden />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Verwijderen"
            onClick={() =>
              start(async () => {
                if (!window.confirm("Document definitief verwijderen?")) return
                const r = await deleteDocumentAction(doc.id, dossierId)
                if (!r.ok) toast.error(r.error)
                router.refresh()
              })
            }
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      {doc.error ? <p className="text-sm text-amber-800 dark:text-amber-300">{doc.error}</p> : null}
      {open && doc.fields.length > 0 ? <Review doc={doc} dossierId={dossierId} /> : null}
    </li>
  )
}

export function DocumentsManager({ dossierId, items, docs, local }: { dossierId: string; items: ChecklistItem[]; docs: DocView[]; local: boolean }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="checklist" className="space-y-3">
        <h2 id="checklist" className="text-lg font-semibold">Checklist</h2>
        <ul className="divide-y rounded-xl border">
          {items.map((item) => {
            const have = docs.filter((d) => d.type === item.type && d.applicantPosition === item.applicantPosition)
            const confirmed = have.some((d) => d.status === "confirmed")
            return (
              <li key={`${item.type}-${item.applicantPosition}`} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.label}
                    {item.applicantPosition ? <span className="text-muted-foreground"> · {item.applicantPosition === 1 ? "aanvrager 1" : "partner"}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                </div>
                <Badge variant={item.required ? "default" : "outline"}>{item.required ? "verplicht" : "optioneel"}</Badge>
                {confirmed ? (
                  <span className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                    <CheckCircle2 aria-hidden className="size-4" /> bevestigd
                  </span>
                ) : null}
                <UploadButton item={item} dossierId={dossierId} local={local} />
              </li>
            )
          })}
        </ul>
      </section>
      <section aria-labelledby="uploads" className="space-y-3">
        <h2 id="uploads" className="text-lg font-semibold">Geüploade documenten</h2>
        {docs.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nog geen documenten geüpload.</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((d) => (
              <DocumentRow key={d.id} doc={d} dossierId={dossierId} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
